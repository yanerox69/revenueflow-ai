/**
 * Deja WhatsApp operativo de una vez:
 * valida las variables, las carga en Vercel, redespliega y asocia el número.
 *
 *   npx tsx scripts/whatsapp-setup.mts
 *
 * Antes: rellena en .env.local
 *   WHATSAPP_APP_SECRET, WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID
 * (WHATSAPP_VERIFY_TOKEN ya está generado)
 */
import { config } from 'dotenv';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

config({ path: ['.env.local'], quiet: true });

const REQUERIDAS = [
  'WHATSAPP_VERIFY_TOKEN',
  'WHATSAPP_APP_SECRET',
  'WHATSAPP_ACCESS_TOKEN',
] as const;

const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
const PAIS = process.argv[2] ?? 'VE';

console.log('\n1. Revisando variables…\n');

let falta = false;
for (const nombre of REQUERIDAS) {
  const v = process.env[nombre]?.trim();
  console.log(`   ${v ? 'OK   ' : 'FALTA'} ${nombre}`);
  if (!v) falta = true;
}
console.log(`   ${PHONE_ID ? 'OK   ' : 'FALTA'} WHATSAPP_PHONE_NUMBER_ID`);
if (!PHONE_ID) falta = true;

if (falta) {
  console.error('\nRellena lo que falte en .env.local. Ver docs/CONECTAR-WHATSAPP.md\n');
  process.exit(1);
}

// El token de Meta empieza por EAA; si no, casi seguro copiaste otra cosa.
if (!process.env.WHATSAPP_ACCESS_TOKEN!.trim().startsWith('EAA')) {
  console.warn('\n   AVISO: el token no empieza por "EAA". ¿Copiaste el correcto?\n');
}
// TypeScript no puede seguir la comprobación a través de la bandera `falta`.
const phoneId: string = PHONE_ID!;
if (!/^\d{6,}$/.test(phoneId)) {
  console.error(
    `\n"${phoneId}" no es un Phone number ID: son solo dígitos.\n` +
      'Si copiaste el teléfono (+1 555…), ese no es.\n',
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
console.log('\n2. Cargando en Vercel…\n');

const env = { ...process.env, VERCEL_TOKEN: process.env.VERCEL_TOKEN! };

function vercel(args: string[], input?: string): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn('npx', ['--yes', 'vercel@latest', ...args], {
      env,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    p.stdout.on('data', () => {});
    p.stderr.on('data', () => {});
    if (input !== undefined) p.stdin.write(input); // sin salto: Vercel lo rechaza
    p.stdin.end();
    p.on('close', (c) => resolve(c ?? 1));
  });
}

for (const nombre of REQUERIDAS) {
  await vercel(['env', 'rm', nombre, 'production', '--yes']);
  const codigo = await vercel(['env', 'add', nombre, 'production'], process.env[nombre]!.trim());
  console.log(`   ${codigo === 0 ? 'OK   ' : 'FALLA'} ${nombre}`);
}

// ---------------------------------------------------------------------------
console.log('\n3. Asociando el número al negocio…\n');

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: tenant } = await db
  .from('tenants')
  .select('id, name')
  .eq('is_demo', true)
  .eq('country_code', PAIS)
  .maybeSingle();

if (!tenant) {
  console.error(`   No hay negocio demo para ${PAIS}. Corre: npm run seed`);
  process.exit(1);
}

await db
  .from('tenant_settings')
  .update({ whatsapp_phone_number_id: null })
  .eq('whatsapp_phone_number_id', phoneId);

await db
  .from('tenant_settings')
  .update({ whatsapp_phone_number_id: phoneId })
  .eq('tenant_id', tenant.id);

console.log(`   ${tenant.name} ← número ${phoneId}`);

console.log('\n4. Ahora redespliega para que Vercel tome las variables:\n');
console.log('   npx tsx scripts/vercel-deploy.mts\n');
console.log('Después, manda una nota de voz al número de prueba y revisa:\n');
console.log('   npx tsx scripts/agenda.mts\n');

