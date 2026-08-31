import { describe, it, expect } from 'vitest';
import {
  minutosDelDia,
  ordenarPorCercania,
  zonedToUtc,
  localParts,
} from '@/lib/agent/scheduling';

const CARACAS = 'America/Caracas';

/** Huecos de un jueves: 8:00, 9:00, 12:00, 13:00, 14:00, 17:00 hora local. */
const HUECOS = [8, 9, 12, 13, 14, 17].map((h) =>
  zonedToUtc(2026, 9, 4, h, 0, CARACAS),
);

const hora = (d: Date) => localParts(d, CARACAS).hour;

describe('Test 29 · Minutos del día en la zona del negocio', () => {
  it('cuenta desde la medianoche local, no la del servidor', () => {
    expect(minutosDelDia(zonedToUtc(2026, 9, 4, 13, 30, CARACAS), CARACAS)).toBe(810);
    expect(minutosDelDia(zonedToUtc(2026, 9, 4, 0, 0, CARACAS), CARACAS)).toBe(0);
    expect(minutosDelDia(zonedToUtc(2026, 9, 4, 8, 0, CARACAS), CARACAS)).toBe(480);
  });
});

describe('Test 30 · Al reagendar se busca cerca de la hora original', () => {
  it('quien tenía cita a la 1 p. m. no acaba a las 8 a. m.', () => {
    // Este es exactamente el fallo que vimos: "mejor el viernes" movía una
    // cita de la 1:00 p. m. a las 8:00 a. m. porque tomaba el primer hueco.
    const ordenados = ordenarPorCercania(HUECOS, 13 * 60, CARACAS);
    expect(hora(ordenados[0])).toBe(13);
    expect(hora(ordenados[1])).toBe(12);
  });

  it('funciona igual para una cita de la mañana', () => {
    const ordenados = ordenarPorCercania(HUECOS, 9 * 60, CARACAS);
    expect(hora(ordenados[0])).toBe(9);
    expect(hora(ordenados[1])).toBe(8);
  });

  it('si la hora exacta no está libre, ofrece la más cercana', () => {
    const sinLaUna = HUECOS.filter((d) => hora(d) !== 13);
    const ordenados = ordenarPorCercania(sinLaUna, 13 * 60, CARACAS);
    expect([12, 14]).toContain(hora(ordenados[0]));
  });

  it('a igual distancia prefiere el más temprano', () => {
    // 12:00 y 14:00 están a la misma distancia de las 13:00.
    const empate = HUECOS.filter((d) => [12, 14].includes(hora(d)));
    expect(hora(ordenarPorCercania(empate, 13 * 60, CARACAS)[0])).toBe(12);
  });

  it('no pierde ni duplica huecos al ordenar', () => {
    const ordenados = ordenarPorCercania(HUECOS, 13 * 60, CARACAS);
    expect(ordenados).toHaveLength(HUECOS.length);
    expect(new Set(ordenados.map((d) => d.getTime())).size).toBe(HUECOS.length);
  });

  it('no altera la lista original', () => {
    const antes = HUECOS.map((d) => d.getTime());
    ordenarPorCercania(HUECOS, 13 * 60, CARACAS);
    expect(HUECOS.map((d) => d.getTime())).toEqual(antes);
  });
});
