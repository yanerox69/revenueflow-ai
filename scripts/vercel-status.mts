/**
 * Diagnóstico del proyecto en Vercel: conexión con git, dominios y
 * últimos despliegues con su estado real.
 *
 *   npx tsx scripts/vercel-status.mts
 */
import { config } from 'dotenv';
config({ path: ['.env.local'], quiet: true });

const TOKEN = process.env.VERCEL_TOKEN!;
const PROJECT = 'revenueflow-ai';

async function api(path: string) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
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
  name: string;
  link?: { type?: string; repo?: string; org?: string; productionBranch?: string };
  ssoProtection?: unknown;
};

console.log('\n=== PROYECTO ===');
console.log(`  id            ${p.id}`);
console.log(`  protección    ${JSON.stringify(p.ssoProtection)}`);

console.log('\n=== CONEXIÓN CON GIT ===');
if (p.link) {
  console.log(`  tipo          ${p.link.type}`);
  console.log(`  repositorio   ${p.link.org}/${p.link.repo}`);
  console.log(`  rama de prod  ${p.link.productionBranch}`);
} else {
  console.log('  SIN CONEXIÓN — los push a GitHub no van a desplegar nada.');
}

const deployments = await api(`/v6/deployments?projectId=${p.id}&limit=10`);
const list = (deployments.body as {
  deployments?: Array<{
    uid: string;
    url: string;
    state: string;
    readyState: string;
    target: string | null;
    source?: string;
    created: number;
  }>;
}).deployments ?? [];

console.log('\n=== DESPLIEGUES ===');
if (!list.length) console.log('  (ninguno)');
for (const d of list) {
  const when = new Date(d.created).toLocaleTimeString('es-VE');
  console.log(
    `  ${when}  ${(d.readyState ?? d.state).padEnd(10)} ${(d.target ?? '-').padEnd(11)} ` +
      `${(d.source ?? '?').padEnd(8)} ${d.url}`,
  );
}
console.log();
