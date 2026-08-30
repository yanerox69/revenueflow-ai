import type { CountryCode, CountryPack } from './types';
import { VE_PACK } from './packs/ve';
import { BR_PACK } from './packs/br';

const REGISTRY: Record<CountryCode, CountryPack> = {
  VE: VE_PACK,
  BR: BR_PACK,
};

export class UnknownCountryError extends Error {}

export function getPack(code: string): CountryPack {
  const pack = REGISTRY[code as CountryCode];
  if (!pack) {
    throw new UnknownCountryError(
      `No existe un country pack para "${code}". ` +
        `Disponibles: ${listCountryCodes().join(', ')}`,
    );
  }
  return pack;
}

export function listCountryCodes(): CountryCode[] {
  return Object.keys(REGISTRY) as CountryCode[];
}

/** Para poblar selectores de país sin que la UI conozca códigos concretos. */
export function listCountryOptions(): Array<{
  code: CountryCode;
  displayName: string;
  taxIdKind: string;
  currency: string;
}> {
  return listCountryCodes().map((code) => {
    const pack = REGISTRY[code];
    return {
      code,
      displayName: pack.displayName,
      taxIdKind: pack.taxIdKind,
      currency: pack.primaryCurrency,
    };
  });
}

export * from './types';
export * from './money';
