import { describe, it, expect } from 'vitest';
import { composeReminder, composeFollowUp } from '@/lib/agent/reply';
import { getPack } from '@/lib/country';

const VE = getPack('VE');
const BR = getPack('BR');
const CUANDO_ES = 'jueves, 3 de septiembre, 1:00 p. m.';
const CUANDO_PT = 'quinta-feira, 3 de setembro, 13:00';

describe('Test 22 · Recordatorio del día antes', () => {
  it('nombra el servicio y la fecha exactos', () => {
    const t = composeReminder('Limpieza dental', CUANDO_ES, VE);
    expect(t).toContain('Limpieza dental');
    expect(t).toContain('jueves, 3 de septiembre');
  });

  it('pide confirmación explícita', () => {
    // Sin pregunta no hay confirmación, y sin confirmación no se recupera
    // el hueco: el negocio se entera cuando ya es tarde.
    expect(composeReminder('Limpieza dental', CUANDO_ES, VE)).toMatch(/confirmas/i);
    expect(composeReminder('Limpeza de pele', CUANDO_PT, BR)).toMatch(/confirma/i);
  });

  it('ofrece reagendar en lugar de solo avisar', () => {
    expect(composeReminder('X', CUANDO_ES, VE)).toMatch(/cambiarla|avísame/i);
  });

  it('habla en el idioma del negocio', () => {
    const br = composeReminder('Limpeza de pele', CUANDO_PT, BR);
    expect(br).toContain('agendamento');
    expect(br).not.toContain('¿'); // sin español mezclado
  });

  it('no duplica el punto cuando la hora ya termina en uno', () => {
    expect(composeReminder('X', CUANDO_ES, VE)).not.toContain('..');
  });
});

describe('Test 23 · Seguimiento posterior a la cita', () => {
  // La propiedad que importa: el sistema NO sabe si la persona asistió.
  // El mensaje tiene que servir en ambos casos.
  it('no da por hecho que la persona faltó', () => {
    const t = composeFollowUp('Limpieza dental', VE);

    expect(t).not.toMatch(/no viniste|no pudimos verte|faltaste|te esperamos/i);
    expect(t).toMatch(/cómo te fue/i);
  });

  it('aun así abre la puerta a reagendar', () => {
    // Ahí está la recuperación: quien no fue tiene una vía inmediata.
    expect(composeFollowUp('Limpieza dental', VE)).toMatch(/reagendo|no pudiste venir/i);
  });

  it('funciona igual en portugués', () => {
    const t = composeFollowUp('Limpeza de pele', BR);
    expect(t).toMatch(/como foi/i);
    expect(t).toMatch(/remarco/i);
    expect(t).not.toMatch(/no viniste|faltaste/i);
  });

  it('nombra el servicio para que se entienda de qué cita habla', () => {
    expect(composeFollowUp('Blanqueamiento', VE)).toContain('Blanqueamiento');
  });
});
