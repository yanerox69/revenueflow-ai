/**
 * Lista los usuarios de auth y su tenant. No imprime secretos.
 *   npx tsx scripts/usuarios.mts
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: ['.env.local'], quiet: true });

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data, error } = await db.auth.admin.listUsers({ perPage: 100 });
if (error) {
  console.error(error.message);
  process.exit(1);
}

const { data: perfiles } = await db.from('users').select('id, full_name, role, tenant_id');
const { data: tenants } = await db.from('tenants').select('id, name, country_code');

console.log('\n=== USUARIOS ===');
if (!data.users.length) console.log('  (ninguno)');

for (const u of data.users) {
  const p = perfiles?.find((x) => x.id === u.id);
  const t = tenants?.find((x) => x.id === p?.tenant_id);
  console.log(`\n  ${u.email}`);
  console.log(`    confirmado  ${u.email_confirmed_at ? 'sí' : 'NO — no podrá entrar'}`);
  console.log(`    negocio     ${t ? `${t.name} (${t.country_code})` : 'SIN TENANT'}`);
  console.log(`    rol         ${p?.role ?? '—'}`);
}
console.log();
