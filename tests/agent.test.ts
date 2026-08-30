import { describe, it, expect, vi } from 'vitest';
import {
  localParts,
  zonedToUtc,
  resolveTargetDay,
  findSlots,
  periodWindow,
  describeSlot,
  type AvailabilityRule,
} from '@/lib/agent/scheduling';
import {
  sanitizeIntent,
  parseIntent,
  toWeekdayIndex,
  type ExtractedIntent,
} from '@/lib/agent/intent';
import { composeReply, endSentence } from '@/lib/agent/reply';
import { getPack } from '@/lib/country';
import {
  completeJson,
  stripFences,
  supportsSchemaParam,
  DEFAULT_MODEL,
} from '@/lib/agent/llm-gateway';

/** fetch falso que captura la petición y devuelve el contenido dado. */
function captureFetch(content: string) {
  const captured: { url?: string; init?: RequestInit } = {};
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    captured.url = String(url);
    captured.init = init;
    return {
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content } }] }),
      text: async () => '',
    } as Response;
  }) as unknown as typeof fetch;

  return { fetchImpl, captured };
}

const CARACAS = 'America/Caracas';
const SAO_PAULO = 'America/Sao_Paulo';

/** Martes 1 de septiembre de 2026, 14:00 UTC = 10:00 en Caracas. */
const NOW = new Date('2026-09-01T14:00:00Z');

describe('Test 13 · La fecha se calcula en la hora del negocio', () => {
  it('lee la hora local correcta, no la del servidor', () => {
    const p = localParts(NOW, CARACAS);
    expect(p.year).toBe(2026);
    expect(p.month).toBe(9);
    expect(p.day).toBe(1);
    expect(p.hour).toBe(10); // UTC-4
    expect(p.weekday).toBe(2); // martes
  });

  it('convierte hora local a UTC de ida y vuelta', () => {
    const utc = zonedToUtc(2026, 9, 3, 13, 0, CARACAS);
    expect(utc.toISOString()).toBe('2026-09-03T17:00:00.000Z');

    const back = localParts(utc, CARACAS);
    expect(back.hour).toBe(13);
    expect(back.day).toBe(3);
  });

  it('resuelve "el jueves" al próximo jueves', () => {
    const target = resolveTargetDay(NOW, CARACAS, 4, 'NONE');
    expect(target).toMatchObject({ year: 2026, month: 9, day: 3, weekday: 4 });
  });

  it('"el martes" dicho un martes es el martes que viene, no hoy', () => {
    const target = resolveTargetDay(NOW, CARACAS, 2, 'NONE');
    expect(target.day).toBe(8); // una semana después
  });

  it('respeta "hoy" cuando el cliente lo dice explícitamente', () => {
    const target = resolveTargetDay(NOW, CARACAS, 2, 'TODAY');
    expect(target.day).toBe(1);
  });

  it('resuelve "mañana"', () => {
    expect(resolveTargetDay(NOW, CARACAS, null, 'TOMORROW').day).toBe(2);
  });

  it('empuja una semana con "la próxima semana"', () => {
    expect(resolveTargetDay(NOW, CARACAS, 4, 'NEXT_WEEK').day).toBe(10);
  });

  it('da el mismo día de calendario distinto según el huso', () => {
    // 02:00 UTC del miércoles sigue siendo martes en Caracas.
    const madrugada = new Date('2026-09-02T02:00:00Z');
    expect(localParts(madrugada, CARACAS).day).toBe(1);
    expect(localParts(madrugada, SAO_PAULO).day).toBe(1);
  });
});

