/**
 * Muestra las citas próximas de cada negocio.
 * Úsalo antes de grabar el demo para confirmar que hay horarios libres.
 *
 *   npx tsx scripts/agenda.mts
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getPack } from '../src/lib/country';
config({ path: ['.env.local'], quiet: true });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: tenants } = await db
  .from('tenants')
  .select('id, name, country_code, locale')
  .order('name');

for (const t of tenants ?? []) {
  const pack = getPack(t.country_code);

  const { data: citas } = await db
    .from('appointments')
    .select('starts_at, status, created_by_ai, services(name)')
    .eq('tenant_id', t.id)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at')
    .limit(20);

  console.log(`\n${t.name}  (${pack.displayName})`);

  if (!citas?.length) {
    console.log('  Sin citas próximas — agenda libre.');
    continue;
  }

  for (const c of citas) {
    const cuando = new Intl.DateTimeFormat(t.locale, {
      timeZone: pack.timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(c.starts_at));

    const servicio =
      (c.services as { name?: string } | null)?.name ?? '(sin servicio)';

    console.log(`  ${cuando.padEnd(28)} ${servicio.padEnd(24)} ${c.created_by_ai ? 'IA' : 'manual'}`);
  }
}
console.log();
