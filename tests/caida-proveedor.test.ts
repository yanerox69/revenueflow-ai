import { describe, it, expect, vi } from 'vitest';
import { extractIntent, parseIntent } from '@/lib/agent/intent';
import { composeReply } from '@/lib/agent/reply';
import { getPack } from '@/lib/country';

/**
 * Qué pasa cuando el proveedor del modelo se cae.
 *
 * Estaba cubierto el caso de "el modelo contesta mal" y no el de "el modelo
 * no contesta". Un 500 del Gateway subía como excepción, mataba al agente, y
 * el cliente que esperaba en WhatsApp no recibía nada. En la prueba de
 * calentamiento previa a grabar el vídeo pasó exactamente eso.
 *
 * Silencio es la peor salida: peor que escalar, porque nadie se entera.
 */

const VE = getPack('VE');

const SERVICIOS = [
  { id: 'svc-1', name: 'Limpieza dental' },
  { id: 'svc-2', name: 'Blanqueamiento' },
];

const BASE = {
  transcription: 'Hola, quiero una cita para una limpieza el jueves.',
  services: SERVICIOS,
  pack: VE,
  nowLocalISO: '2026-09-10 10:00 (America/Caracas)',
  apiKey: 'llave-de-prueba',
};

/** Un fetch que siempre falla del modo indicado. */
function fetchQueFalla(modo: 'http-500' | 'red' | 'json-roto') {
  return vi.fn(async () => {
    if (modo === 'red') throw new Error('ECONNRESET');

    if (modo === 'http-500') {
      return {
        ok: false,
        status: 500,
        text: async () => '{"message":"something went wrong","code":500}',
        json: async () => ({ message: 'something went wrong' }),
      } as Response;
    }

    return {
      ok: true,
      status: 200,
      text: async () => 'esto no es json ni de lejos',
      json: async () => ({
        choices: [{ message: { content: 'esto no es json ni de lejos' } }],
      }),
    } as Response;
  }) as unknown as typeof fetch;
}

describe('Test 34 · El proveedor se cae y el cliente igual recibe respuesta', () => {
  it('un 500 del Gateway no revienta: escala a una persona', async () => {
    const intent = await extractIntent({ ...BASE, fetchImpl: fetchQueFalla('http-500') });

    expect(intent.needs_human).toBe(true);
    expect(intent.service_id).toBeNull();
    expect(intent.confidence).toBe(0);
  });

  it('un corte de red tampoco revienta', async () => {
    const intent = await extractIntent({ ...BASE, fetchImpl: fetchQueFalla('red') });
    expect(intent.needs_human).toBe(true);
  });

  it('una respuesta que no es JSON tampoco', async () => {
    const intent = await extractIntent({ ...BASE, fetchImpl: fetchQueFalla('json-roto') });
    expect(intent.needs_human).toBe(true);
  });

  it('lo intenta dos veces antes de rendirse', async () => {
    // El reintento existe porque un modelo pequeño falla de vez en cuando y
    // sería tirar la conversación por una mala tirada.
    const fetchImpl = fetchQueFalla('http-500');
    await extractIntent({ ...BASE, fetchImpl });

    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(2);
  });

  it('y lo que recibe el cliente es una frase, no un error', async () => {
    // Lo que importa de verdad: que del otro lado llegue algo legible.
    const intent = await extractIntent({ ...BASE, fetchImpl: fetchQueFalla('http-500') });
    const texto = composeReply({ kind: 'NEEDS_HUMAN', reason: intent.summary }, VE, 'es');

    expect(texto).toMatch(/equipo/i);
    expect(texto).not.toMatch(/error|500|undefined|null/i);
  });
});

describe('Test 35 · Un límite de peticiones se espera, no se abandona', () => {
  // La cuenta gratuita corta a las pocas peticiones seguidas. Escalar a una
  // persona por un límite que se pasa solo en dos segundos sería tirar la
  // conversación por nada.
  function fetchQueLimitaYLuegoVa(veces: number) {
    let n = 0;
    return vi.fn(async () => {
      n++;
      if (n <= veces) {
        return {
          ok: false,
          status: 429,
          headers: { get: () => null },
          text: async () => '{"code":429}',
        } as unknown as Response;
      }
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  service_id: 'svc-1',
                  service_name: 'limpieza dental',
                  intent: 'AGENDAR',
                  urgency: 'NORMAL',
                  weekday: 'THURSDAY',
                  relative_day: 'NONE',
                  period: 'AFTERNOON',
                  summary: 'Quiere una limpieza.',
                  needs_human: false,
                  confidence: 0.9,
                  language: 'es',
                }),
              },
            },
          ],
        }),
      } as unknown as Response;
    }) as unknown as typeof fetch;
  }

  it('espera y lo consigue en el segundo intento', async () => {
    const fetchImpl = fetchQueLimitaYLuegoVa(1);
    const intent = await extractIntent({ ...BASE, fetchImpl });

    expect(intent.intent).toBe('AGENDAR');
    expect(intent.needs_human).toBe(false);
    expect(intent.service_id).toBe('svc-1');
  }, 15_000);

  it('se rinde si el límite no cede, pero escalando en vez de reventar', async () => {
    const intent = await extractIntent({ ...BASE, fetchImpl: fetchQueLimitaYLuegoVa(99) });
    expect(intent.needs_human).toBe(true);
  }, 30_000);
});

describe('Test 36 · Una respuesta vacía se lee como escalada', () => {
  it('null, undefined y basura dan una intención que pide una persona', () => {
    for (const basura of [null, undefined, 'texto suelto', 42, []]) {
      const intent = parseIntent(basura);
      expect(intent.needs_human, String(basura)).toBe(true);
      expect(intent.confidence, String(basura)).toBe(0);
    }
  });
});
