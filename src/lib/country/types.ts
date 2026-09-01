/**
 * Contratos del núcleo multipaís.
 *
 * REGLA DURA: fuera de src/lib/country/ no puede aparecer el literal 'VE' ni
 * 'BR'. El test tests/no-country-literals.test.ts lo verifica.
 */

export type CountryCode = 'VE' | 'BR';
export type Currency = 'VES' | 'BRL' | 'USD';
export type FxSource = 'BCV' | 'PARALELO' | 'NONE';

/**
 * Todo monto se persiste con sus 6 partes. Un monto de un tenant con doble
 * moneda al que le falte `fxRate` es un dato corrupto, no un monto incompleto.
 */
export interface Money {
  amountMinor: bigint;
  currency: Currency;
  fxRate?: string; // decimal como STRING. Nunca number: perdería precisión.
  fxSource?: FxSource;
  fxAt?: Date;
  usdEquivalentMinor?: bigint;
}

export interface AgentPersona {
  /** Saludo de apertura del agente. */
  greeting: string;
  /** Pronombre de tratamiento. */
  you: string;
  /** Cómo se le llama a una cita en este país. */
  appointment: string;
  /** Cómo se le llama a una cotización. */
  quote: string;
  /** Muletillas de confirmación, para que suene local. */
  confirmations: readonly string[];
}

export interface CountryPack {
  readonly code: CountryCode;
  /** Nombre para mostrar. Vive aquí para que la UI no conozca países. */
  readonly displayName: string;
  readonly locale: string;
  readonly timezone: string;

  readonly primaryCurrency: Currency;
  /** Moneda de referencia mostrada junto a la primaria. null = moneda única. */
  readonly displayCurrency: Currency | null;
  readonly fxSource: FxSource | null;

  /** Etiqueta del identificador fiscal de empresa (RIF, CNPJ...). */
  readonly taxIdKind: string;
  /** Etiqueta del identificador personal (Cédula, CPF...). */
  readonly personalIdKind: string;

  readonly phonePrefix: string;

  /**
   * Idioma que se le pasa al motor de transcripción (ISO-639-1).
   * Vive en el pack porque un venezolano y un brasileño mandan el mismo
   * audio de WhatsApp y el modelo necesita saber en qué idioma escuchar.
   */
  readonly speechLanguage: string;

  /**
   * Lista ORDENADA de respaldo para `speech_models` (AssemblyAI). Vive en el
   * pack, no en el transcriptor, para que un país pueda pedir otro modelo el
   * día que la cobertura de idioma cambie sin tocar el motor.
   */
  readonly speechModels: readonly string[];

  /** Modelo del LLM Gateway usado para extraer la intención en este idioma. */
  readonly llmModel: string;

  /** Teléfono de ejemplo válido, para precargar formularios de demo. */
  readonly samplePhone: string;

  validateTaxId(value: string): boolean;
  validatePersonalId(value: string): boolean;

  /** Normaliza cualquier formato local a E.164. Lanza si es inválido. */
  normalizePhone(raw: string): string;

  formatMoney(money: Money): string;

  readonly persona: AgentPersona;
}
