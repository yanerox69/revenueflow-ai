import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getPack, type CountryPack } from '@/lib/country';
import { extractIntent, type ExtractedIntent, type Turno } from './intent';
import { composeReply } from './reply';
import {
  idiomaDelPais,
  localeDe,
  normalizarIdioma,
  resolverIdioma,
  type Idioma,
} from './idioma';
import { sendWhatsAppText, type DeliveryStatus } from '@/lib/messaging/whatsapp';
import {
  describeSlot,
  findSlots,
  localParts,
  minutosDelDia,
  ordenarPorCercania,
  resolveTargetDay,
  type AvailabilityRule,
} from './scheduling';

/** Hasta dónde buscamos hacia adelante si el día pedido está lleno. */
const SEARCH_HORIZON_DAYS = 14;

export type AgentOutcome =
  | { kind: 'BOOKED'; appointmentId: string; startsAt: string; label: string; serviceName: string }
  | { kind: 'RESCHEDULED'; appointmentId: string; startsAt: string; label: string; serviceName: string }
  | { kind: 'CONFIRMED'; appointmentId: string; label: string; serviceName: string }
  | { kind: 'CANCELLED'; appointmentId: string; serviceName: string }
  | { kind: 'NO_APPOINTMENT' }
  | { kind: 'NO_AVAILABILITY'; serviceName: string }
  | { kind: 'NEEDS_HUMAN'; reason: string }
  | { kind: 'NO_ACTION'; reason: string };

/** Cuántos turnos anteriores se le muestran al modelo. */
const TURNOS_DE_CONTEXTO = 8;

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
  /** En qué idioma se le acabó respondiendo. */
  idioma: Idioma;
}

export interface HandleInput {
  tenantId: string;
  contactId: string;
  conversationId: string;
  messageId: string;
  transcription: string;
  /** Lo que detectó el transcriptor. Ausente si el cliente escribió. */
  detectedLanguage?: string | null;
  languageConfidence?: number | null;
}

export interface HandleOptions {
  /**
   * Se llama en cuanto el modelo termina de interpretar, antes de buscar
   * disponibilidad. Permite mostrarle avance al usuario en vez de dejarlo
   * mirando un spinner durante todo el proceso.
   */
  onIntent?: (intent: ExtractedIntent) => void;
}

/**
 * De la transcripción a la cita, y de vuelta al cliente.
 *
 * El modelo decide QUÉ quiere el cliente. El sistema decide qué se PUEDE
 * hacer: el servicio sale del catálogo, la fecha se calcula aquí y el hueco
 * se valida contra la disponibilidad real.
 */
export async function handleVoiceNote(
  input: HandleInput,
  options: HandleOptions = {},
): Promise<AgentResult> {
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

  // Sin esto, "mejor el viernes" no significa nada: el modelo necesita saber
  // qué se habló antes y si este cliente ya tiene una cita.
  const [history, vigente] = await Promise.all([
    cargarHistorial(db, input.conversationId, input.messageId),
    citaVigenteDe(db, tenant.id, input.contactId, pack, tenant.locale, now),
  ]);

  const intent = await extractIntent({
    transcription: input.transcription,
    services: catalog.map((s) => ({ id: s.id, name: s.name })),
    pack,
    nowLocalISO:
      `${local.year}-${pad(local.month)}-${pad(local.day)} ` +
      `${pad(local.hour)}:${pad(local.minute)} (${pack.timezone})`,
    history,
    citaVigente: vigente
      ? { servicio: vigente.servicio, cuando: vigente.label }
      : null,
  });

  options.onIntent?.(intent);

  const idioma = await decidirIdioma(db, input, pack, intent);

  const leadId = await upsertLead(db, input, intent, catalog);
  const outcome = await decide(
    db, input, tenant.id, localeDe(idioma, pack), pack, intent, catalog, leadId, now, vigente,
  );
  const reply = await respond(db, input, tenant.id, pack, outcome, idioma);

  return { intent, outcome, leadId, reply, idioma };
}

/**
 * En qué idioma se le responde a este cliente.
 *
 * Hay dos detectores y no dicen lo mismo. El orden no es arbitrario:
 *
 * 1. **AssemblyAI**, si hubo audio. Es su especialidad y trae una confianza
 *    con la que se puede descartar una detección dudosa.
 * 2. **El modelo**, que es lo único que hay cuando el cliente escribe.
 * 3. **Lo que ya sabíamos del contacto.** Un mensaje de tres palabras
 *    ("mejor el viernes") no da para detectar nada, y sería absurdo cambiarle
 *    el idioma a mitad de conversación por eso.
 * 4. **El idioma del país**, que es el que el negocio sabe atender.
 */
