/**
 * Sincroniza una variable de entorno con Vercel, sin espacios ni saltos.
 *
 * Va por la API y no por el CLI, por la misma razón que el despliegue: el
 * CLI necesita el enlace local `.vercel`, que se rompe con facilidad y falla
 * con "Could not retrieve Project Settings". La API solo necesita el token.
 *
 * Canalizar el valor desde PowerShell añade un salto de línea al final, y
 * Vercel rechaza el despliegue si la variable lo lleva; por eso se recorta.
 *
 *   npx tsx scripts/vercel-env.mts ASSEMBLYAI_API_KEY
 */
import { config } from 'dotenv';
config({ path: ['.env.local'], quiet: true });

const TOKEN = process.env.VERCEL_TOKEN;
const PROJECT = 'revenueflow-ai';

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
if (!TOKEN) {
  console.error('Falta VERCEL_TOKEN en .env.local');
  process.exit(1);
}

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });
  return { ok: res.ok, status: res.status, body: await res.json().catch(() => ({})) };
}

// --- Se borra la anterior si existe ----------------------------------------
// Vercel no reemplaza: crear una que ya existe da 400. Hay que quitar la
// vieja primero, y para eso hace falta su id.
const listado = await api(`/v9/projects/${PROJECT}/env?decrypt=false`);

if (!listado.ok) {
  console.error(`\nNo se pudo leer las variables del proyecto (${listado.status}).`);
  console.error(JSON.stringify(listado.body).slice(0, 300));
  process.exit(1);
}

const existentes = (listado.body as { envs?: Array<{ id: string; key: string; target?: string[] }> })
  .envs?.filter((e) => e.key === nombre && (e.target ?? []).includes('production')) ?? [];

for (const e of existentes) {
  await api(`/v9/projects/${PROJECT}/env/${e.id}`, { method: 'DELETE' });
}

// --- Y se crea la nueva -----------------------------------------------------
const alta = await api(`/v10/projects/${PROJECT}/env`, {
  method: 'POST',
  body: JSON.stringify({
    key: nombre,
    value: valor,
    type: 'encrypted',
    target: ['production'],
  }),
});

if (!alta.ok) {
  console.error(`\nFalló al cargar ${nombre} (${alta.status}). Vercel dijo:\n`);
  console.error(JSON.stringify(alta.body, null, 2).slice(0, 600));
  console.error('');
  process.exit(1);
}

console.log(
  `\n${nombre} cargada en producción (${valor.length} caracteres, sin espacios).` +
    (existentes.length ? ` Se reemplazó la anterior.` : '') +
    '\n\nOjo: las variables solo entran en vigor al desplegar de nuevo.' +
    '\n  npx tsx scripts/vercel-deploy.mts\n',
);
