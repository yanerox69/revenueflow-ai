/**
 * Desactiva Deployment Protection en producción.
 *
 * Vercel la activa por defecto: el despliegue exige iniciar sesión en Vercel
 * para verse. Un jurado que abre la URL solo ve la pantalla de login de
 * Vercel y asume que el proyecto no funciona.
 *
 *   npx tsx scripts/vercel-public.mts
 */
import { config } from 'dotenv';
config({ path: ['.env.local'], quiet: true });

const TOKEN = process.env.VERCEL_TOKEN;
if (!TOKEN) {
  console.error('Falta VERCEL_TOKEN en .env.local');
  process.exit(1);
}

const PROJECT = 'revenueflow-ai';
const auth = { Authorization: `Bearer ${TOKEN}` };

async function api(path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: { ...auth, 'content-type': 'application/json', ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

// El proyecto puede vivir bajo un equipo; hay que dar con el scope correcto.
const teams = await api('/v2/teams');
const slugs: Array<string | null> = [null];
for (const t of (teams.body as { teams?: Array<{ id: string; slug: string }> }).teams ?? []) {
  slugs.push(t.id);
}

let found: { path: string; name: string } | null = null;
for (const teamId of slugs) {
  const q = teamId ? `?teamId=${teamId}` : '';
  const res = await api(`/v9/projects/${PROJECT}${q}`);
  if (res.ok) {
    found = { path: `/v9/projects/${PROJECT}${q}`, name: teamId ?? 'cuenta personal' };
    const p = res.body as { ssoProtection?: unknown; passwordProtection?: unknown };
    console.log(`\nProyecto encontrado en: ${found.name}`);
    console.log(`  ssoProtection actual:      ${JSON.stringify(p.ssoProtection)}`);
    console.log(`  passwordProtection actual: ${JSON.stringify(p.passwordProtection)}`);
    break;
  }
}

if (!found) {
  console.error(`\nNo se encontró el proyecto ${PROJECT}.`);
  process.exit(1);
}

const patch = await api(found.path, {
  method: 'PATCH',
  body: JSON.stringify({ ssoProtection: null, passwordProtection: null }),
});

if (!patch.ok) {
  console.error(`\nNo se pudo actualizar (${patch.status}):`);
  console.error(JSON.stringify(patch.body).slice(0, 500));
  process.exit(1);
}

const after = patch.body as { ssoProtection?: unknown; passwordProtection?: unknown };
console.log('\nDespués:');
console.log(`  ssoProtection:      ${JSON.stringify(after.ssoProtection)}`);
console.log(`  passwordProtection: ${JSON.stringify(after.passwordProtection)}`);
console.log('\nEl despliegue ya es público.\n');
