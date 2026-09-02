/**
 * Prueba de punta a punta contra el tenant demo:
 * audio → transcripción → intención → cita agendada.
 *
 * Consume créditos de AssemblyAI (STT + LLM Gateway).
 *
 *   npx tsx scripts/try-agent.mts <archivo.wav> [VE|BR]
 */
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

config({ path: ['.env.local', '.env'], quiet: true });

const [file, countryArg = 'VE'] = process.argv.slice(2);
if (!file) {
  console.error('Uso: npx tsx scripts/try-agent.mts <archivo.wav> [VE|BR]');
  process.exit(1);
}

// Import diferido: estos módulos leen env al cargarse.
const { ingestVoiceNote } = await import('../src/lib/ingest/voice-note');
const { handleVoiceNote } = await import('../src/lib/agent/handle-voice-note');
const { getPack } = await import('../src/lib/country');

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const pack = getPack(countryArg);

const { data: tenant } = await db
  .from('tenants')
  .select('id, name')
  .eq('is_demo', true)
  .eq('country_code', pack.code)
  .single();

if (!tenant) {
  console.error('No hay tenant demo para ese país. Corre: npm run seed');
  process.exit(1);
}

console.log(`\nTenant   ${tenant.name} (${pack.displayName})`);
console.log(`Audio    ${file}\n`);

const started = Date.now();

/** WhatsApp entrega .ogg (Opus); el navegador, .webm. */
const MIME: Record<string, string> = {
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/opus',
  '.webm': 'audio/webm',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
};

const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
const contentType = MIME[ext] ?? 'application/octet-stream';
console.log(`Formato   ${ext} → ${contentType}`);

const ingest = await ingestVoiceNote({
  tenantId: tenant.id,
  fromPhone: pack.samplePhone,
  audio: readFileSync(file),
  contentType,
  externalId: `prueba:${Date.now()}`,
  channel: 'web',
});

console.log('─'.repeat(66));
console.log('TRANSCRIPCIÓN');
console.log(`  ${ingest.transcription}`);
console.log(`  idioma ${ingest.detectedLanguage} (confianza ${
  ingest.languageConfidence != null
    ? (ingest.languageConfidence * 100).toFixed(1) + '%'
    : 'n/d'
}) · transcripción ${
  ingest.confidence != null ? (ingest.confidence * 100).toFixed(1) + '%' : 'n/d'
} · ${ingest.durationSeconds}s`);

if (ingest.languageMismatch) {
  console.log(`  ⚠ el cliente no habla el idioma del país (${pack.speechLanguage})`);
}

if (!ingest.transcription) {
  console.error('\nNo hubo texto que procesar.');
  process.exit(1);
}

const agent = await handleVoiceNote({
  tenantId: tenant.id,
  contactId: ingest.contactId,
  conversationId: ingest.conversationId,
  messageId: ingest.messageId,
  transcription: ingest.transcription,
  detectedLanguage: ingest.detectedLanguage,
  languageConfidence: ingest.languageConfidence,
});

console.log('─'.repeat(66));
console.log('INTENCIÓN EXTRAÍDA');
console.log(`  intención   ${agent.intent.intent}`);
console.log(`  servicio    ${agent.intent.service_id ?? '(ninguno)'}`);
console.log(`  día semana  ${agent.intent.weekday ?? '(no dijo)'}   franja ${agent.intent.period}`);
console.log(`  urgencia    ${agent.intent.urgency}`);
console.log(`  responde en ${agent.idioma}${
  agent.idioma === pack.speechLanguage ? '' : `  (el país habla ${pack.speechLanguage})`
}`);
console.log(`  confianza   ${(agent.intent.confidence * 100).toFixed(0)}%`);
console.log(`  resumen     ${agent.intent.summary}`);

console.log('─'.repeat(66));
console.log('ACCIÓN DEL AGENTE');

const o = agent.outcome;
if (o.kind === 'BOOKED') {
  console.log(`  ✔ CITA AGENDADA`);
  console.log(`    ${o.serviceName}`);
  console.log(`    ${o.label}`);
  console.log(`    ${o.startsAt}`);
} else if (o.kind === 'NO_AVAILABILITY') {
  console.log(`  Sin disponibilidad para ${o.serviceName}`);
} else {
  console.log(`  ${o.kind}: ${'reason' in o ? o.reason : ''}`);
}

console.log('─'.repeat(66));
console.log('RESPUESTA AL CLIENTE');
console.log(`  "${agent.reply.text}"`);
console.log(`  entrega: ${agent.reply.delivery}${
  agent.reply.deliveryReason ? ` — ${agent.reply.deliveryReason}` : ''
}`);

console.log('─'.repeat(66));
console.log(`Total: ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
