/**
 * Rastrea TODA la conversación de un número específico, sin límite de tiempo.
 * A diferencia de diagnostico-whatsapp.mts (últimas 2 horas, sin filtrar por
 * número), este busca un contacto puntual y muestra su historial completo.
 *
 *   npx tsx scripts/buscar-numero.mts 5573988790770
 *
 * El número puede pasarse con o sin '+' y con o sin espacios/guiones.
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: ['.env.local'], quiet: true });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const raw = process.argv[2];
if (!raw) {
  console.error('Uso: npx tsx scripts/buscar-numero.mts <telefono>');
  process.exit(1);
}
const digitos = raw.replace(/\D/g, '');

const { data: contactos } = await db
  .from('contacts')
  .select('id, tenant_id, name, phone_e164, language, preferred_locale, created_at')
  .ilike('phone_e164', `%${digitos}%`);

if (!contactos?.length) {
  console.log(`\nNingún contacto con "${digitos}" en su número.`);
  console.log('Eso significa que el mensaje nunca llegó a crear un contacto:');
  console.log('  - Meta no invocó el webhook (revisa el log de Meta / la firma), o');
  console.log('  - el número de WhatsApp al que escribió no está asociado a ningún negocio.\n');
  process.exit(0);
}

for (const c of contactos) {
  console.log(`\n=== Contacto ${c.phone_e164} (${c.name ?? 'sin nombre'}) ===`);
  console.log(`  id: ${c.id}  tenant: ${c.tenant_id}`);
  console.log(`  idioma aprendido: ${c.language ?? '—'}  creado: ${c.created_at}`);

  const { data: convs } = await db
    .from('conversations')
    .select('id, ai_mode, status, last_message_at, created_at')
    .eq('contact_id', c.id);

  for (const conv of convs ?? []) {
    console.log(`\n  -- Conversación ${conv.id} · modo ${conv.ai_mode} · ${conv.status}`);

    const { data: msgs } = await db
      .from('messages')
      .select(
        'direction, body, transcription, transcription_status, transcription_error, detected_language, language_confidence, created_at',
      )
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });

    for (const m of msgs ?? []) {
      const hora = new Date(m.created_at).toLocaleString('es-VE');
      const texto = (m.transcription ?? m.body ?? '').slice(0, 120);
      console.log(`     ${hora}  ${m.direction}  ${m.transcription_status ?? ''}  "${texto}"`);
      if (m.detected_language) {
        console.log(`         idioma detectado: ${m.detected_language} (${m.language_confidence ?? '?'})`);
      }
      if (m.transcription_error) console.log(`         ERROR: ${m.transcription_error}`);
    }
  }

  const { data: citas } = await db
    .from('appointments')
    .select('status, starts_at, service_id, created_at')
    .eq('contact_id', c.id)
    .order('starts_at', { ascending: false });

  console.log(`\n  Citas: ${citas?.length ?? 0}`);
  for (const a of citas ?? []) console.log(`     ${a.status}  ${a.starts_at}`);
}
console.log();
