/**
 * Borra las citas y conversaciones generadas por pruebas, SIN tocar usuarios.
 *
 * A diferencia de `npm run seed`, no recrea los usuarios demo, así que tu
 * sesión del navegador sigue válida. Es lo que quieres entre toma y toma.
 *
 *   npx tsx scripts/limpiar-agenda.mts
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: ['.env.local'], quiet: true });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: tenants } = await db.from('tenants').select('id, name');

for (const t of tenants ?? []) {
  // Citas: todas, pasadas y futuras.
  const { count: citas } = await db
    .from('appointments')
    .delete({ count: 'exact' })
    .eq('tenant_id', t.id);

  // Conversaciones de prueba (arrastran sus mensajes en cascada).
  const { count: convs } = await db
    .from('conversations')
    .delete({ count: 'exact' })
    .eq('tenant_id', t.id);

  // Los leads sembrados se conservan; los que creó el agente vuelven a NEW.
  await db
    .from('leads')
    .update({ status: 'NEW', intent_summary: null, intent_confidence: null })
    .eq('tenant_id', t.id)
    .neq('status', 'NEW');

  console.log(`  ${t.name.padEnd(26)} ${citas ?? 0} citas · ${convs ?? 0} conversaciones`);
}

console.log('\nAgenda limpia. Tu sesión del navegador sigue válida.\n');
