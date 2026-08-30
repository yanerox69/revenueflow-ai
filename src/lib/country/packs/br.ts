import type { CountryPack, Money } from '../types';
import { formatDecimal } from '../money';

/** CPF: 11 dígitos con dos dígitos verificadores. */
export function validateCpf(value: string): boolean {
  const d = value.replace(/\D/g, '');
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false; // 111.111.111-11 y similares

  const digits = d.split('').map(Number);

  for (const [length, position] of [
    [9, 9],
    [10, 10],
  ] as const) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += digits[i] * (length + 1 - i);
    let check = (sum * 10) % 11;
    if (check === 10) check = 0;
    if (check !== digits[position]) return false;
  }
  return true;
}

const CNPJ_W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** CNPJ: 14 dígitos con dos dígitos verificadores. */
export function validateCnpj(value: string): boolean {
  const d = value.replace(/\D/g, '');
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const digits = d.split('').map(Number);

  for (const [weights, position] of [
    [CNPJ_W1, 12],
    [CNPJ_W2, 13],
  ] as const) {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) sum += digits[i] * weights[i];
    const remainder = sum % 11;
    const check = remainder < 2 ? 0 : 11 - remainder;
    if (check !== digits[position]) return false;
  }
  return true;
}

/**
 * La trampa brasileña: el noveno dígito. Los móviles llevan un 9 delante que
 * los números antiguos no tienen. Si no lo normalizas, WhatsApp te entrega el
 * mismo contacto duplicado.
 */
export function normalizeBrPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  let local = digits;
  if (local.startsWith('55') && local.length > 11) local = local.slice(2);
  if (local.startsWith('0')) local = local.slice(1);

  if (!/^\d{10,11}$/.test(local)) {
    throw new Error(`Teléfono brasileño inválido: ${raw}`);
  }

  const area = local.slice(0, 2);
  let subscriber = local.slice(2);

  // 8 dígitos empezando en 6-9 = móvil antiguo → le falta el noveno dígito.
  if (subscriber.length === 8 && /^[6-9]/.test(subscriber)) {
    subscriber = `9${subscriber}`;
  }
  return `+55${area}${subscriber}`;
}

export const BR_PACK: CountryPack = {
  code: 'BR',
  displayName: 'Brasil',
  locale: 'pt-BR',
  timezone: 'America/Sao_Paulo',

  primaryCurrency: 'BRL',
  displayCurrency: null, // moneda única: sin doble exhibición
  fxSource: null,

  taxIdKind: 'CNPJ',
  personalIdKind: 'CPF',
  phonePrefix: '+55',
  speechLanguage: 'pt',
  samplePhone: '(11) 98765-4321',

  validateTaxId: validateCnpj,
  validatePersonalId: validateCpf,
  normalizePhone: normalizeBrPhone,

  formatMoney(money: Money): string {
    return `R$ ${formatDecimal(money.amountMinor, 'pt-BR')}`;
  },

  persona: {
    greeting: 'Oi! Bom dia',
    you: 'você',
    appointment: 'agendamento',
    quote: 'orçamento',
    confirmations: ['beleza', 'perfeito', 'combinado', 'show'],
  },
};
