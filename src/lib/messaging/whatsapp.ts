import 'server-only';

const GRAPH = 'https://graph.facebook.com/v22.0';

export type DeliveryStatus = 'SENT' | 'SKIPPED' | 'FAILED';

export interface DeliveryResult {
  status: DeliveryStatus;
  externalId?: string;
  reason?: string;
}

/**
 * Envía un texto por WhatsApp Business Platform.
 *
 * Si el tenant todavía no tiene número conectado, NO es un error: se devuelve
 * SKIPPED. El demo funciona igual y el mensaje queda registrado en el CRM —
 * la aprobación de Meta no puede ser un bloqueo para probar el producto.
 */
export async function sendWhatsAppText(
  phoneNumberId: string | null,
  toE164: string,
  body: string,
): Promise<DeliveryResult> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !token) {
    return {
      status: 'SKIPPED',
      reason: 'WhatsApp no está conectado para este negocio.',
    };
  }

  try {
    const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        // La API espera el número sin el '+'.
        to: toE164.replace(/^\+/, ''),
        type: 'text',
        text: { preview_url: false, body },
      }),
    });

    if (!res.ok) {
      return {
        status: 'FAILED',
        reason: `Meta respondió ${res.status}: ${(await res.text()).slice(0, 200)}`,
      };
    }

    const payload = (await res.json()) as { messages?: Array<{ id: string }> };
    return { status: 'SENT', externalId: payload.messages?.[0]?.id };
  } catch (e) {
    return { status: 'FAILED', reason: (e as Error).message };
  }
}
