import { z } from 'zod';
import { completeJson } from './llm-gateway';
import type { CountryPack } from '@/lib/country';

export type IntentKind =
  | 'AGENDAR'
  | 'REAGENDAR'
  | 'CONFIRMAR'
  | 'CANCELAR'
  | 'PRECIO'
  | 'INFO'
  | 'OTRO';

const INTENCIONES: IntentKind[] = [
  'AGENDAR',
  'REAGENDAR',
  'CONFIRMAR',
  'CANCELAR',
  'PRECIO',
  'INFO',
  'OTRO',
];

/** Un turno de la conversación, tal como se le presenta al modelo. */
export interface Turno {
  quien: 'cliente' | 'negocio';
  texto: string;
}

/** La cita que el cliente ya tiene, si existe. */
export interface CitaVigente {
  servicio: string;
  cuando: string;
}
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
  /**
   * Idioma en el que escribió el cliente. Solo se usa para mensajes de
   * TEXTO: cuando hay audio manda la detección de AssemblyAI, que trae
   * confianza y es su especialidad. 'OTRO' si no es ninguno de los tres.
   */
  language: 'es' | 'pt' | 'en' | 'OTRO';
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
      intent: {
        type: 'string',
        enum: INTENCIONES,
        description:
          'REAGENDAR si pide cambiar una cita que ya tiene. CONFIRMAR si ' +
          'responde que sí viene. CANCELAR si dice que no puede ir.',
      },
      urgency: { type: 'string', enum: ['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'] },
      // A propósito NO es un número.
      // Pedirle a un modelo pequeño que traduzca "jueves" a 4 falla: en
      // producción devolvió TUESDAY para "el jueves". Un símbolo lo acierta;
      // la conversión a índice la hace el sistema.
      weekday: {
        type: 'string',
        enum: [
          'MONDAY',
          'TUESDAY',
          'WEDNESDAY',
          'THURSDAY',
          'FRIDAY',
          'SATURDAY',
          'SUNDAY',
          'NONE',
        ],
        description: 'Día que pidió el cliente. NONE si no mencionó ninguno.',
      },
      relative_day: {
        type: 'string',
        enum: ['TODAY', 'TOMORROW', 'THIS_WEEK', 'NEXT_WEEK', 'NONE'],
      },
      period: { type: 'string', enum: ['MORNING', 'AFTERNOON', 'EVENING', 'ANY'] },
      summary: { type: 'string', description: 'Una frase, en el idioma del cliente.' },
      needs_human: { type: 'boolean' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      // Enum y no texto libre, por lo mismo que weekday: a un modelo pequeño
      // se le pide señalar, no escribir. Con texto libre devolvería
      // "español", "Spanish" o "es-VE" según el día.
      language: {
        type: 'string',
        enum: ['es', 'pt', 'en', 'OTRO'],
        description:
          'Idioma en el que escribió el cliente. OTRO si no es ninguno de esos tres.',
      },
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
      'language',
    ],
  },
} as const;

const SYSTEM = `Eres el recepcionista de un negocio de servicios en Latinoamérica.
Recibes la transcripción de una nota de voz de WhatsApp de un cliente, junto
con lo que ya se habló antes en esa conversación.

Tu ÚNICA tarea es extraer la intención en el esquema JSON indicado.

LEE EL HISTORIAL ANTES DE DECIDIR. Un mensaje corto casi nunca se entiende
solo: "mejor el viernes" solo significa algo mirando lo anterior. Si el
cliente ya tiene una cita y pide otro día, eso es REAGENDAR, no AGENDAR.

REGLAS INNEGOCIABLES:
- service_id debe ser un id EXACTO del catálogo que se te entrega. Si ninguno
  corresponde con claridad, devuelve null. NUNCA inventes un id.
- NO devuelvas fechas ni horas concretas. Solo el día de la semana (weekday)
  y la franja (period). El sistema calcula la fecha real.
- weekday se responde con el nombre en inglés del día que dijo el cliente:
  lunes=MONDAY, martes=TUESDAY, miércoles=WEDNESDAY, jueves=THURSDAY,
  viernes=FRIDAY, sábado=SATURDAY, domingo=SUNDAY.
  En portugués: segunda=MONDAY, terça=TUESDAY, quarta=WEDNESDAY,
  quinta=THURSDAY, sexta=FRIDAY, sábado=SATURDAY, domingo=SUNDAY.
  Si no mencionó ningún día, responde NONE.
- NO inventes precios, promociones, disponibilidad ni políticas.
- needs_human = true si hay una queja, un reclamo, un tema de dinero o pagos,
  un asunto médico delicado, o si simplemente no entiendes qué pide.
- confidence refleja tu seguridad sobre la intención, de 0 a 1.
- summary va en el mismo idioma que habló el cliente.
- language es el idioma del MENSAJE NUEVO, no el del país ni el del historial.
  Un cliente puede cambiar de idioma a mitad de conversación.`;

