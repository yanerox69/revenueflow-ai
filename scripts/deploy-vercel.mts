/**
 * Despliega a producción en Vercel leyendo la configuración de .env.local.
 *
 * Evita copiar claves a mano en el formulario web, que es donde se cuela un
 * error de un carácter y produce el síntoma más confuso posible:
 * "funciona en local, falla desplegado".
 *
 *   npx tsx scripts/deploy-vercel.mts
 */
import { config } from 'dotenv';
import { spawn } from 'node:child_process';

config({ path: ['.env.local'], quiet: true });

const TOKEN = process.env.VERCEL_TOKEN;
if (!TOKEN) {
  console.error('Falta VERCEL_TOKEN en .env.local (vercel.com/account/tokens).');
  process.exit(1);
}

const PROJECT = 'revenueflow-ai';

/** Solo estas viajan al servidor. DATABASE_URL se queda en tu máquina. */
const VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ASSEMBLYAI_API_KEY',
] as const;

const env = { ...process.env, VERCEL_TOKEN: TOKEN };

function run(
  args: string[],
  opts: { input?: string; quiet?: boolean } = {},
): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn('npx', ['--yes', 'vercel@latest', ...args], {
      env,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      if (!opts.quiet) process.stdout.write(d);
    });
    child.stderr.on('data', (d) => {
      out += d;
    });

    if (opts.input !== undefined) child.stdin.write(opts.input);
    child.stdin.end();

    child.on('close', (code) => resolve({ code: code ?? 1, out }));
  });
}

// ---------------------------------------------------------------------------
console.log('\n1. Enlazando el proyecto…\n');
const link = await run(['link', '--yes', '--project', PROJECT], { quiet: true });
if (link.code !== 0) {
  console.error(link.out.slice(-800));
  process.exit(1);
}
console.log(`   Enlazado a ${PROJECT}.`);

console.log('\n2. Cargando variables de entorno…\n');
for (const name of VARS) {
  const value = process.env[name];
  if (!value) {
    console.error(`   FALTA ${name} en .env.local`);
    process.exit(1);
  }

  // Si ya existe, se reemplaza: así el script es repetible.
  await run(['env', 'rm', name, 'production', '--yes'], { quiet: true });
  const add = await run(['env', 'add', name, 'production'], {
    input: value,
    quiet: true,
  });

  console.log(`   ${add.code === 0 ? 'OK   ' : 'FALLA'} ${name}`);
  if (add.code !== 0) {
    console.error(add.out.slice(-400));
    process.exit(1);
  }
}

console.log('\n3. Desplegando a producción…\n');
const deploy = await run(['deploy', '--prod', '--yes']);

if (deploy.code !== 0) {
  console.error('\nFalló el despliegue.\n');
  console.error(deploy.out.slice(-1500));
  process.exit(1);
}

const url = deploy.out.match(/https:\/\/[a-z0-9-]+\.vercel\.app/gi)?.pop();
console.log(`\n${'─'.repeat(60)}`);
console.log(`URL: ${url ?? '(revisa la salida de arriba)'}`);
console.log('─'.repeat(60));
console.log(
  '\nFalta un paso manual: Supabase → Authentication → URL Configuration\n' +
    `  Site URL:      ${url}\n` +
    `  Redirect URLs: ${url}/**\n` +
    'Sin eso el login falla solo en producción.\n',
);
