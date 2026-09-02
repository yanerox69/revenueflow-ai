import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ingestVoiceNote } from '@/lib/ingest/voice-note';
import { handleVoiceNote } from '@/lib/agent/handle-voice-note';
import { extraerIp, verificarLimites, verificarTamaño } from '@/lib/limits';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Entrada por navegador: el mismo pipeline que el webhook de WhatsApp.
 *
 * Responde en STREAMING (NDJSON, un evento por línea). El proceso completo
 * tarda entre 8 y 25 segundos —transcripción más modelo— y dejar al usuario
 * mirando un spinner todo ese rato hace pensar que se colgó. Así la
 * transcripción aparece en cuanto está lista y la cita llega después.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('No autenticado.', 401);

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  if (!profile) return fail('Tu cuenta no tiene negocio.', 403);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('Se esperaba multipart/form-data.', 400);
  }

  const audio = form.get('audio');
  const fromPhone = String(form.get('from') ?? '').trim();

  if (!(audio instanceof File)) return fail('Falta el archivo de audio.', 400);
  if (audio.size === 0) return fail('El audio está vacío.', 400);
  if (!fromPhone) return fail('Falta el teléfono del remitente.', 400);

  // El tamaño se comprueba ANTES de leer el archivo en memoria.
  const tamaño = verificarTamaño(audio.size);
  if (!tamaño.permitido) return fail(tamaño.mensaje!, 413);

  // Y los contadores antes de gastar un crédito de transcripción.
  const limite = await verificarLimites(profile.tenant_id, extraerIp(request));
  if (!limite.permitido) {
    return fail(limite.mensaje!, 429, {
      'retry-after': String(limite.reintentarEn ?? 60),
    });
  }

  const bytes = await audio.arrayBuffer();
  const contentType = audio.type || 'audio/webm';
  const tenantId = profile.tenant_id;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));

      try {
        send({ stage: 'TRANSCRIBING' });

        const ingest = await ingestVoiceNote({
          tenantId,
          fromPhone,
          audio: bytes,
          contentType,
          externalId: `web:${crypto.randomUUID()}`,
          channel: 'web',
        });

        send({
          stage: 'TRANSCRIBED',
          transcription: ingest.transcription,
          detectedLanguage: ingest.detectedLanguage,
          confidence: ingest.confidence,
          durationSeconds: ingest.durationSeconds,
          languageMismatch: ingest.languageMismatch,
        });

        if (!ingest.transcription) {
          send({ stage: 'DONE', agent: null });
          controller.close();
          return;
        }

        send({ stage: 'UNDERSTANDING' });

        const agent = await handleVoiceNote(
          {
            tenantId,
            contactId: ingest.contactId,
            conversationId: ingest.conversationId,
            messageId: ingest.messageId,
            transcription: ingest.transcription,
            detectedLanguage: ingest.detectedLanguage,
            languageConfidence: ingest.languageConfidence,
          },
          { onIntent: () => send({ stage: 'SCHEDULING' }) },
        );

        send({ stage: 'DONE', agent });
      } catch (e) {
        const message = (e as Error).message;
        console.error('[voice] fallo de ingesta:', message);

        // El teléfono inválido es error del usuario, no del servidor.
        send({
          stage: 'ERROR',
          error: message.includes('inválido')
            ? message
            : 'No se pudo procesar el audio.',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      // Sin esto, un proxy puede acumular la respuesta y anular el streaming.
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}

/** Los errores previos al stream salen como JSON normal. */
function fail(
  error: string,
  status: number,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ stage: 'ERROR', error }), {
    status,
    headers: { 'content-type': 'application/json', ...extra },
  });
}
