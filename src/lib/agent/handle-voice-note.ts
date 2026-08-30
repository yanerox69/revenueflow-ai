import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getPack, type CountryPack } from '@/lib/country';
import { extractIntent, type ExtractedIntent } from './intent';
import { composeReply } from './reply';
import { sendWhatsAppText, type DeliveryStatus } from '@/lib/messaging/whatsapp';
import {
  describeSlot,
  findSlots,
  localParts,
  resolveTargetDay,
  type AvailabilityRule,
} from './scheduling';

/** Hasta dónde buscamos hacia adelante si el día pedido está lleno. */
const SEARCH_HORIZON_DAYS = 14;

export type AgentOutcome =
  | { kind: 'BOOKED'; appointmentId: string; startsAt: string; label: string; serviceName: string }
  | { kind: 'NO_AVAILABILITY'; serviceName: string }
  | { kind: 'NEEDS_HUMAN'; reason: string }
  | { kind: 'NO_ACTION'; reason: string };

export interface AgentReply {
  text: string;
  delivery: DeliveryStatus;
  deliveryReason?: string;
}

export interface AgentResult {
  intent: ExtractedIntent;
  outcome: AgentOutcome;
  leadId: string | null;
  reply: AgentReply;
}

export interface HandleInput {
  tenantId: string;
  contactId: string;
  conversationId: string;
  messageId: string;
  transcription: string;
}

/**
 * De la transcripción a la cita, y de vuelta al cliente.
 *
 * El modelo decide QUÉ quiere el cliente. El sistema decide qué se PUEDE
 * hacer: el servicio sale del catálogo, la fecha se calcula aquí y el hueco
 * se valida contra la disponibilidad real.
 */
export async function handleVoiceNote(input: HandleInput): Promise<AgentResult> {
  const db = createSupabaseAdminClient();

  const { data: tenant } = await db
    .from('tenants')
    .select('id, country_code, locale')
    .eq('id', input.tenantId)
    .single();

  if (!tenant) throw new Error(`Tenant desconocido: ${input.tenantId}`);
  const pack = getPack(tenant.country_code);

  const { data: services } = await db
    .from('services')
    .select('id, name, duration_minutes')
    .eq('tenant_id', tenant.id);

  const catalog = services ?? [];
  const now = new Date();
  const local = localParts(now, pack.timezone);

  const intent = await extractIntent({
    transcription: input.transcription,
    services: catalog.map((s) => ({ id: s.id, name: s.name })),
    pack,
    nowLocalISO:
      `${local.year}-${pad(local.month)}-${pad(local.day)} ` +
      `${pad(local.hour)}:${pad(local.minute)} (${pack.timezone})`,
  });

  const leadId = await upsertLead(db, input, intent, catalog);
  const outcome = await decide(db, input, tenant.id, tenant.locale, pack, intent, catalog, leadId, now);
  const reply = await respond(db, input, tenant.id, pack, outcome);

  return { intent, outcome, leadId, reply };
}

type Db = ReturnType<typeof createSupabaseAdminClient>;
type Service = { id: string; name: string; duration_minutes: number };

/** Qué se puede hacer con lo que pidió el cliente. */
async function decide(
  db: Db,
  input: HandleInput,
  tenantId: string,
  locale: string,
  pack: CountryPack,
  intent: ExtractedIntent,
  catalog: Service[],
  leadId: string | null,
  now: Date,
): Promise<AgentOutcome> {
  if (intent.needs_human) {
    return { kind: 'NEEDS_HUMAN', reason: intent.summary };
  }
  if (intent.intent !== 'AGENDAR') {
    return { kind: 'NO_ACTION', reason: `Intención detectada: ${intent.intent}` };
  }

  const service = catalog.find((s) => s.id === intent.service_id);
  if (!service) {
    return { kind: 'NEEDS_HUMAN', reason: 'No se identificó el servicio solicitado.' };
  }

  const slot = await findFirstFreeSlot(db, tenantId, pack, intent, service.duration_minutes, now);
  if (!slot) return { kind: 'NO_AVAILABILITY', serviceName: service.name };

  const { data: appointment, error } = await db
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      contact_id: input.contactId,
      lead_id: leadId,
      service_id: service.id,
      starts_at: slot.toISOString(),
      ends_at: new Date(slot.getTime() + service.duration_minutes * 60_000).toISOString(),
      status: 'SCHEDULED',
      created_by_ai: true,
      source_message_id: input.messageId,
    })
    .select('id')
    .single();

  if (error || !appointment) {
    // El índice único rechaza una carrera entre dos audios simultáneos.
    return { kind: 'NO_AVAILABILITY', serviceName: service.name };
  }

  if (leadId) await db.from('leads').update({ status: 'BOOKED' }).eq('id', leadId);

  return {
    kind: 'BOOKED',
    appointmentId: appointment.id,
    startsAt: slot.toISOString(),
    label: describeSlot(slot, pack.timezone, locale),
    serviceName: service.name,
  };
}