export interface ExtractIntentInput {
  transcription: string;
  services: ServiceOption[];
  pack: CountryPack;
  /** Para que el modelo resuelva "mañana" o "el jueves" con referencia. */
  nowLocalISO: string;
  /** Turnos anteriores, del más antiguo al más reciente. */
  history?: Turno[];
  /** La cita que el cliente ya tiene, si existe. */
  citaVigente?: CitaVigente | null;
  model?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export async function extractIntent(input: ExtractIntentInput): Promise<ExtractedIntent> {
  const catalog = input.services.length
    ? input.services.map((s) => `- ${s.id} :: ${s.name}`).join('\n')
    : '(el negocio no tiene servicios cargados)';

  const user = [
    // Se le da como pista, no como hecho: el idioma del país es lo más
    // probable, pero quien decide es el mensaje que tiene delante.
    `Idioma más frecuente en este país: ${input.pack.speechLanguage}`,
    `País: ${input.pack.displayName}`,
    `Fecha y hora local del negocio: ${input.nowLocalISO}`,
    '',
    'CATÁLOGO DE SERVICIOS (los únicos ids válidos):',
    catalog,
    '',
    ...(input.citaVigente
      ? [
          'CITA QUE ESTE CLIENTE YA TIENE:',
          `${input.citaVigente.servicio} — ${input.citaVigente.cuando}`,
          '',
        ]
      : ['ESTE CLIENTE NO TIENE NINGUNA CITA PENDIENTE.', '']),
    ...(input.history?.length
      ? [
          'CONVERSACIÓN ANTERIOR (de lo más antiguo a lo más reciente):',
          ...input.history.map((t) => `${t.quien}: ${t.texto}`),
          '',
        ]
      : []),
    'MENSAJE NUEVO DEL CLIENTE:',
    `"""${input.transcription}"""`,
  ].join('\n');

  const pedir = () =>
    completeJson<unknown>({
      system: SYSTEM,
      user,
      schema: SCHEMA as unknown as { name: string; schema: Record<string, unknown> },
      model: input.model,
      apiKey: input.apiKey,
      fetchImpl: input.fetchImpl,
    });

  // Un modelo pequeño devuelve basura de vez en cuando. Sin reintento, esa
  // vez el cliente recibe "te paso con una persona" y desde fuera parece que
  // el producto no funciona. Un segundo intento cuesta menos que eso.
  let intent = parseIntent(await pedir());

  if (esDegradada(intent)) {
    console.warn('[intent] respuesta ilegible del modelo, reintentando una vez');
    intent = parseIntent(await pedir());

    if (esDegradada(intent)) {
      console.error('[intent] el modelo falló dos veces: se escala a un humano');
    }
  }

  return sanitizeIntent(intent, input.services);
}

/**
 * Distingue "el modelo dijo que hace falta una persona" de "no entendimos al
 * modelo". Las dos escalan, pero solo la segunda merece un reintento.
 */
export function esDegradada(intent: ExtractedIntent): boolean {
  return intent.confidence === 0 && intent.intent === 'OTRO' && intent.service_id === null;
}

/**
 * Con los modelos sin `response_format` el esquema es una petición, no una
 * garantía. Aquí se valida de verdad.
 *
 * Si la respuesta no cumple, NO se lanza: se devuelve una intención que
 * escala a un humano. Un cliente esperando en WhatsApp merece que alguien lo
 * atienda, no un error 500.
 */
export const WEEKDAY_INDEX: Record<string, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

const IntentSchema = z.object({
  service_id: z.string().nullable().catch(null),
  intent: z.enum(INTENCIONES as [IntentKind, ...IntentKind[]]).catch('OTRO'),
  urgency: z.enum(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY']).catch('NORMAL'),
  // El modelo manda un símbolo; aquí se traduce a índice.
  weekday: z
    .union([z.string(), z.number(), z.null()])
    .transform(toWeekdayIndex)
    .catch(null),
  relative_day: z
    .enum(['TODAY', 'TOMORROW', 'THIS_WEEK', 'NEXT_WEEK', 'NONE'])
    .catch('NONE'),
  period: z.enum(['MORNING', 'AFTERNOON', 'EVENING', 'ANY']).catch('ANY'),
  summary: z.string().catch(''),
  needs_human: z.boolean().catch(true),
  confidence: z.number().catch(0),
  // Si el modelo no lo devuelve o lo devuelve mal, 'OTRO' hace que se caiga
  // al idioma del país. Nunca es motivo para escalar a una persona.
  language: z.enum(['es', 'pt', 'en', 'OTRO']).catch('OTRO'),
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
      language: 'OTRO',
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

/**
 * Acepta el símbolo ('THURSDAY') y, por compatibilidad, un índice numérico.
 * Cualquier otra cosa es "no dijo día".
 */
export function toWeekdayIndex(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value <= 6 ? value : null;
  }
  if (typeof value === 'string') {
    const key = value.trim().toUpperCase();
    return key in WEEKDAY_INDEX ? WEEKDAY_INDEX[key] : null;
  }
  return null;
}
