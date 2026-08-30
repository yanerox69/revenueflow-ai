/**
 * Confirma el correo de un usuario a mano.
 * Útil mientras Supabase tenga activada la confirmación por email.
 *
 *   npx tsx scripts/confirmar-usuario.mts correo@ejemplo.com
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: ['.env.local'], quiet: true });

const email = process.argv[2];
if (!email) {
  console.error('Uso: npx tsx scripts/confirmar-usuario.mts <correo>');
  process.exit(1);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data, error } = await db.auth.admin.listUsers({ perPage: 200 });
if (error) {
  console.error(error.message);
  process.exit(1);
}

const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No existe ningún usuario con el correo ${email}.`);
  process.exit(1);
}

if (user.email_confirmed_at) {
  console.log(`\n${email} ya estaba confirmado.\n`);
  process.exit(0);
}

const { error: updateError } = await db.auth.admin.updateUserById(user.id, {
  email_confirm: true,
});

if (updateError) {
  console.error(updateError.message);
  process.exit(1);
}

console.log(`\n${email} confirmado. Ya puede iniciar sesión.\n`);
