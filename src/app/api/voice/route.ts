import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ingestVoiceNote } from '@/lib/ingest/voice-note';
import { handleVoiceNote } from '@/lib/agent/handle-voice-note';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 16 * 1024 * 1024; // igual que el límite de WhatsApp

/**
 * Entrada por navegador: el mismo pipeline que el webhook de WhatsApp.
 *
 * Existe para que el demo nunca dependa de la aprobación de Meta. Quien mira
 * la pantalla graba su voz y ve el resultado; en producción el audio llega
 * por WhatsApp y recorre exactamente este mismo camino.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'No autenticado.' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Tu cuenta no tiene negocio.' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Se esperaba multipart/form-data.' }, { status: 400 });
  }

  const audio = form.get('audio');
  const fromPhone = String(form.get('from') ?? '').trim();

  if (!(audio instanceof File)) {
    return NextResponse.json({ error: 'Falta el archivo de audio.' }, { status: 400 });
  }
  if (audio.size === 0) {
    return NextResponse.json({ error: 'El audio está vacío.' }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return NextResponse.json({ error: 'El audio supera los 16 MB.' }, { status: 413 });
  }
  if (!fromPhone) {
    return NextResponse.json({ error: 'Falta el teléfono del remitente.' }, { status: 400 });
  }

  try {
    const result = await ingestVoiceNote({
      tenantId: profile.tenant_id,
      fromPhone,
      audio: await audio.arrayBuffer(),
      contentType: audio.type || 'audio/webm',
      externalId: `web:${crypto.randomUUID()}`,
      channel: 'web',
    });

    // Transcribir no basta: el agente tiene que actuar.
    let agent = null;
    if (result.transcription) {
      try {
        agent = await handleVoiceNote({
          tenantId: profile.tenant_id,
          contactId: result.contactId,
          conversationId: result.conversationId,
          messageId: result.messageId,
          transcription: result.transcription,
        });
      } catch (e) {
        // Si el agente falla, la transcripción igual se devuelve: el negocio
        // ve lo que dijo el cliente aunque no se haya agendado nada.
        console.error('[voice] el agente falló:', (e as Error).message);
      }
    }

    return NextResponse.json({ ...result, agent });
  } catch (e) {
    const message = (e as Error).message;

    // El teléfono inválido es error del usuario, no del servidor.
    if (message.includes('inválido')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error('[voice] fallo de ingesta:', message);
    return NextResponse.json(
      { error: 'No se pudo procesar el audio.' },
      { status: 502 },
    );
  }
}
