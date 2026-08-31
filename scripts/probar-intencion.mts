/**
 * Pasa un texto por el extractor de intención y enseña lo que devuelve.
 * Sirve para depurar sin mandar notas de voz.
 *
 *   npx tsx scripts/probar-intencion.mts "el texto del cliente"
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: ['.env.local'], quiet: true });

const texto = process.argv[2];
if (!texto) {
  console.error('Uso: npx tsx scripts/probar-intencion.mts "texto"');
  process.exit(1);
}

const { extractIntent } = await import('../src/lib/agent/intent');
const { getPack } = await import('../src/lib/country');

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const pack = getPack('VE');

const { data: tenant } = await db
  .from('tenants')
  .select('id, name')
  .eq('is_demo', true)
  .eq('country_code', 'VE')
  .single();

const { data: services } = await db
  .from('services')
  .select('id, name')
  .eq('tenant_id', tenant!.id);

console.log(`\nCatálogo (${services?.length ?? 0} servicios):`);
for (const s of services ?? []) console.log(`  ${s.id}  ${s.name}`);

console.log(`\nTexto: "${texto}"\n`);

const intent = await extractIntent({
  transcription: texto,
  services: (services ?? []).map((s) => ({ id: s.id, name: s.name })),
  pack,
  nowLocalISO: '2026-09-01 15:00 (America/Caracas)',
  history: [],
  citaVigente: null,
});

console.log('Intención devuelta:');
console.log(JSON.stringify(intent, null, 2));

const servicio = services?.find((s) => s.id === intent.service_id);
console.log(`\nServicio resuelto: ${servicio?.name ?? '(ninguno)'}`);
console.log(`¿Escala a humano?: ${intent.needs_human ? 'SÍ' : 'no'}\n`);
