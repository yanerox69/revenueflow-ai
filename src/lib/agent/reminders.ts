import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getPack } from '@/lib/country';
import { composeFollowUp, composeReminder } from './reply';
import { describeSlot } from './scheduling';
import { sendWhatsAppText } from '@/lib/messaging/whatsapp';

/** Se avisa de las citas que caen dentro de esta ventana hacia adelante. */
const VENTANA_RECORDATORIO_HORAS = 36;

/**
 * Margen tras el fin de la cita antes de mandar el seguimiento.
 * Suficiente para que nadie lo reciba mientras aún está en el sillón.
 */
const MARGEN_SEGUIMIENTO_HORAS = 3;

export interface ResultadoTanda {
  recordatorios: number;
  seguimientos: number;
  errores: string[];
}

interface CitaPendiente {
  id: string;
  tenant_id: string;
  starts_at: string;
  contacts: { phone_e164: string } | null;
  services: { name: string } | null;
  tenants: { country_code: string; locale: string } | null;
}

/**
 * Procesa una tanda de recordatorios y seguimientos.
 *
 * Es idempotente: cada envío marca su columna de fecha, así que correrlo
 * mil veces no duplica mensajes. Eso importa porque un cron puede
 * reintentar, y un cliente que recibe el mismo recordatorio tres veces
 * cancela la cita.
 */
export async function procesarRecordatorios(): Promise<ResultadoTanda> {
  const db = createSupabaseAdminClient();
  const errores: string[] = [];
  const ahora = new Date();

  // ---- Recordatorios: citas próximas sin avisar --------------------------
  const limite = new Date(ahora.getTime() + VENTANA_RECORDATORIO_HORAS * 3_600_000);

  const { data: proximas } = await db
    .from('appointments')
    .select(
      'id, tenant_id, starts_at, contacts(phone_e164), services(name), tenants(country_code, locale)',
    )
    .in('status', ['SCHEDULED', 'CONFIRMED'])
    .is('reminder_sent_at', null)
    .gt('starts_at', ahora.toISOString())
    .lte('starts_at', limite.toISOString())
    .limit(200);

  let recordatorios = 0;

  for (const cita of (proximas ?? []) as unknown as CitaPendiente[]) {
    try {
      const { pack, servicio, telefono } = datosDe(cita);
      const cuando = describeSlot(
        new Date(cita.starts_at),
        pack.timezone,
        cita.tenants!.locale,
      );

      await enviarYRegistrar(
        db,
        cita,
        composeReminder(servicio, cuando, pack),
        telefono,
        'reminder_sent_at',
      );
      recordatorios++;
    } catch (e) {
      errores.push(`recordatorio ${cita.id}: ${(e as Error).message}`);
    }
  }

  // ---- Seguimientos: citas ya pasadas sin seguimiento --------------------
  const corte = new Date(ahora.getTime() - MARGEN_SEGUIMIENTO_HORAS * 3_600_000);

  const { data: pasadas } = await db
    .from('appointments')
    .select(
      'id, tenant_id, starts_at, contacts(phone_e164), services(name), tenants(country_code, locale)',
    )
    .is('follow_up_sent_at', null)
    .not('status', 'eq', 'CANCELLED')
    .lt('ends_at', corte.toISOString())
    .limit(200);

  let seguimientos = 0;

  for (const cita of (pasadas ?? []) as unknown as CitaPendiente[]) {
    try {
      const { pack, servicio, telefono } = datosDe(cita);

      await enviarYRegistrar(
        db,
        cita,
        composeFollowUp(servicio, pack),
        telefono,
        'follow_up_sent_at',
      );
      seguimientos++;
    } catch (e) {
      errores.push(`seguimiento ${cita.id}: ${(e as Error).message}`);
    }
  }

  return { recordatorios, seguimientos, errores };
}

type Db = ReturnType<typeof createSupabaseAdminClient>;

function datosDe(cita: CitaPendiente) {
  if (!cita.tenants) throw new Error('cita sin tenant');
  if (!cita.contacts?.phone_e164) throw new Error('contacto sin teléfono');

  return {
    pack: getPack(cita.tenants.country_code),
    servicio: cita.services?.name ?? 'tu cita',
    telefono: cita.contacts.phone_e164,
  };
}

/**
 * Marca ANTES de enviar.
 *
 * Si se enviara primero y el proceso muriera justo después, la siguiente
 * tanda volvería a mandar el mismo mensaje. Es preferible perder un
 * recordatorio que mandar tres.
 */
async function enviarYRegistrar(
  db: Db,
  cita: CitaPendiente,
  texto: string,
  telefono: string,
  columna: 'reminder_sent_at' | 'follow_up_sent_at',
): Promise<void> {
  const { error } = await db
    .from('appointments')
    .update({ [columna]: new Date().toISOString() })
    .eq('id', cita.id)
    .is(columna, null); // no pisar si otra tanda ya lo tomó

  if (error) throw new Error(error.message);

  const { data: settings } = await db
    .from('tenant_settings')
    .select('whatsapp_phone_number_id')
    .eq('tenant_id', cita.tenant_id)
    .maybeSingle();

  const entrega = await sendWhatsAppText(
    settings?.whatsapp_phone_number_id ?? null,
    telefono,
    texto,
  );

  // El mensaje queda en el CRM aunque WhatsApp no esté conectado: el negocio
  // ve qué se le dijo al cliente.
  const { data: conv } = await db
    .from('conversations')
    .select('id')
    .eq('tenant_id', cita.tenant_id)
    .eq('status', 'OPEN')
    .limit(1)
    .maybeSingle();

  if (conv) {
    await db.from('messages').insert({
      tenant_id: cita.tenant_id,
      conversation_id: conv.id,
      direction: 'OUT',
      body: texto,
      external_id: entrega.externalId ?? null,
    });
  }

  await db.from('usage_events').insert({
    tenant_id: cita.tenant_id,
    kind: columna === 'reminder_sent_at' ? 'reminder_sent' : 'follow_up_sent',
    quantity: 1,
    unit: 'message',
  });
}
