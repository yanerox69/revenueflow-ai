import { describe, it, expect } from 'vitest';
import { getPack, listCountryCodes, UnknownCountryError } from '@/lib/country';

describe('Test 6 · Identificadores con dígito verificador real', () => {
  const br = getPack('BR');
  const ve = getPack('VE');

  it('acepta un CPF válido', () => {
    expect(br.validatePersonalId('111.444.777-35')).toBe(true);
  });

  it('rechaza un CPF con dígito verificador incorrecto', () => {
    expect(br.validatePersonalId('111.444.777-36')).toBe(false);
  });

  it('rechaza un CPF de dígitos repetidos', () => {
    expect(br.validatePersonalId('111.111.111-11')).toBe(false);
  });

  it('acepta un CNPJ válido', () => {
    expect(br.validateTaxId('11.222.333/0001-81')).toBe(true);
  });

  it('rechaza un CNPJ con dígito verificador incorrecto', () => {
    expect(br.validateTaxId('11.222.333/0001-82')).toBe(false);
  });

  it('acepta un RIF válido', () => {
    expect(ve.validateTaxId('J-30123456-1')).toBe(true);
  });

  it('rechaza un RIF con dígito verificador incorrecto', () => {
    expect(ve.validateTaxId('J-30123456-9')).toBe(false);
  });

  it('acepta una cédula venezolana bien formada', () => {
    expect(ve.validatePersonalId('V-12345678')).toBe(true);
  });

  it('rechaza una cédula con prefijo inválido', () => {
    expect(ve.validatePersonalId('X-12345678')).toBe(false);
  });
});

describe('Normalización de teléfonos a E.164', () => {
  const br = getPack('BR');
  const ve = getPack('VE');

  it('normaliza un móvil venezolano con cero inicial', () => {
    expect(ve.normalizePhone('0414-123.4567')).toBe('+584141234567');
  });

  it('normaliza un móvil venezolano ya internacional', () => {
    expect(ve.normalizePhone('+58 414 1234567')).toBe('+584141234567');
  });

  it('agrega el noveno dígito a un móvil brasileño antiguo', () => {
    expect(br.normalizePhone('(11) 8765-4321')).toBe('+5511987654321');
  });

  it('respeta un móvil brasileño que ya trae el noveno dígito', () => {
    expect(br.normalizePhone('+55 11 98765-4321')).toBe('+5511987654321');
  });

  it('no agrega noveno dígito a un fijo brasileño', () => {
    expect(br.normalizePhone('(11) 3456-7890')).toBe('+551134567890');
  });
});

describe('Registro de packs', () => {
  it('expone los países disponibles', () => {
    expect(listCountryCodes().sort()).toEqual(['BR', 'VE']);
  });

  it('falla con un país desconocido en vez de devolver undefined', () => {
    expect(() => getPack('XX')).toThrow(UnknownCountryError);
  });

  it('cada pack trae su propio modelo de audio y de texto', () => {
    for (const code of listCountryCodes()) {
      const pack = getPack(code);
      expect(pack.speechModels.length).toBeGreaterThan(0);
      expect(pack.llmModel.length).toBeGreaterThan(0);
    }
  });
});
