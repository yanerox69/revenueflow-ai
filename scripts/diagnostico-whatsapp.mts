/**
 * Rastrea qué pasó con los últimos mensajes entrantes.
 * Dice en qué punto del camino se detuvo.
 *
 *   npx tsx scripts/diagnostico-whatsapp.mts
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: ['.env.local'], quiet: true });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const desde = new Date(Date.now() - 2 * 3600_000).toISOString();

console.log('\n=== ÚLTIMAS 2 HORAS ===\n');

const { data: contactos } = await db
  .from('contacts')
  .select('id, name, phone_e164, created_at, tenant_id')
  .gte('created_at', desde)
  .order('created_at', { ascending: false });

console.log(`1. Contactos creados: ${contactos?.length ?? 0}`);
for (const c of contactos ?? []) console.log(`   ${c.phone_e164}  ${c.name}`);

const { data: mensajes } = await db
  .from('messages')
  .select('id, direction, body, transcription_status, transcription_error, media_mime, created_at')
  .gte('created_at', desde)
  .order('created_at', { ascending: false })
  .limit(20);

console.log(`\n2. Mensajes: ${mensajes?.length ?? 0}`);
for (const m of mensajes ?? []) {
  const hora = new Date(m.created_at).toLocaleTimeString('es-VE');
  console.log(`   ${hora}  ${m.direction}  ${m.transcription_status ?? '—'}  ${m.media_mime ?? ''}`);
  if (m.body) console.log(`             "${String(m.body).slice(0, 90)}"`);
  if (m.transcription_error) console.log(`             ERROR: ${m.transcription_error}`);
}

const { data: citas } = await db
  .from('appointments')
  .select('id, starts_at, created_by_ai, created_at')
  .gte('created_at', desde);

console.log(`\n3. Citas creadas: ${citas?.length ?? 0}`);

const { data: uso } = await db
  .from('usage_events')
  .select('kind, quantity, unit, occurred_at')
  .gte('occurred_at', desde)
  .order('occurred_at', { ascending: false })
  .limit(10);

console.log(`\n4. Eventos de uso: ${uso?.length ?? 0}`);
for (const u of uso ?? []) console.log(`   ${u.kind}  ${u.quantity} ${u.unit ?? ''}`);

console.log('\n=== LECTURA ===\n');
if (!contactos?.length && !mensajes?.length) {
  console.log('  Nada llegó: Meta no está invocando el webhook,');
  console.log('  o el número no está asociado a ningún negocio.');
} else if (mensajes?.length && !citas?.length) {
  console.log('  El mensaje llegó pero no se agendó.');
  console.log('  Mira el estado de transcripción de arriba.');
} else if (citas?.length) {
  console.log('  Todo el camino funcionó.');
}
console.log();
