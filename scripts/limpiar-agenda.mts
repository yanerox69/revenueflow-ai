/**
 * Libera los horarios entre pruebas, SIN tocar usuarios.
 *
 * Por defecto borra solo las CITAS. El historial de conversación se conserva:
 * es lo que le da memoria al agente, y es la prueba de lo que pasó. Borrarlo
 * por descuido destruye evidencia que no se recupera.
 *
 *   npx tsx scripts/limpiar-agenda.mts          solo citas
 *   npx tsx scripts/limpiar-agenda.mts --todo   también las conversaciones
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: ['.env.local'], quiet: true });

const borrarConversaciones = process.argv.includes('--todo');

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: tenants } = await db.from('tenants').select('id, name');

for (const t of tenants ?? []) {
  const { count: citas } = await db
    .from('appointments')
    .delete({ count: 'exact' })
    .eq('tenant_id', t.id);

  let convs: number | null = null;
  if (borrarConversaciones) {
    const r = await db
      .from('conversations')
      .delete({ count: 'exact' })
      .eq('tenant_id', t.id);
    convs = r.count;
  }

  // Los leads sembrados se conservan; los que tocó el agente vuelven a NEW.
  await db
    .from('leads')
    .update({ status: 'NEW', intent_summary: null, intent_confidence: null })
    .eq('tenant_id', t.id)
    .neq('status', 'NEW');

  console.log(
    `  ${t.name.padEnd(26)} ${citas ?? 0} citas` +
      (convs !== null ? ` · ${convs} conversaciones` : ''),
  );
}

console.log(
  borrarConversaciones
    ? '\nAgenda e historial borrados. Tu sesión del navegador sigue válida.\n'
    : '\nAgenda limpia. El historial de conversación se conserva.\n' +
        'Para borrarlo también: --todo\n',
);
