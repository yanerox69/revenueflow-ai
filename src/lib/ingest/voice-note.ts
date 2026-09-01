import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getPack } from '@/lib/country';
import { AssemblyAITranscriber } from '@/lib/voice/assemblyai';
import { buildVoiceContext } from '@/lib/voice/context';
import { TranscriptionError, type Transcriber } from '@/lib/voice/types';

export interface IncomingVoiceNote {
  tenantId: string;
  /** Teléfono del remitente en cualquier formato local. */
  fromPhone: string;
  audio: ArrayBuffer | Uint8Array;
  contentType?: string;
  /**
   * Id del proveedor. Es la clave de idempotencia: WhatsApp reintenta los
   * webhooks y sin esto el mismo audio se transcribiría (y cobraría) dos veces.
   */
  externalId: string;
  senderName?: string;
  channel?: string;
}

export interface IncomingText {
  tenantId: string;
  fromPhone: string;
  text: string;
  externalId: string;
  senderName?: string;
  channel?: string;
}

export interface IngestResult {
  duplicate: boolean;
  messageId: string;
  conversationId: string;
  contactId: string;
  /**
   * El texto que leerá el agente. Viene de la transcripción si era audio,
   * o tal cual si el cliente escribió.
   */
  transcription: string | null;
  detectedLanguage: string | null;
  confidence: number | null;
  durationSeconds: number | null;
  languageMismatch: boolean;
}

/**
 * Recibe un mensaje escrito.
 *
 * Comparte contacto y conversación con las notas de voz: para el agente y
 * para el CRM, un cliente que escribe y uno que habla son el mismo cliente
 * en el mismo hilo. Lo único que cambia es que aquí no hay nada que
 * transcribir, así que no cuesta un crédito.
 */
export async function ingestTextMessage(msg: IncomingText): Promise<IngestResult> {
  const db = createSupabaseAdminClient();

  const { data: tenant, error: tenantError } = await db
    .from('tenants')
    .select('id, country_code')
    .eq('id', msg.tenantId)
    .single();

  if (tenantError || !tenant) throw new Error(`Tenant desconocido: ${msg.tenantId}`);

  const pack = getPack(tenant.country_code);
  const phone = pack.normalizePhone(msg.fromPhone);

  const { data: existing } = await db
    .from('messages')
    .select('id, conversation_id, body')
    .eq('tenant_id', tenant.id)
    .eq('external_id', msg.externalId)
    .maybeSingle();

  if (existing) {
    const { data: conv } = await db
      .from('conversations')
      .select('contact_id')
      .eq('id', existing.conversation_id)
      .single();

    return {
      duplicate: true,
      messageId: existing.id,
      conversationId: existing.conversation_id,
      contactId: conv?.contact_id ?? '',
      transcription: existing.body,
      detectedLanguage: null,
      confidence: null,
      durationSeconds: null,
      languageMismatch: false,
    };
  }

  const contactId = await upsertContact(db, tenant.id, phone, pack.locale, msg.senderName);
  const conversationId = await openConversation(
    db, tenant.id, contactId, msg.channel ?? 'whatsapp',
  );

  const texto = msg.text.trim();

  const { data: message, error } = await db
    .from('messages')
    .insert({
      tenant_id: tenant.id,
      conversation_id: conversationId,
      direction: 'IN',
      external_id: msg.externalId,
      body: texto,
    })
    .select('id')
    .single();

  if (error || !message) {
    throw new Error(`No se pudo registrar el mensaje: ${error?.message}`);
  }

  await db
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  await db.from('usage_events').insert({
    tenant_id: tenant.id,
    kind: 'text_message',
    quantity: 1,
    unit: 'message',
  });

  return {
    duplicate: false,
    messageId: message.id,
    conversationId,
    contactId,
    transcription: texto || null,
    detectedLanguage: null,
    confidence: null,
    durationSeconds: null,
    languageMismatch: false,
  };
}

/**
 * Recibe una nota de voz, la transcribe y la deja registrada en el CRM.
 *
 * Es el único camino de entrada: lo usan tanto el webhook de WhatsApp como el
 * grabador del navegador. Un solo pipeline, dos puertas.
 */
