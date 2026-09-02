import type { CountryPack } from '@/lib/country';

/**
 * En qué idioma le hablamos al cliente.
 *
 * Hasta ahora el idioma salía del país: Venezuela → español, Brasil →
 * portugués. Eso confunde el mercado del negocio con la persona que escribe.
 * Un brasileño de vacaciones en Caracas escribe en portugués, y recibía
 * español.
 *
 * Aquí manda quien escribe. Con un límite honesto: solo respondemos en los
 * idiomas para los que hay plantillas escritas a mano. El resto cae al idioma
 * del país, que es lo más probable que el negocio sepa atender.
 */

/**
 * Los idiomas en los que sabemos RESPONDER.
 *
 * Transcribir es otra cosa: ahí AssemblyAI cubre 99 idiomas. Esta lista es
 * más corta a propósito, porque cada entrada exige plantillas revisadas por
 * alguien que hable el idioma. Añadir uno es traducir `reply.ts`, no tocar
 * esta constante.
 */
export const IDIOMAS_RESPUESTA = ['es', 'pt', 'en'] as const;

export type Idioma = (typeof IDIOMAS_RESPUESTA)[number];

/** Por debajo de esto, la detección no es fiable y se prefiere el país. */
export const CONFIANZA_MINIMA_IDIOMA = 0.5;

/**
 * `es-VE`, `pt_BR`, `EN` → `es`, `pt`, `en`.
 *
 * Los códigos llegan de dos sitios con formatos distintos (AssemblyAI usa
 * BCP-47, el modelo devuelve lo que le apetece), así que se normaliza en la
 * frontera y dentro solo circula el código de dos letras.
 */
export function normalizarIdioma(code: string | null | undefined): Idioma | null {
  if (!code) return null;

  const base = code.trim().toLowerCase().split(/[-_]/)[0];
  return (IDIOMAS_RESPUESTA as readonly string[]).includes(base)
    ? (base as Idioma)
    : null;
}

/** El idioma del país del negocio, si sabemos responder en él. */
export function idiomaDelPais(pack: CountryPack): Idioma {
  return normalizarIdioma(pack.speechLanguage) ?? 'es';
}

export interface ResolverIdiomaInput {
  /** Lo que detectó el transcriptor o el modelo. Puede ser cualquier cosa. */
  detectado?: string | null;
  /** 0–1. Si no viene, se confía en la detección. */
  confianza?: number | null;
  pack: CountryPack;
}

/**
 * Decide el idioma de la respuesta.
 *
 * Mismo principio que el resto del agente: el modelo detecta, el sistema
 * decide. Una detección con poca confianza no arrastra la conversación
 * entera a un idioma equivocado.
 */
export function resolverIdioma(input: ResolverIdiomaInput): Idioma {
  const { detectado, confianza, pack } = input;
  const idioma = normalizarIdioma(detectado);

  if (!idioma) return idiomaDelPais(pack);

  if (typeof confianza === 'number' && confianza < CONFIANZA_MINIMA_IDIOMA) {
    return idiomaDelPais(pack);
  }

  return idioma;
}

/**
 * Locale por defecto de cada idioma, para cuando no es el del país.
 *
 * Se eligen los del mercado más grande de cada idioma: es lo que hace que
 * "3 de setembro" salga bien escrito y que el inglés use las 12 horas.
 */
const LOCALE_POR_IDIOMA: Record<Idioma, string> = {
  es: 'es-419', // español de Latinoamérica, no de España
  pt: 'pt-BR',
  en: 'en-US',
};

/**
 * Con qué locale se formatean las fechas de la respuesta.
 *
 * No basta con traducir las frases: una respuesta en portugués con
 * "jueves, 3 de septiembre" delata al robot más que no traducir nada. La
 * fecha va en el idioma en que se habla.
 *
 * Si el idioma es el del país se usa el locale del tenant, que es más
 * preciso: es-VE formatea distinto que es-419.
 */
export function localeDe(idioma: Idioma, pack: CountryPack): string {
  return idioma === idiomaDelPais(pack) ? pack.locale : LOCALE_POR_IDIOMA[idioma];
}

/**
 * Qué idiomas le decimos al transcriptor que espere.
 *
 * El del país primero: es el más probable con diferencia. Los otros dos
 * cuestan cero y cubren al cliente que no es de aquí.
 */
export function idiomasEsperados(pack: CountryPack): string[] {
  const propio = idiomaDelPais(pack);
  return [propio, ...IDIOMAS_RESPUESTA.filter((i) => i !== propio)];
}
