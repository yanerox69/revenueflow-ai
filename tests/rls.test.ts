/**
 * Tests 1–5 · Aislamiento entre tenants.
 *
 * Requieren un proyecto Supabase real con las migraciones aplicadas.
 * Sin variables de entorno se marcan como SKIP en vez de dar un falso verde.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: ['.env.local', '.env'], quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(URL && ANON && SERVICE);

const OWNER_VE = { email: 'owner.ve@demo.local', password: 'demo-Passw0rd!' };
const OWNER_BR = { email: 'owner.br@demo.local', password: 'demo-Passw0rd!' };

// Estos tests salen a la red. Un corte puntual no es un fallo de aislamiento,
// y un rojo intermitente hace que dejes de creerte los verdes.
describe.skipIf(!configured)('Aislamiento entre tenants', { retry: 2 }, () => {
  let admin: SupabaseClient;
  let asVe: SupabaseClient;
  let tenantVe: string;
  let tenantBr: string;

  beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: tenants } = await admin
      .from('tenants')
      .select('id, country_code')
      .eq('is_demo', true);

    const ve = tenants?.find((t) => t.country_code === 'VE');
    const br = tenants?.find((t) => t.country_code === 'BR');
    if (!ve || !br) throw new Error('Falta el seed. Corre: npm run seed');

    tenantVe = ve.id;
    tenantBr = br.id;

    asVe = createClient(URL!, ANON!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await asVe.auth.signInWithPassword(OWNER_VE);
    if (error) throw new Error(`No se pudo autenticar: ${error.message}`);
  });

  it('Test 1 · el usuario solo ve los leads de su tenant', async () => {
    const { data, error } = await asVe.from('leads').select('id, tenant_id');
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((r) => r.tenant_id === tenantVe)).toBe(true);
  });

  it('Test 2 · pedir por id un lead de otro tenant devuelve 0 filas', async () => {
    const { data: ajenos } = await admin
      .from('leads')
      .select('id')
      .eq('tenant_id', tenantBr)
      .limit(1);

    const { data } = await asVe.from('leads').select('id').eq('id', ajenos![0].id);
    expect(data).toEqual([]);
  });

  it('Test 3 · insertar con tenant_id ajeno es rechazado por RLS', async () => {
    const { error } = await asVe.from('contacts').insert({
      tenant_id: tenantBr,
      name: 'Intruso',
      phone_e164: '+5511999999999',
    });
    expect(error).not.toBeNull();
  });

  it('Test 4 · el registro es atómico: no deja tenants huérfanos', async () => {
    const { data } = await admin.rpc('register_tenant', {
      p_user_id: '00000000-0000-0000-0000-000000000000', // no existe en auth.users
      p_email: 'huerfano@demo.local',
      p_full_name: 'Huérfano',
      p_business_name: 'Tenant Fantasma',
      p_country_code: 'VE',
      p_locale: 'es-VE',
      p_timezone: 'America/Caracas',
      p_primary_currency: 'VES',
      p_display_currency: 'USD',
      p_fx_source: 'BCV',
      p_tax_id_kind: 'RIF',
    });

    // La FK contra auth.users debe abortar toda la transacción.
    expect(data).toBeNull();

    const { data: fantasma } = await admin
      .from('tenants')
      .select('id')
      .eq('name', 'Tenant Fantasma');
    expect(fantasma).toEqual([]);
  });

  it('Test 5 · no existe ninguna tabla sin RLS activa', async () => {
    const { data, error } = await admin.rpc('tables_without_rls');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