async function decidirIdioma(
  db: Db,
  input: HandleInput,
  pack: CountryPack,
  intent: ExtractedIntent,
): Promise<Idioma> {
  const { data: contact } = await db
    .from('contacts')
    .select('language')
    .eq('id', input.contactId)
    .maybeSingle();

  const previo = normalizarIdioma(contact?.language);

  const detectado =
    input.detectedLanguage != null
      ? resolverIdioma({
          detectado: input.detectedLanguage,
          confianza: input.languageConfidence,
          pack,
        })
      : normalizarIdioma(intent.language);

  // `resolverIdioma` ya cae al idioma del país, así que un audio detectado
  // como "el del país" no se distingue de uno sin detectar. Es aceptable: en
  // ambos casos responder en el idioma del país es lo correcto.
  const idioma = detectado ?? previo ?? idiomaDelPais(pack);

  // Se recuerda para los recordatorios, que salen de un cron sin ningún
  // mensaje entrante que mirar.
  if (idioma !== previo) {
    await db.from('contacts').update({ language: idioma }).eq('id', input.contactId);
  }

  return idioma;
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
  vigente: CitaVigenteFila | null,
): Promise<AgentOutcome> {
  if (intent.needs_human) {
    return { kind: 'NEEDS_HUMAN', reason: intent.summary };
  }

  // --- Acciones sobre una cita que ya existe -------------------------------
  if (intent.intent === 'CONFIRMAR' || intent.intent === 'CANCELAR' || intent.intent === 'REAGENDAR') {
    if (!vigente) return { kind: 'NO_APPOINTMENT' };

    if (intent.intent === 'CONFIRMAR') {
      await db
        .from('appointments')
        .update({ status: 'CONFIRMED', confirmed_at: new Date().toISOString() })
        .eq('id', vigente.id);

      return {
        kind: 'CONFIRMED',
        appointmentId: vigente.id,
        // Se vuelve a formatear: `vigente.label` se calculó antes de saber
        // en qué idioma habla el cliente, con el locale del negocio.
        label: describeSlot(new Date(vigente.startsAt), pack.timezone, locale),
        serviceName: vigente.servicio,
      };
    }

    if (intent.intent === 'CANCELAR') {
      await db.from('appointments').update({ status: 'CANCELLED' }).eq('id', vigente.id);
      if (leadId) await db.from('leads').update({ status: 'LOST' }).eq('id', leadId);

      return { kind: 'CANCELLED', appointmentId: vigente.id, serviceName: vigente.servicio };
    }

    // REAGENDAR: se libera el hueco viejo ANTES de buscar el nuevo, para que
    // el propio horario actual vuelva a estar disponible si lo pide.
    await db.from('appointments').update({ status: 'CANCELLED' }).eq('id', vigente.id);

    const slot = await findFirstFreeSlot(
      db, tenantId, pack, intent, vigente.duracion, now,
      minutosDelDia(new Date(vigente.startsAt), pack.timezone),
    );

    if (!slot) {
      // Sin hueco nuevo, se restaura el anterior: peor es dejarlo sin nada.
      await db.from('appointments').update({ status: 'SCHEDULED' }).eq('id', vigente.id);
      return { kind: 'NO_AVAILABILITY', serviceName: vigente.servicio };
    }

    const { data: nueva } = await db
      .from('appointments')
      .insert({
        tenant_id: tenantId,
        contact_id: input.contactId,
        lead_id: leadId,
        service_id: vigente.servicioId,
        starts_at: slot.toISOString(),
        ends_at: new Date(slot.getTime() + vigente.duracion * 60_000).toISOString(),
        status: 'SCHEDULED',
        created_by_ai: true,
        source_message_id: input.messageId,
      })
      .select('id')
      .single();

    if (!nueva) {
      await db.from('appointments').update({ status: 'SCHEDULED' }).eq('id', vigente.id);
      return { kind: 'NO_AVAILABILITY', serviceName: vigente.servicio };
    }

    return {
      kind: 'RESCHEDULED',
      appointmentId: nueva.id,
      startsAt: slot.toISOString(),
      label: describeSlot(slot, pack.timezone, locale),
      serviceName: vigente.servicio,
    };
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
  idioma: Idioma,
): Promise<AgentReply> {
  const text = composeReply(outcome, pack, idioma);

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

interface CitaVigenteFila {
  id: string;
  startsAt: string;
  servicio: string;
  servicioId: string | null;
  duracion: number;
  label: string;
}

/**
 * Los turnos anteriores de la conversación, del más antiguo al más reciente.
 * Se excluye el mensaje que estamos procesando: ya va aparte.
 */
async function cargarHistorial(
  db: Db,
  conversationId: string,
  messageIdActual: string,
): Promise<Turno[]> {
  const { data } = await db
    .from('messages')
    .select('id, direction, body, transcription')
    .eq('conversation_id', conversationId)
    .neq('id', messageIdActual)
    .order('created_at', { ascending: false })
    .limit(TURNOS_DE_CONTEXTO);

  return (data ?? [])
    .reverse()
    .map((m) => ({
      quien: (m.direction === 'IN' ? 'cliente' : 'negocio') as Turno['quien'],
      texto: (m.transcription ?? m.body ?? '').trim(),
    }))
    .filter((t) => t.texto.length > 0);
}

/** La próxima cita del contacto, si tiene alguna. */
async function citaVigenteDe(
  db: Db,
  tenantId: string,
  contactId: string,
  pack: CountryPack,
  locale: string,
  now: Date,
): Promise<CitaVigenteFila | null> {
  const { data } = await db
    .from('appointments')
    .select('id, starts_at, ends_at, service_id, services(name, duration_minutes)')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .in('status', ['SCHEDULED', 'CONFIRMED'])
    .gte('starts_at', now.toISOString())
    .order('starts_at')
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const servicio = data.services as { name?: string; duration_minutes?: number } | null;

  return {
    id: data.id,
    startsAt: data.starts_at,
    servicio: servicio?.name ?? 'tu cita',
    servicioId: data.service_id,
    duracion: servicio?.duration_minutes ?? 60,
    label: describeSlot(new Date(data.starts_at), pack.timezone, locale),
  };
}

async function findFirstFreeSlot(
  db: Db,
  tenantId: string,
  pack: CountryPack,
  intent: ExtractedIntent,
  durationMinutes: number,
  now: Date,
  /** Hora del día a la que acercarse, en minutos. Solo si no pidió franja. */
  minutosPreferidos?: number | null,
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

    if (!slots.length) continue;

    // Sin franja pedida y con una hora de referencia, se prefiere lo cercano.
    return minutosPreferidos != null && intent.period === 'ANY'
      ? ordenarPorCercania(slots, minutosPreferidos, pack.timezone)[0]
      : slots[0];
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
