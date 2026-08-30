/**
 * Concatena las migraciones en un solo archivo aplicable.
 * UTF-8 sin BOM, sin depender del encoding por defecto de la shell.
 *   npm run build:sql
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const DIR = path.resolve('supabase', 'migrations');
const OUT = path.resolve('supabase', 'APLICAR-TODO.sql');

const files = readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

const parts = [
  '-- =====================================================================',
  '-- RevenueFlow · TODAS LAS MIGRACIONES EN UN SOLO ARCHIVO',
  '-- Generado por: npm run build:sql — no editar a mano.',
  '-- =====================================================================',
];

for (const f of files) {
  parts.push('', `-- ===== ${f} =====`, '', readFileSync(path.join(DIR, f), 'utf8'));
}

writeFileSync(OUT, parts.join('\n'), { encoding: 'utf8' });
console.log(`${files.length} migraciones → ${OUT}`);
