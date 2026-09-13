import type { CountryPack, Money } from '../types';
import { formatDecimal } from '../money';

/** Valor numérico de la letra inicial del RIF. */
const RIF_LETTERS: Record<string, number> = { V: 1, E: 2, J: 3, P: 4, G: 5 };
const RIF_WEIGHTS = [4, 3, 2, 7, 6, 5, 4, 3, 2];

/**
 * RIF venezolano: letra + 8 dígitos + dígito verificador.
 *
 * NOTA: el algoritmo implementado es el documentado públicamente por el SENIAT.
 * Antes de producción, valídalo contra una muestra de RIF reales conocidos.
 */
export function validateRif(value: string): boolean {
  const clean = value.toUpperCase().replace(/[\s-]/g, '');
  if (!/^[VEJPG]\d{9}$/.test(clean)) return false;

  const letterValue = RIF_LETTERS[clean[0]];
  const digits = clean.slice(1, 9).split('').map(Number);
  const checkDigit = Number(clean[9]);

  let sum = letterValue * RIF_WEIGHTS[0];
  for (let i = 0; i < 8; i++) sum += digits[i] * RIF_WEIGHTS[i + 1];

  const remainder = sum % 11;
  const expected = remainder > 1 ? 11 - remainder : 0;

  return checkDigit === expected;
}

/** Cédula venezolana: V/E + hasta 8 dígitos. No lleva dígito verificador. */
export function validateCedula(value: string): boolean {
  const clean = value.toUpperCase().replace(/[\s-.]/g, '');
  return /^[VE]\d{6,8}$/.test(clean);
}

export function normalizeVePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  let local = digits;
  if (local.startsWith('58')) local = local.slice(2);
  if (local.startsWith('0')) local = local.slice(1);

  // Móvil: 4XX + 7 dígitos. Fijo: 2XX + 7 dígitos.
  if (!/^[24]\d{9}$/.test(local)) {
    throw new Error(`Teléfono venezolano inválido: ${raw}`);
  }
  return `+58${local}`;
}

export const VE_PACK: CountryPack = {
  code: 'VE',
  displayName: 'Venezuela',
  locale: 'es-VE',
  timezone: 'America/Caracas',

  primaryCurrency: 'VES',
  displayCurrency: 'USD',
  fxSource: 'BCV',

  taxIdKind: 'RIF',
  personalIdKind: 'Cédula',
  phonePrefix: '+58',
  speechLanguage: 'es',
  speechModels: ['universal-3-5-pro', 'universal-2'],
  llmModel: 'qwen3.5-4b-32k-fast',
  samplePhone: '0414-1234567',

  validateTaxId: validateRif,
  validatePersonalId: validateCedula,
  normalizePhone: normalizeVePhone,

  /**
   * Doble moneda siempre visible. El negocio piensa en dólares pero el precio
   * legalmente se exhibe en bolívares.
   *   Bs. 1.845,00  ≈ $37,50 · BCV 49,20
   */
  formatMoney(money: Money): string {
    const bolivares = `Bs. ${formatDecimal(money.amountMinor, 'es-VE')}`;
    if (!money.fxRate || money.usdEquivalentMinor === undefined) return bolivares;

    const usd = formatDecimal(money.usdEquivalentMinor, 'es-VE');
    const rate = formatDecimal(
      BigInt(Math.round(Number(money.fxRate) * 100)),
      'es-VE',
    );
    return `${bolivares} ≈ $${usd} · ${money.fxSource ?? 'BCV'} ${rate}`;
  },

  persona: {
    greeting: '¡Hola! Buenos días',
    you: 'tú',
    appointment: 'cita',
    quote: 'presupuesto',
    confirmations: ['listo', 'perfecto', 'de una', 'dale'],
  },
};
