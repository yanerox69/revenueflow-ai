/**
 * Vuelca la conversación real de WhatsApp a Markdown, con lo que cambió en
 * el sistema en cada paso.
 *
 * Las notas de voz que mandas desde el teléfono SON el registro de cómo se
 * modificó la agenda. Esto lo deja por escrito antes de que se pierda.
 *
 *   npx tsx scripts/exportar-conversacion.mts
 *   npx tsx scripts/exportar-conversacion.mts --salida docs/CONVERSACION-REAL.md
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
config({ path: ['.env.local'], quiet: true });

const iSalida = process.argv.indexOf('--salida');
const salida = iSalida > -1 ? process.argv[iSalida + 1] : null;

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: convs } = await db
  .from('conversations')
  .select(
    'id, created_at, tenants(name, country_code), contacts(name, phone_e164)',
  )
  .order('created_at', { ascending: false });

const partes: string[] = ['# Conversación real por WhatsApp\n'];
partes.push(
  `Exportado el ${new Date().toLocaleString('es-VE')}. ` +
    'Transcripciones y respuestas tal cual quedaron en la base — sin retocar.\n',
);

for (const c of convs ?? []) {
  const t: any = c.tenants;
  const p: any = c.contacts;

  const { data: msgs } = await db
    .from('messages')
    .select('direction, body, transcription, media_mime, created_at')
    .eq('conversation_id', c.id)
    .order('created_at');

  if (!msgs?.length) continue;

  partes.push(`\n---\n\n## ${t?.name ?? 'Negocio'} · ${t?.country_code ?? ''}\n`);
  partes.push(`Cliente: ${p?.name ?? 'sin nombre'} · ${p?.phone_e164 ?? ''}\n`);

  const t0 = new Date(msgs[0].created_at).getTime();

  for (const m of msgs) {
    const seg = Math.round((new Date(m.created_at).getTime() - t0) / 1000);
    const texto = (m.transcription ?? m.body ?? '').trim();
    const tipo = m.media_mime ? 'nota de voz' : 'texto';

    if (m.direction === 'IN') {
      partes.push(`\n**Cliente** · +${seg}s · ${tipo}\n`);
      partes.push(`> ${texto.replace(/\n/g, '\n> ')}\n`);
    } else {
      partes.push(`\n**RevenueFlow** · +${seg}s\n`);
      partes.push(`> ${texto.replace(/\n/g, '\n> ')}\n`);
    }
  }

  // Lo que quedó en la agenda después de la conversación.
  const { data: citas } = await db
    .from('appointments')
    .select('starts_at, status, services(name)')
    .eq('tenant_id', (await db.from('conversations').select('tenant_id').eq('id', c.id).single()).data!.tenant_id)
    .order('starts_at');

  if (citas?.length) {
    partes.push('\n**Estado de la agenda al terminar**\n');
    for (const a of citas) {
      const s: any = a.services;
      const cuando = new Date(a.starts_at).toLocaleString('es-VE', {
        timeZone: 'America/Caracas',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: 'numeric',
        minute: '2-digit',
      });
      partes.push(`- ${s?.name ?? 'Cita'} — ${cuando} · ${a.status}\n`);
    }
  }
}

const md = partes.join('');

if (!convs?.length) {
  console.log('\nNo hay conversaciones en la base.\n');
  console.log('Manda una nota de voz al +1 555-200-2639 y vuelve a correr esto.');
  console.log('Recuerda: limpiar-agenda.mts SIN --todo ya no borra el historial.\n');
} else if (salida) {
  writeFileSync(salida, md, 'utf8');
  console.log(`\nEscrito en ${salida}\n`);
} else {
  console.log('\n' + md);
}