describe('Test 14 · Los huecos salen de la disponibilidad real', () => {
  const rules: AvailabilityRule[] = [
    { weekday: 4, start_time: '08:00:00', end_time: '12:00:00' },
    { weekday: 4, start_time: '13:00:00', end_time: '18:00:00' },
  ];
  const target = resolveTargetDay(NOW, CARACAS, 4, 'NONE'); // jueves 3

  it('respeta la franja pedida', () => {
    const slots = findSlots({
      rules, taken: [], target, period: 'AFTERNOON',
      durationMinutes: 45, timeZone: CARACAS, now: NOW,
    });

    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) {
      const h = localParts(s, CARACAS).hour;
      expect(h).toBeGreaterThanOrEqual(12);
      expect(h).toBeLessThan(18);
    }
    expect(slots[0].toISOString()).toBe('2026-09-03T17:00:00.000Z'); // 13:00 local
  });

  it('no ofrece un hueco ya ocupado', () => {
    const primero = new Date('2026-09-03T17:00:00.000Z');
    const slots = findSlots({
      rules, taken: [primero], target, period: 'AFTERNOON',
      durationMinutes: 45, timeZone: CARACAS, now: NOW,
    });

    expect(slots.map((s) => s.toISOString())).not.toContain(primero.toISOString());
  });

  it('nunca agenda en el pasado', () => {
    const futuro = new Date('2026-09-03T20:00:00Z'); // 16:00 local del jueves
    const slots = findSlots({
      rules, taken: [], target, period: 'ANY',
      durationMinutes: 45, timeZone: CARACAS, now: futuro,
    });

    for (const s of slots) expect(s.getTime()).toBeGreaterThan(futuro.getTime());
  });

  it('no devuelve nada si ese día el negocio no abre', () => {
    const domingo = resolveTargetDay(NOW, CARACAS, 0, 'NONE');
    const slots = findSlots({
      rules, taken: [], target: domingo, period: 'ANY',
      durationMinutes: 45, timeZone: CARACAS, now: NOW,
    });
    expect(slots).toEqual([]);
  });

  it('no parte un servicio a caballo del cierre', () => {
    const slots = findSlots({
      rules, taken: [], target, period: 'ANY',
      durationMinutes: 90, timeZone: CARACAS, now: NOW,
    });

    for (const s of slots) {
      const fin = new Date(s.getTime() + 90 * 60_000);
      const h = localParts(fin, CARACAS).hour;
      const m = localParts(fin, CARACAS).minute;
      expect(h * 60 + m).toBeLessThanOrEqual(18 * 60);
    }
  });

  it('define las franjas horarias', () => {
    expect(periodWindow('MORNING')).toEqual({ startHour: 6, endHour: 12 });
    expect(periodWindow('ANY')).toEqual({ startHour: 0, endHour: 24 });
  });

  it('describe el hueco en el idioma del negocio', () => {
    const texto = describeSlot(new Date('2026-09-03T17:00:00Z'), CARACAS, 'es-VE');
    expect(texto.toLowerCase()).toContain('jueves');
    expect(texto).toContain('1:00');
  });
});

describe('Test 15 · El agente no puede inventar un servicio', () => {
  const services = [
    { id: 'svc-1', name: 'Limpieza dental' },
    { id: 'svc-2', name: 'Blanqueamiento' },
  ];

  const base: ExtractedIntent = {
    service_id: 'svc-1',
    intent: 'AGENDAR',
    urgency: 'NORMAL',
    weekday: 4,
    relative_day: 'NONE',
    period: 'AFTERNOON',
    summary: 'Quiere una limpieza el jueves.',
    needs_human: false,
    confidence: 0.9,
  };

  it('acepta un id del catálogo', () => {
    expect(sanitizeIntent(base, services).service_id).toBe('svc-1');
  });

  it('descarta un id inventado y escala a un humano', () => {
    const result = sanitizeIntent({ ...base, service_id: 'svc-999' }, services);
    expect(result.service_id).toBeNull();
    expect(result.needs_human).toBe(true); // no se agenda a ciegas
  });

  it('no escala si el modelo dijo honestamente que no hay servicio', () => {
    const result = sanitizeIntent({ ...base, service_id: null }, services);
    expect(result.service_id).toBeNull();
    expect(result.needs_human).toBe(false);
  });

  it('acota la confianza a 0–1', () => {
    expect(sanitizeIntent({ ...base, confidence: 7 }, services).confidence).toBe(1);
    expect(sanitizeIntent({ ...base, confidence: NaN }, services).confidence).toBe(0);
  });

  it('descarta un weekday fuera de rango', () => {
    expect(sanitizeIntent({ ...base, weekday: 9 }, services).weekday).toBeNull();
  });
});

