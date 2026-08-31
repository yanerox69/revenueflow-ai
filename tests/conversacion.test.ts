import { describe, it, expect, vi } from 'vitest';
import { extractIntent, parseIntent } from '@/lib/agent/intent';
import { composeReply } from '@/lib/agent/reply';
import { getPack } from '@/lib/country';

const VE = getPack('VE');
const BR = getPack('BR');

/** Captura el prompt que se le manda al modelo. */
function capturarPrompt(respuesta: Record<string, unknown>) {
  const capturado: { body?: string } = {};
  const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    capturado.body = init?.body as string;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(respuesta) } }],
      }),
      text: async () => '',
    } as Response;
  }) as unknown as typeof fetch;

  return { fetchImpl, capturado };
}

const RESPUESTA_BASE = {
  service_id: 'svc-1',
  intent: 'REAGENDAR',
  urgency: 'NORMAL',
  weekday: 'FRIDAY',
  relative_day: 'NONE',
  period: 'ANY',
  summary: 'Quiere cambiar la cita al viernes.',
  needs_human: false,
  confidence: 0.9,
};

describe('Test 24 · El modelo recibe el contexto de la conversación', () => {
  it('incluye los turnos anteriores en el prompt', async () => {
    const { fetchImpl, capturado } = capturarPrompt(RESPUESTA_BASE);

    await extractIntent({
      transcription: 'Mejor el viernes',
      services: [{ id: 'svc-1', name: 'Limpieza dental' }],
      pack: VE,
      nowLocalISO: '2026-09-01 10:00 (America/Caracas)',
      history: [
        { quien: 'cliente', texto: 'Necesito una cita para una limpieza dental el jueves.' },
        { quien: 'negocio', texto: '¡Listo! Te agendé Limpieza dental para el jueves a la 1:00 p. m.' },
      ],
      citaVigente: { servicio: 'Limpieza dental', cuando: 'jueves, 3 de septiembre, 1:00 p. m.' },
      apiKey: 'k',
      fetchImpl,
    });

    const contenido = JSON.parse(capturado.body!).messages[1].content as string;

    // Sin el historial, "mejor el viernes" no significa nada.
    expect(contenido).toContain('CONVERSACIÓN ANTERIOR');
    expect(contenido).toContain('cliente: Necesito una cita');
    expect(contenido).toContain('negocio: ¡Listo!');
    expect(contenido).toContain('Mejor el viernes');
  });

  it('le dice al modelo qué cita tiene ya el cliente', async () => {
    const { fetchImpl, capturado } = capturarPrompt(RESPUESTA_BASE);

    await extractIntent({
      transcription: 'Mejor el viernes',
      services: [{ id: 'svc-1', name: 'Limpieza dental' }],
      pack: VE,
      nowLocalISO: '2026-09-01 10:00 (America/Caracas)',
      citaVigente: { servicio: 'Limpieza dental', cuando: 'jueves, 3 de septiembre, 1:00 p. m.' },
      apiKey: 'k',
      fetchImpl,
    });

    const contenido = JSON.parse(capturado.body!).messages[1].content as string;
    expect(contenido).toContain('CITA QUE ESTE CLIENTE YA TIENE');
    expect(contenido).toContain('jueves, 3 de septiembre');
  });

  it('dice explícitamente cuando el cliente no tiene cita', async () => {
    // Callarlo dejaría al modelo suponiendo, y suponer es lo que produce
    // que confirme o cancele citas que no existen.
    const { fetchImpl, capturado } = capturarPrompt(RESPUESTA_BASE);

    await extractIntent({
      transcription: 'Hola',
      services: [],
      pack: VE,
      nowLocalISO: '2026-09-01 10:00 (America/Caracas)',
      citaVigente: null,
      apiKey: 'k',
      fetchImpl,
    });

    const contenido = JSON.parse(capturado.body!).messages[1].content as string;
    expect(contenido).toContain('NO TIENE NINGUNA CITA PENDIENTE');
  });

  it('el prompt del sistema obliga a leer el historial', async () => {
    const { fetchImpl, capturado } = capturarPrompt(RESPUESTA_BASE);

    await extractIntent({
      transcription: 'x',
      services: [],
      pack: VE,
      nowLocalISO: '2026-09-01 10:00',
      apiKey: 'k',
      fetchImpl,
    });

    const sistema = JSON.parse(capturado.body!).messages[0].content as string;
    expect(sistema).toContain('LEE EL HISTORIAL');
    expect(sistema).toContain('REAGENDAR');
  });
});

describe('Test 25 · Las intenciones sobre una cita existente', () => {
  const base = {
    service_id: null,
    urgency: 'NORMAL',
    weekday: 'NONE',
    relative_day: 'NONE',
    period: 'ANY',
    summary: '',
    needs_human: false,
    confidence: 0.9,
  };

  it('reconoce REAGENDAR, CONFIRMAR y CANCELAR', () => {
    for (const kind of ['REAGENDAR', 'CONFIRMAR', 'CANCELAR'] as const) {
      expect(parseIntent({ ...base, intent: kind }).intent).toBe(kind);
    }
  });

  it('una intención inventada degrada a OTRO, no rompe', () => {
    expect(parseIntent({ ...base, intent: 'BORRAR_TODO' }).intent).toBe('OTRO');
  });
});

describe('Test 26 · Respuestas de las nuevas acciones', () => {
  it('al reagendar avisa de que el horario viejo queda libre', () => {
    const t = composeReply(
      {
        kind: 'RESCHEDULED',
        appointmentId: 'a',
        startsAt: '2026-09-04T17:00:00Z',
        label: 'viernes, 4 de septiembre, 1:00 p. m.',
        serviceName: 'Limpieza dental',
      },
      VE,
    );
    expect(t).toContain('Cambié');
    expect(t).toContain('viernes, 4 de septiembre');
    expect(t).toMatch(/anterior queda libre/i);
  });

  it('al confirmar no vuelve a preguntar nada', () => {
    const t = composeReply(
      { kind: 'CONFIRMED', appointmentId: 'a', label: 'jueves a la 1:00 p. m.', serviceName: 'Limpieza dental' },
      VE,
    );
    expect(t).toMatch(/confirmado/i);
    expect(t).not.toContain('¿');
  });

  it('al cancelar deja la puerta abierta', () => {
    const t = composeReply(
      { kind: 'CANCELLED', appointmentId: 'a', serviceName: 'Limpieza dental' },
      VE,
    );
    expect(t).toMatch(/cancelé/i);
    expect(t).toMatch(/volver a agendar/i);
  });

  it('si no hay cita, ofrece agendar en vez de dar un error', () => {
    const t = composeReply({ kind: 'NO_APPOINTMENT' }, VE);
    expect(t).toMatch(/no encontré/i);
    expect(t).toMatch(/\?/); // termina proponiendo algo
  });

  it('todo funciona igual en portugués', () => {
    const t = composeReply(
      { kind: 'CANCELLED', appointmentId: 'a', serviceName: 'Limpeza de pele' },
      BR,
    );
    expect(t).toMatch(/cancelei/i);
    expect(t).not.toMatch(/cancelé/i);
  });
});
