/**
 * Aplica las migraciones directamente contra Postgres.
 * Evita el copiar-pegar en el SQL Editor, que ya nos falló una vez.
 *
 * Requiere DATABASE_URL en .env.local:
 *   Supabase → Connect → Session pooler → URI
 *
 *   npm run migrate
 */
import { config } from 'dotenv';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';

config({ path: ['.env.local', '.env'], quiet: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    '\nFalta DATABASE_URL en .env.local.\n' +
      'Supabase → Connect → Session pooler → copia la URI y reemplaza\n' +
      '[YOUR-PASSWORD] por la contraseña de tu base de datos.\n',
  );
  process.exit(1);
}

const DIR = path.resolve('supabase', 'migrations');
const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

const client = new Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('Conectado.\n');

  // RLS desde el nacimiento: esta tabla vive en `public` y PostgREST la
  // expondría. Sin políticas, nadie la lee por la API.
  await client.query(`
    create table if not exists _migrations (
      name       text primary key,
      applied_at timestamptz not null default now()
    );
    alter table _migrations enable row level security;
    alter table _migrations force row level security;
    revoke all on table _migrations from anon, authenticated;
  `);

  const { rows } = await client.query<{ name: string }>('select name from _migrations');
  const applied = new Set(rows.map((r) => r.name));

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  omitida  ${file} (ya aplicada)`);
      continue;
    }

    const sql = readFileSync(path.join(DIR, file), 'utf8');
    process.stdout.write(`  aplicando ${file} … `);

    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into _migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log('OK');
    } catch (e) {
      await client.query('rollback');
      console.log('FALLÓ\n');
      console.error(`  ${(e as Error).message}\n`);
      console.error('  Nada se aplicó de este archivo (rollback).');
      await client.end();
      process.exit(1);
    }
  }

  // PostgREST cachea el esquema; sin esto la API sigue sin ver las tablas.
  // El transaction pooler puede no propagar NOTIFY: no es fatal, Supabase
  // también recarga por event trigger al detectar DDL.
  try {
    await client.query(`notify pgrst, 'reload schema'`);
    console.log('\nEsquema recargado en PostgREST.');
  } catch {
    console.log('\nNo se pudo enviar NOTIFY (pooler). El caché se recarga solo.');
  }

  await client.end();
  console.log('Listo. Corre: npm run doctor\n');
}

main().catch(async (e) => {
  console.error('\nError:', (e as Error).message, '\n');
  await client.end().catch(() => {});
  process.exit(1);
});
