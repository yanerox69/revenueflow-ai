/**
 * Comprueba que el agente responde en el idioma del cliente, no en el del país.
 *
 * Usa mensajes de TEXTO a propósito: no gasta créditos de AssemblyAI. Y usa
 * números inventados, para que no le llegue un WhatsApp a nadie.
 *
 *   npx tsx --conditions=react-server scripts/probar-idiomas.mts
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: ['.env.local'], quiet: true });

// Import diferido: estos módulos leen env al cargarse.
const { ingestTextMessage } = await import('../src/lib/ingest/voice-note');
const { handleVoiceNote } = await import('../src/lib/agent/handle-voice-note');

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// La clínica venezolana: el caso interesante es que responda en otro idioma.
const { data: tenant } = await db
  .from('tenants')
  .select('id, name, country_code')
  .eq('country_code', 'VE')
  .eq('is_demo', true)
  .limit(1)
  .single();

if (!tenant) {
  console.error('No hay tenant VE de demo. Corre: npx tsx scripts/seed.ts');
  throw new Error('sin tenant');
}

console.log(`\nNegocio: ${tenant.name} (${tenant.country_code}) — idioma del país: español\n`);

const CASOS = [
  {
    idiomaEsperado: 'pt',
    telefono: '0414-9990001',
    texto: 'Oi, boa tarde. Preciso de uma limpeza dental. Tem horário na quinta à tarde?',
  },
  {
    idiomaEsperado: 'en',
    telefono: '0414-9990002',
    texto: 'Hi, good afternoon. I need a dental cleaning. Do you have anything Thursday afternoon?',
  },
  {
    idiomaEsperado: 'es',
    telefono: '0414-9990003',
    texto: 'Hola, buenas tardes. Necesito una limpieza dental. ¿Tienes algo el jueves en la tarde?',
  },
];

let fallos = 0;
let primero = true;

for (const caso of CASOS) {
  // La cuenta nueva devuelve 429 si se le encadenan las peticiones. En
  // producción no pasa: los clientes no escriben tres a la vez.
  if (!primero) await new Promise((r) => setTimeout(r, 20_000));
  primero = false;

  const ingest = await ingestTextMessage({
    tenantId: tenant.id,
    fromPhone: caso.telefono,
    text: caso.texto,
    externalId: `prueba-idioma-${caso.idiomaEsperado}-${Date.now()}`,
    senderName: `Prueba ${caso.idiomaEsperado.toUpperCase()}`,
  });

  const agent = await handleVoiceNote({
    tenantId: tenant.id,
    contactId: ingest.contactId,
    conversationId: ingest.conversationId,
    messageId: ingest.messageId,
    transcription: ingest.transcription!,
    detectedLanguage: ingest.detectedLanguage,
    languageConfidence: ingest.languageConfidence,
  });

  const ok = agent.idioma === caso.idiomaEsperado;
  if (!ok) fallos++;

  console.log(`${ok ? '  OK  ' : ' FALLA'} esperado ${caso.idiomaEsperado} → obtuvo ${agent.idioma}`);
  console.log(`        cliente: ${caso.texto.slice(0, 62)}…`);
  console.log(`        agente:  ${agent.reply.text}`);
  console.log(`        (modelo dijo: ${agent.intent.language} · desenlace: ${agent.outcome.kind})\n`);

  // Se comprueba que quedó guardado para los recordatorios del cron.
  const { data: contacto } = await db
    .from('contacts')
    .select('language')
    .eq('id', ingest.contactId)
    .single();

  if (contacto?.language !== agent.idioma) {
    console.log(`        ⚠ el idioma no se guardó en el contacto (${contacto?.language})\n`);
    fallos++;
  }
}

console.log(fallos === 0 ? 'Los tres idiomas, correctos.\n' : `${fallos} fallos.\n`);
