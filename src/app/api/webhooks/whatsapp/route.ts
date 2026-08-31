import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ingestVoiceNote } from '@/lib/ingest/voice-note';
import { handleVoiceNote } from '@/lib/agent/handle-voice-note';
import { verificarLimites } from '@/lib/limits';

export const runtime = 'nodejs';
export const maxDuration = 60;

const GRAPH = 'https://graph.facebook.com/v22.0';

/** Verificación inicial del webhook: Meta llama con un desafío. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request: Request) {
  // El cuerpo CRUDO es imprescindible: la firma se calcula sobre los bytes
  // exactos. Si se parsea antes, la verificación siempre falla.
  const raw = await request.text();

  if (!verifySignature(raw, request.headers.get('x-hub-signature-256'))) {
    return new Response('Firma inválida', { status: 401 });
  }

  // A Meta se le responde 200 rápido o reintenta y duplica el trabajo.
  // El procesamiento pesado va después de decidir la respuesta.
  let payload: WhatsAppPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true }); // no reintentar basura
  }

  try {
    await processPayload(payload);
  } catch (e) {
    console.error('[whatsapp] fallo procesando:', (e as Error).message);
  }

  return NextResponse.json({ ok: true });
}

function verifySignature(raw: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) {
    console.error('[whatsapp] Falta WHATSAPP_APP_SECRET: se rechaza todo.');
    return false;
  }
  if (!header?.startsWith('sha256=')) return false;

  const expected = createHmac('sha256', secret).update(raw, 'utf8').digest();
  const received = Buffer.from(header.slice('sha256='.length), 'hex');

  // Longitudes distintas hacen que timingSafeEqual lance en vez de devolver false.
  if (received.length !== expected.length) return false;
  return timingSafeEqual(expected, received);
}

async function processPayload(payload: WhatsAppPayload) {
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const tenantId = await resolveTenant(phoneNumberId);
      if (!tenantId) {
        console.warn(`[whatsapp] Número no asociado a ningún tenant: ${phoneNumberId}`);
        continue;
      }

      for (const message of value.messages ?? []) {
        if (message.type !== 'audio' || !message.audio?.id) continue;

        // La firma impide llamadas ajenas, pero un tenant con mucho volumen
        // consume créditos igual. La cuota se aplica también aquí.
        const limite = await verificarLimites(tenantId, 'whatsapp');
        if (!limite.permitido) {
          console.warn(`[whatsapp] cuota alcanzada (${limite.motivo}) en ${tenantId}`);
          continue;
        }

        const contactName = value.contacts?.find((c) => c.wa_id === message.from)?.profile?.name;
        const media = await downloadMedia(message.audio.id);

        const ingest = await ingestVoiceNote({
          tenantId,
          fromPhone: message.from,
          audio: media.bytes,
          contentType: media.mime,
          externalId: message.id, // clave de idempotencia
          senderName: contactName,
          channel: 'whatsapp',
        });

        // Transcribir no basta: el agente tiene que actuar y responder.
        // Un mensaje repetido (idempotencia) ya fue atendido: no se reprocesa.
        if (ingest.transcription && !ingest.duplicate) {
          await handleVoiceNote({
            tenantId,
            contactId: ingest.contactId,
            conversationId: ingest.conversationId,
            messageId: ingest.messageId,
            transcription: ingest.transcription,
          });
        }
      }
    }
  }
}

/** El número de WhatsApp del negocio decide a qué tenant pertenece el mensaje. */
async function resolveTenant(phoneNumberId: string): Promise<string | null> {
  const db = createSupabaseAdminClient();
  const { data } = await db
    .from('tenant_settings')
    .select('tenant_id')
    .eq('whatsapp_phone_number_id', phoneNumberId)
    .maybeSingle();

  return data?.tenant_id ?? null;
}

/** WhatsApp entrega un id; hay que pedir la URL y luego bajar los bytes. */
async function downloadMedia(mediaId: string): Promise<{ bytes: ArrayBuffer; mime: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) throw new Error('Falta WHATSAPP_ACCESS_TOKEN.');

  const metaRes = await fetch(`${GRAPH}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) throw new Error(`No se pudo consultar el medio (${metaRes.status}).`);

  const meta = (await metaRes.json()) as { url: string; mime_type: string };

  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!fileRes.ok) throw new Error(`No se pudo descargar el audio (${fileRes.status}).`);

  return { bytes: await fileRes.arrayBuffer(), mime: meta.mime_type };
}

// ---------------------------------------------------------------------------
interface WhatsAppPayload {
  entry?: Array<{
    changes?: Array<{
      value: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ wa_id: string; profile?: { name?: string } }>;
        messages?: Array<{
          id: string;
          from: string;
          type: string;
          audio?: { id: string; mime_type?: string };
        }>;
      };
    }>;
  }>;
}
