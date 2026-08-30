/**
 * Seed de desarrollo: dos tenants, uno por país.
 * Corre con:  npm run seed
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getPack } from '../src/lib/country';

config({ path: ['.env.local', '.env'], quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const db = createClient(URL, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PASSWORD = 'demo-Passw0rd!';

const TENANTS = [
  {
    countryCode: 'VE',
    businessName: 'Clínica Dental Sonrisa',
    ownerEmail: 'owner.ve@demo.local',
    ownerName: 'Carla Medina',
    vertical: 'clinica_dental',
    phones: ['0414-1234567', '0424-9876543', '0412-5551234', '0416-3334455'],
    services: [
      ['Limpieza dental', 45, 45_00],
      ['Consulta de valoración', 30, 0],
      ['Blanqueamiento', 90, 180_00],
      ['Extracción simple', 60, 60_00],
    ] as const,
  },
  {
    countryCode: 'BR',
    businessName: 'Studio Bella Estética',
    ownerEmail: 'owner.br@demo.local',
    ownerName: 'Renata Lopes',
    vertical: 'estetica',
    phones: ['(11) 98765-4321', '(21) 99876-5432', '(11) 3456-7890', '(31) 98111-2222'],
    services: [
      ['Limpeza de pele', 60, 189_90],
      ['Design de sobrancelhas', 30, 79_90],
      ['Massagem relaxante', 60, 249_90],
      ['Avaliação', 20, 0],
    ] as const,
  },
];

const FIRST_NAMES = ['Ana', 'Luis', 'Marta', 'Pedro', 'Sofia', 'Bruno', 'Elena', 'Diego'];

async function reset() {
  console.log('Limpiando datos demo previos…');
  const { data: old } = await db.from('tenants').select('id').eq('is_demo', true);
  for (const t of old ?? []) {
    const { data: users } = await db.from('users').select('id').eq('tenant_id', t.id);
    for (const u of users ?? []) await db.auth.admin.deleteUser(u.id);
    await db.from('tenants').delete().eq('id', t.id); // cascada
  }
}

async function seedFxRate() {
  await db.from('fx_rates').upsert(
    {
      country_code: 'VE',
      source: 'BCV',
      rate: 49.2,
      effective_at: new Date().toISOString().slice(0, 10),
    },
    { onConflict: 'country_code,source,effective_at' },
  );
  console.log('Tasa BCV cargada: 49,20');
}

async function seedTenant(spec: (typeof TENANTS)[number]) {
  const pack = getPack(spec.countryCode);

  const { data: auth, error: authErr } = await db.auth.admin.createUser({
    email: spec.ownerEmail,
    password: PASSWORD,
    email_confirm: true,
  });
  if (authErr || !auth.user) throw new Error(`auth: ${authErr?.message}`);

  const { data: tenantId, error: rpcErr } = await db.rpc('register_tenant', {
    p_user_id: auth.user.id,
    p_email: spec.ownerEmail,
    p_full_name: spec.ownerName,
    p_business_name: spec.businessName,
    p_country_code: pack.code,
    p_locale: pack.locale,
    p_timezone: pack.timezone,
    p_primary_currency: pack.primaryCurrency,
    p_display_currency: pack.displayCurrency,
    p_fx_source: pack.fxSource,
    p_tax_id_kind: pack.taxIdKind,
  });
  if (rpcErr) throw new Error(`register_tenant: ${rpcErr.message}`);

  await db.from('tenants').update({ is_demo: true, vertical: spec.vertical }).eq('id', tenantId);

  // Contactos — teléfonos normalizados por el pack, como en producción.
  const contacts = spec.phones.map((raw, i) => ({
    tenant_id: tenantId,
    name: `${FIRST_NAMES[i % FIRST_NAMES.length]} ${spec.countryCode === 'BR' ? 'Silva' : 'Rojas'}`,
    phone_e164: pack.normalizePhone(raw),
    preferred_locale: pack.locale,
    is_demo: true,
  }));
  const { data: inserted, error: cErr } = await db
    .from('contacts')
    .insert(contacts)
    .select('id');
  if (cErr) throw new Error(`contacts: ${cErr.message}`);

  // Leads — con tasa solo si el país usa doble moneda.
  const dual = pack.displayCurrency !== null;
  const leads = inserted!.map((c, i) => ({
    tenant_id: tenantId,
    contact_id: c.id,
    source: 'whatsapp',
    status: (['NEW', 'CONTACTED', 'QUALIFIED', 'BOOKED'] as const)[i % 4],
    urgency: (['NORMAL', 'HIGH', 'NORMAL', 'LOW'] as const)[i % 4],
    service_type: spec.services[i % spec.services.length][0],
    estimated_amount_minor: 150_00 + i * 25_00,
    estimated_currency: pack.primaryCurrency,
    fx_rate: dual ? 49.2 : null,
    fx_source: dual ? pack.fxSource : null,
    fx_at: dual ? new Date().toISOString() : null,
    is_demo: true,
  }));
  const { error: lErr } = await db.from('leads').insert(leads);
  if (lErr) throw new Error(`leads: ${lErr.message}`);

  const { error: sErr } = await db.from('services').insert(
    spec.services.map(([name, minutes, price]) => ({
      tenant_id: tenantId,
      name,
      duration_minutes: minutes,
      price_amount_minor: price,
      price_currency: pack.primaryCurrency,
      is_demo: true,
    })),
  );
  if (sErr) throw new Error(`services: ${sErr.message}`);

  // Lunes a viernes, 8–18, con almuerzo de 12 a 13.
  const rules = [1, 2, 3, 4, 5].flatMap((weekday) => [
    { tenant_id: tenantId, weekday, start_time: '08:00', end_time: '12:00', capacity: 1, is_demo: true },
    { tenant_id: tenantId, weekday, start_time: '13:00', end_time: '18:00', capacity: 1, is_demo: true },
  ]);
  const { error: aErr } = await db.from('availability_rules').insert(rules);
  if (aErr) throw new Error(`availability: ${aErr.message}`);

  console.log(`  ${pack.displayName.padEnd(10)} ${spec.businessName}  (${spec.ownerEmail})`);
}

async function main() {
  await reset();
  await seedFxRate();
  console.log('Creando tenants demo…');
  for (const spec of TENANTS) await seedTenant(spec);
  console.log(`\nListo. Contraseña de ambos: ${PASSWORD}`);
}

main().catch((e) => {
  console.error('\nFalló el seed:', e.message);
  process.exit(1);
});
