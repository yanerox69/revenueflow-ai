import type { CountryPack, Money } from './types';

export class MoneyValidationError extends Error {}

/**
 * Un tenant con doble moneda (Venezuela) NO puede almacenar un monto sin la
 * tasa que se usó. Si lo permitiéramos, a los tres días ese número no
 * significaría nada.
 */
export function assertMoneyValid(money: Money, pack: CountryPack): void {
  if (money.amountMinor < 0n) {
    throw new MoneyValidationError('El monto no puede ser negativo.');
  }

  if (pack.displayCurrency === null) return;

  if (!money.fxRate) {
    throw new MoneyValidationError(
      `El país ${pack.code} usa doble moneda: todo monto exige fxRate. ` +
        'Un monto sin tasa es un dato corrupto.',
    );
  }
  if (!money.fxAt) {
    throw new MoneyValidationError(
      `El país ${pack.code} usa doble moneda: todo monto exige fxAt.`,
    );
  }
  if (Number(money.fxRate) <= 0) {
    throw new MoneyValidationError('La tasa debe ser mayor que cero.');
  }
}

/**
 * Congela el equivalente en USD al momento de crear el monto. Es la única
 * cifra comparable entre países y a través del tiempo.
 */
export function withUsdEquivalent(money: Money): Money {
  if (!money.fxRate) return money;

  const rate = Number(money.fxRate);
  if (!Number.isFinite(rate) || rate <= 0) return money;

  const usd = Number(money.amountMinor) / rate;
  return { ...money, usdEquivalentMinor: BigInt(Math.round(usd)) };
}

/** Divide centavos en unidades y fracción sin pasar por float. */
export function splitMinor(amountMinor: bigint): { units: bigint; cents: number } {
  const negative = amountMinor < 0n;
  const abs = negative ? -amountMinor : amountMinor;
  return {
    units: negative ? -(abs / 100n) : abs / 100n,
    cents: Number(abs % 100n),
  };
}

export function formatDecimal(amountMinor: bigint, locale: string): string {
  const { units, cents } = splitMinor(amountMinor);
  const unitsText = new Intl.NumberFormat(locale).format(units);
  return `${unitsText},${String(cents).padStart(2, '0')}`;
}