describe('Test 18 · El día se pide como símbolo, no como número', () => {
  // En producción el modelo devolvió TUESDAY para "el jueves" cuando se le
  // pedía un índice. Traducir nombre->número es trabajo del sistema.
  it('traduce los nombres de día a índice', () => {
    expect(toWeekdayIndex('THURSDAY')).toBe(4);
    expect(toWeekdayIndex('SUNDAY')).toBe(0);
    expect(toWeekdayIndex('saturday')).toBe(6);
  });

  it('trata NONE y valores desconocidos como "no dijo día"', () => {
    expect(toWeekdayIndex('NONE')).toBeNull();
    expect(toWeekdayIndex('JUEVES')).toBeNull();
    expect(toWeekdayIndex(null)).toBeNull();
  });

  it('sigue aceptando un índice numérico', () => {
    expect(toWeekdayIndex(4)).toBe(4);
    expect(toWeekdayIndex(9)).toBeNull();
  });

  it('parseIntent convierte el símbolo del modelo a índice', () => {
    const parsed = parseIntent({
      service_id: 'svc-1',
      intent: 'AGENDAR',
      urgency: 'NORMAL',
      weekday: 'THURSDAY',
      relative_day: 'NONE',
      period: 'AFTERNOON',
      summary: 'Quiere limpieza el jueves.',
      needs_human: false,
      confidence: 0.9,
    });

    expect(parsed.weekday).toBe(4);
    expect(parsed.needs_human).toBe(false);
  });

  it('y un jueves pedido cae en jueves, no en martes', () => {
    const parsed = parseIntent({
      service_id: 'svc-1',
      intent: 'AGENDAR',
      urgency: 'NORMAL',
      weekday: 'THURSDAY',
      relative_day: 'NONE',
      period: 'AFTERNOON',
      summary: '',
      needs_human: false,
      confidence: 0.9,
    });

    const target = resolveTargetDay(NOW, CARACAS, parsed.weekday, 'NONE');
    expect(target.weekday).toBe(4);
    expect(target.day).toBe(3); // jueves 3 de septiembre
  });
});

describe('Test 17 · La confirmación al cliente no la escribe el modelo', () => {
  const booked = {
    kind: 'BOOKED' as const,
    appointmentId: 'a1',
    startsAt: '2026-09-03T17:00:00.000Z',
    label: 'jueves, 3 de septiembre, 1:00 p. m.',
    serviceName: 'Limpieza dental',
  };

  it('confirma en español con el servicio y la fecha exactos', () => {
    const texto = composeReply(booked, getPack('VE'));
    expect(texto).toContain('Limpieza dental');
    expect(texto).toContain('jueves, 3 de septiembre, 1:00 p. m.');
    expect(texto).toContain('cita');
  });

  it('confirma en portugués para un tenant brasileño', () => {
    const texto = composeReply(booked, getPack('BR'));
    expect(texto).toContain('Agendei');
    expect(texto).not.toContain('Te agendé'); // sin español mezclado
  });

  it('avisa sin prometer nada cuando no hay cupo', () => {
    const texto = composeReply(
      { kind: 'NO_AVAILABILITY', serviceName: 'Blanqueamiento' },
      getPack('VE'),
    );
    expect(texto).toContain('Blanqueamiento');
    expect(texto).toMatch(/no tengo cupo/i);
  });

  it('deriva a una persona sin inventar explicaciones', () => {
    const texto = composeReply({ kind: 'NEEDS_HUMAN', reason: 'queja' }, getPack('VE'));
    expect(texto).toMatch(/equipo/i);
    expect(texto).not.toContain('queja'); // el motivo interno no se le cuenta al cliente
  });

  it('no duplica el punto cuando la hora ya termina en uno', () => {
    const texto = composeReply(booked, getPack('VE'));
    expect(texto).not.toContain('..');
    expect(endSentence('1:45 p. m.')).toBe('1:45 p. m.');
    expect(endSentence('13:45')).toBe('13:45.');
  });

  it('usa las muletillas del país', () => {
    const ve = composeReply(booked, getPack('VE'));
    const br = composeReply(booked, getPack('BR'));
    expect(ve.startsWith('¡Listo!')).toBe(true);
    expect(br.startsWith('Beleza!')).toBe(true);
  });
});