export async function ingestVoiceNote(
  note: IncomingVoiceNote,
  transcriber: Transcriber = new AssemblyAITranscriber(),
): Promise<IngestResult> {
  const db = createSupabaseAdminClient();

  const { data: tenant, error: tenantError } = await db
    .from('tenants')
    .select('id, name, country_code, vertical')
    .eq('id', note.tenantId)
    .single();

  if (tenantError || !tenant) {
    throw new Error(`Tenant desconocido: ${note.tenantId}`);
  }

  const pack = getPack(tenant.country_code);
  const phone = pack.normalizePhone(note.fromPhone);

  // --- Idempotencia: si ya vimos este mensaje, no volvemos a transcribir ----
  const { data: existing } = await db
    .from('messages')
    .select('id, conversation_id, transcription, detected_language, transcription_confidence, duration_seconds')
    .eq('tenant_id', tenant.id)
    .eq('external_id', note.externalId)
    .maybeSingle();

  if (existing) {
    const { data: conv } = await db
      .from('conversations')
      .select('contact_id')
      .eq('id', existing.conversation_id)
      .single();

    return {
      duplicate: true,
      messageId: existing.id,
      conversationId: existing.conversation_id,
      contactId: conv?.contact_id ?? '',
      transcription: existing.transcription,
      detectedLanguage: existing.detected_language,
      confidence: existing.transcription_confidence,
      durationSeconds: existing.duration_seconds,
      languageMismatch: false,
    };
  }

  const contactId = await upsertContact(db, tenant.id, phone, pack.locale, note.senderName);
  const conversationId = await openConversation(db, tenant.id, contactId, note.channel ?? 'whatsapp');

  // --- El mensaje se guarda ANTES de transcribir -----------------------------
  // Si la transcripción falla, el audio del cliente no se pierde.
  const { data: message, error: msgError } = await db
    .from('messages')
    .insert({
      tenant_id: tenant.id,
      conversation_id: conversationId,
      direction: 'IN',
      external_id: note.externalId,
      media_mime: note.contentType,
      transcription_status: 'PROCESSING',
    })
    .select('id')
    .single();

  if (msgError || !message) {
    throw new Error(`No se pudo registrar el mensaje: ${msgError?.message}`);
  }

  try {
    // Los servicios reales del negocio se pasan como términos a favorecer.
    // "Limpieza dental" o "Blanqueamiento" son justo las palabras que el
    // modelo tiene que acertar, y ya las tenemos en la base.
    const { data: services } = await db
      .from('services')
      .select('name')
      .eq('tenant_id', tenant.id);

    const context = buildVoiceContext({
      pack,
      vertical: tenant.vertical,
      businessName: tenant.name,
      serviceNames: (services ?? []).map((s) => s.name),
    });

    const result = await transcriber.transcribe({
      audio: note.audio,
      language: pack.speechLanguage,
      speechModels: pack.speechModels,
      contentType: note.contentType,
      prompt: context.prompt,
      keyterms: context.keyterms,
    });

    // El proveedor puede detectar un idioma distinto al del país del tenant.
    // No es un error: un cliente brasileño puede escribirle a un negocio
    // venezolano. Se marca para que el agente responda en el idioma correcto.
    const languageMismatch =
      result.detectedLanguage != null &&
      !result.detectedLanguage.startsWith(pack.speechLanguage);

    await db
      .from('messages')
      .update({
        body: result.text,
        transcription: result.text,
        transcription_status: 'DONE',
        transcription_confidence: result.confidence,
        detected_language: result.detectedLanguage,
        duration_seconds: result.durationSeconds,
        provider_job_id: result.providerJobId,
      })
      .eq('id', message.id);

    await db.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversationId);

    // Medir el audio procesado: es el rubro que más rápido se desborda.
    if (result.durationSeconds) {
      await db.from('usage_events').insert({
        tenant_id: tenant.id,
        kind: 'voice_transcription',
        quantity: result.durationSeconds,
        unit: 'seconds',
      });
    }

    return {
      duplicate: false,
      messageId: message.id,
      conversationId,
      contactId,
      transcription: result.text,
      detectedLanguage: result.detectedLanguage,
      confidence: result.confidence,
      durationSeconds: result.durationSeconds,
      languageMismatch,
    };
  } catch (e) {
    const err = e as TranscriptionError;
    await db
      .from('messages')
      .update({
        transcription_status: 'FAILED',
        transcription_error: err.message.slice(0, 500),
        provider_job_id: err.providerJobId ?? null,
      })
      .eq('id', message.id);

    throw e;
  }
}

type Db = ReturnType<typeof createSupabaseAdminClient>;

async function upsertContact(
  db: Db,
  tenantId: string,
  phone: string,
  locale: string,
  name?: string,
): Promise<string> {
  const { data: found } = await db
    .from('contacts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('phone_e164', phone)
    .maybeSingle();

  if (found) return found.id;

  const { data, error } = await db
    .from('contacts')
    .insert({
      tenant_id: tenantId,
      name: name?.trim() || phone,
      phone_e164: phone,
      preferred_locale: locale,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(`No se pudo crear el contacto: ${error?.message}`);
  return data.id;
}

async function openConversation(
  db: Db,
  tenantId: string,
  contactId: string,
  channel: string,
): Promise<string> {
  const { data: open } = await db
    .from('conversations')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('contact_id', contactId)
    .eq('status', 'OPEN')
    .maybeSingle();

  if (open) return open.id;

  const { data, error } = await db
    .from('conversations')
    .insert({
      tenant_id: tenantId,
      contact_id: contactId,
      channel,
      status: 'OPEN',
      ai_mode: 'AI',
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(`No se pudo abrir la conversación: ${error?.message}`);
  return data.id;
}
