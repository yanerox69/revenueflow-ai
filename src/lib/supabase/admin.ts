import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente con service_role: ATRAVIESA la RLS.
 *
 * Solo para webhooks server-side, migraciones y el alta de tenants.
 * PROHIBIDO usarlo en cualquier ruta que sirva datos a un usuario:
 * ahí se pierde el aislamiento entre tenants.
 */
export function createSupabaseAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY.');

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