describe('Test 16 · La petición al LLM Gateway', () => {
  it('usa la llave cruda sin Bearer', async () => {
    let captured: { url: string; init: RequestInit } | null = null;

    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      captured = { url: String(url), init: init! };
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }),
        text: async () => '',
      } as Response;
    }) as unknown as typeof fetch;

    const out = await completeJson<{ ok: boolean }>({
      system: 'sistema',
      user: 'usuario',
      schema: { name: 'prueba', schema: { type: 'object' } },
      apiKey: 'llave-de-prueba',
      fetchImpl,
    });

    expect(out).toEqual({ ok: true });

    const { url, init } = captured!;
    expect(url).toBe('https://llm-gateway.assemblyai.com/v1/chat/completions');

    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe('llave-de-prueba');
    expect(headers.authorization).not.toContain('Bearer');

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(DEFAULT_MODEL);
    expect(body.post_processing_steps).toEqual([{ type: 'json-repair' }]);
  });

  it('inyecta el esquema en el prompt si el modelo no soporta response_format', async () => {
    expect(supportsSchemaParam(DEFAULT_MODEL)).toBe(false);

    const { fetchImpl, captured } = captureFetch('{"ok":true}');
    await completeJson({
      system: 'sistema',
      user: 'usuario',
      schema: { name: 'prueba', schema: { type: 'object', properties: { ok: {} } } },
      apiKey: 'k',
      fetchImpl,
    });

    const body = JSON.parse(captured.init!.body as string);
    expect(body).not.toHaveProperty('response_format');
    expect(body.messages[0].content).toContain('"type":"object"');
    expect(body.messages[0].content).toContain('Sin markdown');
  });

  it('usa response_format cuando el modelo sí lo soporta', async () => {
    expect(supportsSchemaParam('gemini-2.5-flash-lite')).toBe(true);

    const { fetchImpl, captured } = captureFetch('{"ok":true}');
    await completeJson({
      system: 'sistema',
      user: 'usuario',
      schema: { name: 'prueba', schema: { type: 'object' } },
      model: 'gemini-2.5-flash-lite',
      apiKey: 'k',
      fetchImpl,
    });

    const body = JSON.parse(captured.init!.body as string);
    expect(body.response_format.type).toBe('json_schema');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.messages[0].content).toBe('sistema'); // sin esquema inyectado
  });

  it('desenvuelve JSON dentro de un bloque markdown', () => {
    expect(stripFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(stripFences('Claro, aquí tienes: {"a":1} ¡listo!')).toBe('{"a":1}');
    expect(stripFences('{"a":1}')).toBe('{"a":1}');
  });

  it('degrada a intención escalable si el JSON no cumple', () => {
    const malo = parseIntent({ intent: 'INVENTADO', confidence: 'mucha' });
    expect(malo.needs_human).toBe(true);
    expect(malo.service_id).toBeNull();
    expect(malo.confidence).toBe(0);
  });

  it('falla claro si el modelo devuelve JSON roto', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: 'esto no es json' } }] }),
      text: async () => '',
    })) as unknown as typeof fetch;

    await expect(
      completeJson({
        system: 's', user: 'u',
        schema: { name: 'x', schema: {} },
        apiKey: 'k', fetchImpl,
      }),
    ).rejects.toThrow(/JSON inválido/);
  });
});
