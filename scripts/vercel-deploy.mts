/**
 * Dispara un despliegue de producción tomando el código de GitHub.
 *
 * Vercel construye en sus servidores: no se sube nada desde esta máquina.
 * Útil cuando el webhook de GitHub no llega, o cuando la red local corta la
 * subida del bundle (`fetch failed` a mitad).
 *
 *   npx tsx scripts/vercel-deploy.mts
 */
import { config } from 'dotenv';
import { execSync } from 'node:child_process';
config({ path: ['.env.local'], quiet: true });

const TOKEN = process.env.VERCEL_TOKEN!;
const PROJECT = 'revenueflow-ai';

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

const project = await api(`/v9/projects/${PROJECT}`);
if (!project.ok) {
  console.error(`No se encontró el proyecto (${project.status}).`);
  process.exit(1);
}

const p = project.body as {
  id: string;
  link?: { repoId?: number; productionBranch?: string };
};

if (!p.link?.repoId) {
  console.error('El proyecto no está conectado a un repositorio de GitHub.');
  process.exit(1);
}

const sha = execSync('git rev-parse HEAD').toString().trim();
const subject = execSync('git log -1 --pretty=%s').toString().trim();

console.log(`\nDesplegando ${sha.slice(0, 7)} — ${subject}\n`);

const created = await api('/v13/deployments', {
  method: 'POST',
  body: JSON.stringify({
    name: PROJECT,
    project: p.id,
    target: 'production',
    gitSource: {
      type: 'github',
      repoId: p.link.repoId,
      ref: p.link.productionBranch ?? 'main',
      sha,
    },
  }),
});

if (!created.ok) {
  console.error(`Falló (${created.status}): ${JSON.stringify(created.body).slice(0, 400)}`);
  process.exit(1);
}

const d = created.body as { id: string; url: string };
console.log(`Despliegue creado: ${d.id}`);

// Esperar a que termine.
const deadline = Date.now() + 5 * 60_000;
let state = '';

while (Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 8000));
  const check = await api(`/v13/deployments/${d.id}`);
  const next = (check.body as { readyState?: string }).readyState ?? '?';

  if (next !== state) {
    state = next;
    console.log(`  ${state}`);
  }
  if (['READY', 'ERROR', 'CANCELED'].includes(state)) break;
}

console.log(
  state === 'READY'
    ? `\nListo: https://${d.url}\n`
    : `\nTerminó en estado ${state}.\n`,
);
process.exit(state === 'READY' ? 0 : 1);
