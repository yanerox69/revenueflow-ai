/**
 * Borra un usuario y, si es el único de su negocio, también el negocio.
 * Para limpiar cuentas de prueba sin ensuciar el demo.
 *
 *   npx tsx scripts/borrar-usuario.mts correo@ejemplo.com
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: ['.env.local'], quiet: true });

const email = process.argv[2];
if (!email) {
  console.error('Uso: npx tsx scripts/borrar-usuario.mts <correo>');
  process.exit(1);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data } = await db.auth.admin.listUsers({ perPage: 200 });
const user = data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

if (!user) {
  console.error(`No existe ningún usuario con el correo ${email}.`);
  process.exit(1);
}

const { data: profile } = await db
  .from('users')
  .select('tenant_id')
  .eq('id', user.id)
  .maybeSingle();

if (profile) {
  const { count } = await db
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', profile.tenant_id);

  if ((count ?? 0) <= 1) {
    // Borrar el tenant arrastra en cascada usuarios, contactos, citas, etc.
    await db.from('tenants').delete().eq('id', profile.tenant_id);
    console.log('  Negocio borrado (era su único usuario).');
  }
}

await db.auth.admin.deleteUser(user.id);
console.log(`\n${email} eliminado.\n`);
