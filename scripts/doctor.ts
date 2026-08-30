/**
 * Diagnóstico de configuración. No imprime secretos, solo su forma.
 *   npm run doctor
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: ['.env.local', '.env'], quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const ok = (m: string) => console.log(`  OK    ${m}`);
const bad = (m: string) => console.log(`  FALLA ${m}`);

function shape(v: string): string {
  if (!v) return '(vacío)';
  if (v.startsWith('postgres://') || v.startsWith('postgresql://'))
    return 'cadena de conexión Postgres';
  if (v.startsWith('eyJ')) return 'JWT (formato antiguo)';
  if (v.startsWith('sb_publishable_')) return 'clave publicable';
  if (v.startsWith('sb_secret_')) return 'clave secreta';
  return `desconocido (${v.slice(0, 6)}…)`;
}

async function main() {
  console.log('\n1. Variables de entorno\n');
  console.log(`  URL                       ${URL || '(vacío)'}`);
  console.log(`  ANON_KEY                  ${shape(ANON)}`);
  console.log(`  SERVICE_ROLE_KEY          ${shape(SERVICE)}`);

  let fatal = false;

  console.log('\n2. Forma de las credenciales\n');
  if (/^https:\/\/.+\.supabase\.co\/?$/.test(URL)) ok('La URL tiene forma de proyecto Supabase.');
  else { bad('La URL no parece de un proyecto Supabase.'); fatal = true; }

  if (ANON.startsWith('sb_publishable_') || ANON.startsWith('eyJ')) ok('La anon key tiene forma de clave de API.');
  else { bad('La anon key no parece una clave de API.'); fatal = true; }

  if (SERVICE.startsWith('postgres://') || SERVICE.startsWith('postgresql://')) {
    bad('SERVICE_ROLE_KEY contiene una CADENA DE CONEXIÓN, no una clave de API.');
    console.log('        El cliente JS necesita la clave service_role (sb_secret_… o eyJ…),');
    console.log('        no la URI de la base de datos.');
    console.log('        Supabase → Project Settings → API Keys → service_role / secret');
    fatal = true;
  } else if (SERVICE.startsWith('sb_secret_') || SERVICE.startsWith('eyJ')) {
    ok('La service_role key tiene forma de clave de API.');
  } else {
    bad('La service_role key no parece una clave de API.');
    fatal = true;
  }

  if (fatal) {
    console.log('\nCorrige lo anterior y vuelve a correr: npm run doctor\n');
    process.exit(1);
  }

  console.log('\n3. Conexión y migraciones\n');
  const db = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: connErr } = await db.from('tenants').select('id').limit(1);
  if (connErr) {
    bad(`No se pudo consultar "tenants": ${connErr.message}`);
    console.log('        ¿Aplicaste 0001_fundacion.sql en el SQL Editor?');
    process.exit(1);
  }
  ok('Conexión establecida y la tabla "tenants" existe.');

  const { error: rlsErr } = await db.rpc('tables_without_rls');
  if (rlsErr) {
    bad('Falta la función tables_without_rls (migración 0003).');
    process.exit(1);
  }
  ok('Migración 0003 aplicada.');

  const { data: sinRls } = await db.rpc('tables_without_rls');
  if (sinRls && sinRls.length > 0) {
    bad(`Tablas sin RLS: ${sinRls.map((r: { table_name: string }) => r.table_name).join(', ')}`);
    console.log('        ¿Aplicaste 0002_rls.sql?');
    process.exit(1);
  }
  ok('Todas las tablas tienen RLS activa.');

  const { count } = await db
    .from('tenants')
    .select('*', { count: 'exact', head: true })
    .eq('is_demo', true);

  if (!count) {
    bad('No hay datos demo. Corre: npm run seed');
    process.exit(1);
  }
  ok(`Datos demo presentes (${count} tenants).`);

  console.log('\nTodo listo. Corre: npm test\n');
}

main().catch((e) => {
  console.error('\nError inesperado:', e.message, '\n');
  process.exit(1);
});
