import { z } from 'zod';
import { completeJson } from './llm-gateway';
import type { CountryPack } from '@/lib/country';

export type IntentKind = 'AGENDAR' | 'PRECIO' | 'INFO' | 'CANCELAR' | 'OTRO';
export type Period = 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANY';
export type RelativeDay = 'TODAY' | 'TOMORROW' | 'THIS_WEEK' | 'NEXT_WEEK' | 'NONE';

export interface ExtractedIntent {
  /** Debe ser un id del catálogo del tenant, o null. Nunca inventado. */
  service_id: string | null;
  intent: IntentKind;
  urgency: 'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY';
  /** 0 = domingo … 6 = sábado. null si el cliente no mencionó día. */
  weekday: number | null;
  relative_day: RelativeDay;
  period: Period;
  summary: string;
  needs_human: boolean;
  confidence: number;
}

export interface ServiceOption {
  id: string;
  name: string;
}

/**
 * El esquema es la barrera. El modelo no puede devolver una fecha ni un
 * precio: solo puede elegir del catálogo y señalar un día de la semana.
 * La fecha real la calcula el sistema.
 */
const SCHEMA = {
  name: 'intencion_cliente',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      service_id: {
        type: ['string', 'null'],
        description: 'Id EXACTO del catálogo, o null si ninguno corresponde.',
      },
      intent: { type: 'string', enum: ['AGENDAR', 'PRECIO', 'INFO', 'CANCELAR', 'OTRO'] },
      urgency: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'] },
      weekday: {
        type: ['integer', 'null'],
        minimum: 0,
        maximum: 6,
        description: '0=domingo, 1=lunes … 6=sábado. null si no menciona día.',
      },
      relative_day: {
        type: 'string',
        enum: ['TODAY', 'TOMORROW', 'THIS_WEEK', 'NEXT_WEEK', 'NONE'],
      },
      period: { type: 'string', enum: ['MORNING', 'AFTERNOON', 'EVENING', 'ANY'] },
      summary: { type: 'string', description: 'Una frase, en el idioma del cliente.' },
      needs_human: { type: 'boolean' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
    },
    required: [
      'service_id',
      'intent',
      'urgency',
      'weekday',
      'relative_day',
      'period',
      'summary',
      'needs_human',
      'confidence',
    ],
  },
} as const;

const SYSTEM = `Eres el recepcionista de un negocio de servicios en Latinoamérica.
Recibes la transcripción de una nota de voz de WhatsApp de un cliente.

Tu ÚNICA tarea es extraer la intención en el esquema JSON indicado.

REGLAS INNEGOCIABLES:
- service_id debe ser un id EXACTO del catálogo que se te entrega. Si ninguno
  corresponde con claridad, devuelve null. NUNCA inventes un id.
- NO devuelvas fechas ni horas concretas. Solo el día de la semana (weekday)
  y la franja (period). El sistema calcula la fecha real.
- NO inventes precios, promociones, disponibilidad ni políticas.
- needs_human = true si hay una queja, un reclamo, un tema de dinero o pagos,
  un asunto médico delicado, o si simplemente no entiendes qué pide.
- confidence refleja tu seguridad sobre la intención, de 0 a 1.
- summary va en el mismo idioma que habló el cliente.`;

export interface ExtractIntentInput {
  transcription: string;
  services: ServiceOption[];
  pack: CountryPack;
  /** Para que el modelo resuelva "mañana" o "el jueves" con referencia. */
  nowLocalISO: string;
  model?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export async function extractIntent(input: ExtractIntentInput): Promise<ExtractedIntent> {
  const catalog = input.services.length
    ? input.services.map((s) => `- ${s.id} :: ${s.name}`).join('\n')
    : '(el negocio no tiene servicios cargados)';

  const user = [
    `Idioma del cliente: ${input.pack.speechLanguage}`,
    `País: ${input.pack.displayName}`,
    `Fecha y hora local del negocio: ${input.nowLocalISO}`,
    '',
    'CATÁLOGO DE SERVICIOS (los únicos ids válidos):',
    catalog,
    '',
    'TRANSCRIPCIÓN DE LA NOTA DE VOZ:',
    `"""${input.transcription}"""`,
  ].join('\n');

  const raw = await completeJson<unknown>({
    system: SYSTEM,
    user,
    schema: SCHEMA as unknown as { name: string; schema: Record<string, unknown> },
    model: input.model,
    apiKey: input.apiKey,
    fetchImpl: input.fetchImpl,
  });

  return sanitizeIntent(parseIntent(raw), input.services);
}

/**
 * Con los modelos sin `response_format` el esquema es una petición, no una
 * garantía. Aquí se valida de verdad.
 *
 * Si la respuesta no cumple, NO se lanza: se devuelve una intención que
 * escala a un humano. Un cliente esperando en WhatsApp merece que alguien lo
 * atienda, no un error 500.
 */
const IntentSchema = z.object({
  service_id: z.string().nullable().catch(null),
  intent: z.enum(['AGENDAR', 'PRECIO', 'INFO', 'CANCELAR', 'OTRO']).catch('OTRO'),
  urgency: z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']).catch('NORMAL'),
  weekday: z.number().int().min(0).max(6).nullable().catch(null),
  relative_day: z
    .enum(['TODAY', 'TOMORROW', 'THIS_WEEK', 'NEXT_WEEK', 'NONE'])
    .catch('NONE'),
  period: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'ANY']).catch('ANY'),
  summary: z.string().catch(''),
  needs_human: z.boolean().catch(true),
  confidence: z.number().catch(0),
});

export function parseIntent(raw: unknown): ExtractedIntent {
  const parsed = IntentSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      service_id: null,
      intent: 'OTRO',
      urgency: 'NORMAL',
      weekday: null,
      relative_day: 'NONE',
      period: 'ANY',
      summary: 'No se pudo interpretar el mensaje.',
      needs_human: true,
      confidence: 0,
    };
  }

  return parsed.data;
}

/**
 * Segunda barrera: aunque el esquema lo restrinja, verificamos que el id
 * exista de verdad. Un modelo puede devolver un id con formato válido pero
 * inexistente, y eso terminaría agendando un servicio fantasma.
 */
export function sanitizeIntent(
  intent: ExtractedIntent,
  services: ServiceOption[],
): ExtractedIntent {
  const valid = new Set(services.map((s) => s.id));

  const serviceId =
    intent.service_id && valid.has(intent.service_id) ? intent.service_id : null;

  return {
    ...intent,
    service_id: serviceId,
    // Si el modelo alucinó un servicio, no confiamos en el resto tampoco.
    needs_human: intent.needs_human || (intent.service_id != null && serviceId == null),
    confidence: clamp01(intent.confidence),
    weekday:
      intent.weekday != null && intent.weekday >= 0 && intent.weekday <= 6
        ? intent.weekday
        : null,
  };
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
