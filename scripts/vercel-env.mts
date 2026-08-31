/**
 * Sincroniza una variable de entorno con Vercel, sin espacios ni saltos.
 *
 * Canalizar el valor desde PowerShell añade un salto de línea al final, y
 * Vercel rechaza el despliegue si la variable lo lleva.
 *
 *   npx tsx scripts/vercel-env.mts CRON_SECRET
 */
import { config } from 'dotenv';
import { spawn } from 'node:child_process';

config({ path: ['.env.local'], quiet: true });

const nombre = process.argv[2];
if (!nombre) {
  console.error('Uso: npx tsx scripts/vercel-env.mts <NOMBRE_VARIABLE>');
  process.exit(1);
}

const valor = process.env[nombre]?.trim();
if (!valor) {
  console.error(`${nombre} no está definida en .env.local`);
  process.exit(1);
}

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
    if (input !== undefined) p.stdin.write(input); // sin salto final
    p.stdin.end();
    p.on('close', (c) => resolve(c ?? 1));
  });
}

await vercel(['env', 'rm', nombre, 'production', '--yes']);
const codigo = await vercel(['env', 'add', nombre, 'production'], valor);

console.log(
  codigo === 0
    ? `\n${nombre} cargada en producción (${valor.length} caracteres, sin espacios).\n`
    : `\nFalló al cargar ${nombre}.\n`,
);
process.exit(codigo);
