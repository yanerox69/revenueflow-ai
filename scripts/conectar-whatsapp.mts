/**
 * Asocia un número de WhatsApp Business a un negocio.
 *
 * El webhook enruta cada mensaje entrante al tenant cuyo
 * `whatsapp_phone_number_id` coincide con el del payload de Meta.
 * Sin esta asociación, los mensajes llegan y se descartan.
 *
 *   npx tsx scripts/conectar-whatsapp.mts <phone_number_id> [VE|BR]
 */
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
config({ path: ['.env.local'], quiet: true });

const [phoneNumberId, pais = 'VE'] = process.argv.slice(2);

if (!phoneNumberId) {
  console.error(
    '\nUso: npx tsx scripts/conectar-whatsapp.mts <phone_number_id> [VE|BR]\n\n' +
      'El phone_number_id está en Meta for Developers →\n' +
      'tu app → WhatsApp → API Setup → "Phone number ID".\n' +
      'Es un número largo, NO el teléfono.\n',
  );
  process.exit(1);
}

if (!/^\d{6,}$/.test(phoneNumberId)) {
  console.error(
    `\n"${phoneNumberId}" no parece un Phone number ID.\n` +
      'Es una cadena de solo dígitos, larga. Si copiaste el teléfono\n' +
      '(+1 555…), ese no es. Busca el campo "Phone number ID".\n',
  );
  process.exit(1);
}

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const { data: tenant } = await db
  .from('tenants')
  .select('id, name, country_code')
  .eq('is_demo', true)
  .eq('country_code', pais)
  .maybeSingle();

if (!tenant) {
  console.error(`\nNo hay negocio demo para ${pais}. Corre: npm run seed\n`);
  process.exit(1);
}

// Un número solo puede pertenecer a un negocio: si estaba en otro, se libera.
await db
  .from('tenant_settings')
  .update({ whatsapp_phone_number_id: null })
  .eq('whatsapp_phone_number_id', phoneNumberId);

const { error } = await db
  .from('tenant_settings')
  .update({ whatsapp_phone_number_id: phoneNumberId })
  .eq('tenant_id', tenant.id);

if (error) {
  console.error(`\nNo se pudo asociar: ${error.message}\n`);
  process.exit(1);
}

console.log(`\n  ${tenant.name} (${tenant.country_code})`);
console.log(`  ← número ${phoneNumberId}\n`);
console.log('Los mensajes que lleguen a ese número entrarán a este negocio.\n');
