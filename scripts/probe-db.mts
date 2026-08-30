import { config } from 'dotenv';
import { Client, type ClientConfig } from 'pg';

config({ path: ['.env.local'], quiet: true });

const url = new URL(process.env.DATABASE_URL!);
const base = {
  host: url.hostname,
  port: Number(url.port),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: url.pathname.slice(1),
};

console.log(`host=${base.host} port=${base.port} user=${base.user} db=${base.database}`);
console.log(`password: ${base.password.length} caracteres\n`);

const variants: Array<[string, ClientConfig]> = [
  ['params + ssl no-verify', { ...base, ssl: { rejectUnauthorized: false } }],
  ['params + ssl require', { ...base, ssl: true }],
  ['params sin ssl', { ...base, ssl: false }],
  ['puerto 6543 (transaction pooler)', { ...base, port: 6543, ssl: { rejectUnauthorized: false } }],
];

for (const [name, cfg] of variants) {
  const c = new Client({ ...cfg, connectionTimeoutMillis: 12000 });
  try {
    await c.connect();
    const { rows } = await c.query('select current_database() db, version() v');
    console.log(`OK    ${name}`);
    console.log(`      ${rows[0].db} · ${String(rows[0].v).slice(0, 40)}…`);
    await c.end();
    process.exit(0);
  } catch (e) {
    console.log(`FALLA ${name}: ${(e as Error).message}`);
    await c.end().catch(() => {});
  }
}

console.log('\nNinguna variante conectó.');
process.exit(1);
