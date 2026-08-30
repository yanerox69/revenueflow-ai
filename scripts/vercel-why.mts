import { config } from 'dotenv';
config({ path: ['.env.local'], quiet: true });

const TOKEN = process.env.VERCEL_TOKEN!;
const auth = { Authorization: `Bearer ${TOKEN}` };

async function api(path: string) {
  const res = await fetch(`https://api.vercel.com${path}`, { headers: auth });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

const user = await api('/v2/user');
const u = (user.body as { user?: Record<string, unknown> }).user ?? {};
console.log('\n=== CUENTA ===');
for (const k of ['username', 'email', 'version', 'billing', 'blocked', 'blockReason', 'softBlock', 'stagingPrefix']) {
  if (k in u) console.log(`  ${k.padEnd(14)} ${JSON.stringify(u[k])}`);
}

const dep = await api('/v13/deployments/dpl_AcVh2rFurYZiMgyKMZdgEW8w2TKQ');
const d = dep.body as Record<string, unknown>;
console.log('\n=== DESPLIEGUE ===');
for (const k of ['readyState', 'readySubstate', 'errorCode', 'errorMessage', 'errorStep', 'source', 'target']) {
  if (k in d) console.log(`  ${k.padEnd(14)} ${JSON.stringify(d[k])}`);
}

console.log('\n=== CRUDO (por si hay pistas) ===');
console.log(JSON.stringify(d).slice(0, 900));
console.log();