/**
 * Redacta, registra y envía la respuesta.
 *
 * El mensaje se guarda en el CRM SIEMPRE, se haya podido entregar o no. Si
 * WhatsApp todavía no está conectado, el negocio ve igual qué se le iba a
 * responder al cliente.
 */
async function respond(
  db: Db,
  input: HandleInput,
  tenantId: string,
  pack: CountryPack,
  outcome: AgentOutcome,
): Promise<AgentReply> {
  const text = composeReply(outcome, pack);

  const [{ data: contact }, { data: settings }] = await Promise.all([
    db.from('contacts').select('phone_e164').eq('id', input.contactId).single(),
    db
      .from('tenant_settings')
      .select('whatsapp_phone_number_id')
      .eq('tenant_id', tenantId)
      .maybeSingle(),
  ]);

  const delivery = contact
    ? await sendWhatsAppText(
        settings?.whatsapp_phone_number_id ?? null,
        contact.phone_e164,
        text,
      )
    : { status: 'FAILED' as const, reason: 'Contacto sin teléfono.' };

  await db.from('messages').insert({
    tenant_id: tenantId,
    conversation_id: input.conversationId,
    direction: 'OUT',
    body: text,
    external_id: delivery.externalId ?? null,
  });

  await db
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', input.conversationId);

  // Una conversación escalada deja de estar en manos de la IA.
  if (outcome.kind === 'NEEDS_HUMAN') {
    await db.from('conversations').update({ ai_mode: 'HUMAN' }).eq('id', input.conversationId);
  }

  return { text, delivery: delivery.status, deliveryReason: delivery.reason };
}

async function findFirstFreeSlot(
  db: Db,
  tenantId: string,
  pack: CountryPack,
  intent: ExtractedIntent,
  durationMinutes: number,
  now: Date,
): Promise<Date | null> {
  const { data: rules } = await db
    .from('availability_rules')
    .select('weekday, start_time, end_time')
    .eq('tenant_id', tenantId);

  if (!rules?.length) return null;

  const { data: booked } = await db
    .from('appointments')
    .select('starts_at')
    .eq('tenant_id', tenantId)
    .gte('starts_at', now.toISOString())
    .in('status', ['SCHEDULED', 'CONFIRMED']);

  const taken = (booked ?? []).map((a) => new Date(a.starts_at));

  // Se intenta el día pedido; si está lleno, se avanza día a día.
  for (let offset = 0; offset < SEARCH_HORIZON_DAYS; offset++) {
    const target = resolveTargetDay(now, pack.timezone, intent.weekday, intent.relative_day, offset);

    const slots = findSlots({
      rules: rules as AvailabilityRule[],
      taken,
      target,
      // Al pasarnos del día pedido dejamos de exigir la franja horaria.
      period: offset === 0 ? intent.period : 'ANY',
      durationMinutes,
      timeZone: pack.timezone,
      now,
    });

    if (slots.length) return slots[0];
  }

  return null;
}

async function upsertLead(
  db: Db,
  input: HandleInput,
  intent: ExtractedIntent,
  catalog: Array<{ id: string; name: string }>,
): Promise<string | null> {
  const serviceName = catalog.find((s) => s.id === intent.service_id)?.name ?? null;

  const { data: existing } = await db
    .from('leads')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .eq('contact_id', input.contactId)
    .not('status', 'in', '("WON","LOST")')
    .maybeSingle();

  const payload = {
    status: 'CONTACTED' as const,
    urgency: intent.urgency,
    service_type: serviceName,
    intent_summary: intent.summary,
    intent_confidence: intent.confidence,
  };

  if (existing) {
    await db.from('leads').update(payload).eq('id', existing.id);
    return existing.id;
  }

  const { data } = await db
    .from('leads')
    .insert({
      tenant_id: input.tenantId,
      contact_id: input.contactId,
      source: 'whatsapp',
      ...payload,
    })
    .select('id')
    .single();

  return data?.id ?? null;
}

const pad = (n: number) => String(n).padStart(2, '0');
