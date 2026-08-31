import { describe, it, expect, vi } from 'vitest';
import { extractIntent, parseIntent, esDegradada } from '@/lib/agent/intent';
import { getPack } from '@/lib/country';

const VE = getPack('VE');
const SERVICIOS = [{ id: 'svc-1', name: 'Limpieza dental' }];

const BUENA = {
  service_id: 'svc-1',
  intent: 'AGENDAR',
  urgency: 'NORMAL',
  weekday: 'THURSDAY',
  relative_day: 'NONE',
  period: 'AFTERNOON',
  summary: 'Quiere una limpieza el jueves.',
  needs_human: false,
  confidence: 0.95,
};

/** fetch falso que devuelve una respuesta distinta en cada llamada. */
function fetchPorTurnos(...respuestas: unknown[]) {
  let i = 0;
  const llamadas = { total: 0 };
  const fetchImpl = vi.fn(async () => {
    const cuerpo = respuestas[Math.min(i++, respuestas.length - 1)];
    llamadas.total = i;
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(cuerpo) } }],
      }),
      text: async () => '',
    } as Response;
  }) as unknown as typeof fetch;

  return { fetchImpl, llamadas };
}

const pedir = (fetchImpl: typeof fetch) =>
  extractIntent({
    transcription: 'Necesito una cita para una limpieza dental el jueves.',
    services: SERVICIOS,
    pack: VE,
    nowLocalISO: '2026-09-01 15:00',
    apiKey: 'k',
    fetchImpl,
  });

describe('Test 27 · Detectar una respuesta ilegible', () => {
  it('un objeto vacío produce una intención degradada', () => {
    // Es la firma real del fallo que vimos en producción: sin servicio,
    // sin resumen, confianza cero.
    const i = parseIntent({});
    expect(esDegradada(i)).toBe(true);
    expect(i.confidence).toBe(0);
    expect(i.service_id).toBeNull();
  });

  it('una respuesta buena NO se marca como degradada', () => {
    expect(esDegradada(parseIntent(BUENA))).toBe(false);
  });

  it('un "necesito un humano" legítimo tampoco se marca como degradado', () => {
    // Esta distinción importa: solo lo ilegible merece reintento.
    const i = parseIntent({
      ...BUENA,
      intent: 'OTRO',
      needs_human: true,
      confidence: 0.8,
      service_id: null,
    });
    expect(esDegradada(i)).toBe(false);
  });
});

describe('Test 28 · Reintento ante una respuesta ilegible', () => {
  it('reintenta una vez y se queda con la buena', async () => {
    const { fetchImpl, llamadas } = fetchPorTurnos({}, BUENA);
    const intent = await pedir(fetchImpl);

    expect(llamadas.total).toBe(2);
    expect(intent.intent).toBe('AGENDAR');
    expect(intent.service_id).toBe('svc-1');
    expect(intent.needs_human).toBe(false);
  });

  it('no reintenta si la primera ya es buena', async () => {
    const { fetchImpl, llamadas } = fetchPorTurnos(BUENA);
    await pedir(fetchImpl);
    expect(llamadas.total).toBe(1);
  });

  it('si falla dos veces, escala a un humano en vez de reventar', async () => {
    const { fetchImpl, llamadas } = fetchPorTurnos({}, {});
    const intent = await pedir(fetchImpl);

    expect(llamadas.total).toBe(2); // no entra en bucle
    expect(intent.needs_human).toBe(true);
  });
});
