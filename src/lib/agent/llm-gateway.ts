/**
 * Cliente del LLM Gateway de AssemblyAI.
 *
 * Misma llave que la transcripción, un solo proveedor. El header lleva la
 * clave cruda, SIN `Bearer` (igual que la API de speech-to-text).
 */

const US = 'https://llm-gateway.assemblyai.com/v1/chat/completions';

/**
 * Modelo propio de AssemblyAI: es el único disponible sin acceso ampliado,
 * y es rápido, que es lo que importa entre soltar el botón y ver la cita.
 * Se cambia con LLM_GATEWAY_MODEL.
 */
export const DEFAULT_MODEL = 'qwen3.5-4b-32k-fast';

/**
 * Modelos que aceptan `response_format: json_schema`.
 * `qwen3.5-4b-32k-fast` NO está: para ese se inyecta el esquema en el prompt.
 * Al ampliar el acceso de la cuenta, basta cambiar LLM_GATEWAY_MODEL y el
 * esquema pasa a aplicarse del lado del servidor automáticamente.
 */
const MODELS_WITH_SCHEMA = new Set([
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250929',
  'claude-sonnet-4-6',
  'claude-opus-4-5-20251101',
  'claude-opus-4-6',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gpt-5',
  'gpt-5-nano',
  'gpt-5-mini',
  'gpt-5.1',
  'gpt-5.2',
  'qwen3-32B',
  'qwen3-next-80b-a3b',
]);

export class LlmGatewayError extends Error {}

export interface JsonSchemaSpec {
  name: string;
  schema: Record<string, unknown>;
}

export interface CompleteJsonOptions {
  system: string;
  user: string;
  schema: JsonSchemaSpec;
  model?: string;
  maxTokens?: number;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export function supportsSchemaParam(model: string): boolean {
  return MODELS_WITH_SCHEMA.has(model);
}

/**
 * Pide un objeto JSON. Con los modelos que lo soportan se restringe con
 * `response_format`; con el resto se describe el esquema en el prompt.
 *
 * En ambos casos el resultado se valida después: la respuesta de un modelo
 * nunca se trata como confiable, venga del camino que venga.
 */
export async function completeJson<T>(opts: CompleteJsonOptions): Promise<T> {
  const apiKey = opts.apiKey ?? process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) throw new LlmGatewayError('Falta ASSEMBLYAI_API_KEY.');

  const model = opts.model ?? process.env.LLM_GATEWAY_MODEL ?? DEFAULT_MODEL;
  const useSchemaParam = supportsSchemaParam(model);
  const doFetch = opts.fetchImpl ?? fetch;

  const system = useSchemaParam
    ? opts.system
    : `${opts.system}\n\n` +
      'FORMATO DE SALIDA: responde ÚNICAMENTE con un objeto JSON válido que ' +
      'cumpla este esquema. Sin markdown, sin ```json, sin texto antes ni después.\n' +
      JSON.stringify(opts.schema.schema);

  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? 600,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: opts.user },
    ],
    // Repara comillas o comas sueltas antes de devolver.
    post_processing_steps: [{ type: 'json-repair' }],
  };

  if (useSchemaParam) {
    body.response_format = {
      type: 'json_schema',
      json_schema: { name: opts.schema.name, schema: opts.schema.schema, strict: true },
    };
  }

  const res = await pedirConEspera(doFetch, {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new LlmGatewayError(
      `LLM Gateway respondió ${res.status}: ${(await res.text()).slice(0, 300)}`,
    );
  }

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new LlmGatewayError('El modelo no devolvió contenido.');

  try {
    return JSON.parse(stripFences(content)) as T;
  } catch {
    // Se registra el contenido crudo: sin esto, depurar un fallo del modelo
    // en producción es adivinar.
    console.error('[llm] contenido no parseable:', content.slice(0, 400));
    throw new LlmGatewayError(
      `El modelo devolvió JSON inválido: ${content.slice(0, 200)}`,
    );
  }
}

/**
 * Cuánto esperar antes de cada reintento por límite de peticiones.
 *
 * La cuenta gratuita corta a las pocas peticiones seguidas: tres en
 * veinticinco segundos ya devuelven 429. Dos esperas cortas cubren el caso
 * real, que es un reintento pisando a la petición anterior.
 */
const ESPERAS_MS = [1500, 4000];

/**
 * Un 429 no es un fallo, es "espera un momento".
 *
 * Tratarlo como fallo hacía que el agente escalara a una persona por un
 * límite de ritmo que se pasa solo en dos segundos. Cualquier otro estado
 * —incluido un 500— sale tal cual: eso sí es un fallo, y quien llama decide
 * qué hacer.
 */
async function pedirConEspera(
  doFetch: typeof fetch,
  init: RequestInit,
): Promise<Response> {
  let res = await doFetch(US, init);

  for (const espera of ESPERAS_MS) {
    if (res.status !== 429) return res;

    // Si el servidor dice cuánto esperar, se le hace caso.
    const dice = Number(res.headers?.get?.('retry-after'));
    const ms = Number.isFinite(dice) && dice > 0 ? dice * 1000 : espera;

    console.warn(`[llm] límite de peticiones, esperando ${ms} ms`);
    await new Promise((r) => setTimeout(r, ms));

    res = await doFetch(US, init);
  }

  return res;
}

/** Los modelos sin `response_format` suelen envolver la respuesta en ```json. */
export function stripFences(raw: string): string {
  const text = raw.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) return fenced[1].trim();

  // Último recurso: quedarse con el primer objeto de nivel superior.
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) return text.slice(start, end + 1);

  return text;
}
