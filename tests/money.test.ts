import { describe, it, expect } from 'vitest';
import {
  getPack,
  assertMoneyValid,
  withUsdEquivalent,
  MoneyValidationError,
  type Money,
} from '@/lib/country';

const ve = getPack('VE');
const br = getPack('BR');

describe('Test 7 · Un monto de doble moneda sin tasa es inválido', () => {
  it('rechaza un monto en un tenant de doble moneda sin fxRate', () => {
    const sinTasa: Money = { amountMinor: 184500n, currency: 'VES' };
    expect(() => assertMoneyValid(sinTasa, ve)).toThrow(MoneyValidationError);
  });

  it('rechaza un monto con tasa pero sin fecha de tasa', () => {
    const sinFecha: Money = {
      amountMinor: 184500n,
      currency: 'VES',
      fxRate: '49.20',
    };
    expect(() => assertMoneyValid(sinFecha, ve)).toThrow(MoneyValidationError);
  });

  it('acepta un monto completo', () => {
    const completo: Money = {
      amountMinor: 184500n,
      currency: 'VES',
      fxRate: '49.20',
      fxSource: 'BCV',
      fxAt: new Date('2026-08-29T12:00:00Z'),
    };
    expect(() => assertMoneyValid(completo, ve)).not.toThrow();
  });

  it('no exige tasa en un país de moneda única', () => {
    const real: Money = { amountMinor: 34990n, currency: 'BRL' };
    expect(() => assertMoneyValid(real, br)).not.toThrow();
  });
});

describe('Formato de dinero por país', () => {
  it('muestra doble moneda con tasa en Venezuela', () => {
    const m = withUsdEquivalent({
      amountMinor: 184500n,
      currency: 'VES',
      fxRate: '49.20',
      fxSource: 'BCV',
      fxAt: new Date('2026-08-29T12:00:00Z'),
    });
    const texto = ve.formatMoney(m);

    expect(texto).toContain('Bs.');
    expect(texto).toContain('$');
    expect(texto).toContain('BCV');
  });

  it('congela el equivalente en USD', () => {
    const m = withUsdEquivalent({
      amountMinor: 184500n,
      currency: 'VES',
      fxRate: '49.20',
    });
    // 184500 centavos de Bs / 49.20 = 3750 centavos de USD = $37,50
    expect(m.usdEquivalentMinor).toBe(3750n);
  });

  it('muestra moneda única en Brasil', () => {
    const texto = br.formatMoney({ amountMinor: 34990n, currency: 'BRL' });
    expect(texto).toBe('R$ 349,90');
    expect(texto).not.toContain('≈'); // sin doble moneda
    expect(texto).not.toContain('BCV');
  });
});
