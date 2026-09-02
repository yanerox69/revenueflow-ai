import { describe, it, expect } from 'vitest';
import { normalizar, parecido, resolverServicio } from '@/lib/agent/servicio';
import { sanitizeIntent, type ExtractedIntent } from '@/lib/agent/intent';

// El catálogo real de la clínica demo.
const CATALOGO = [
  { id: 'svc-limpieza', name: 'Limpieza dental' },
  { id: 'svc-blanqueo', name: 'Blanqueamiento' },
  { id: 'svc-valoracion', name: 'Consulta de valoración' },
  { id: 'svc-ortodoncia', name: 'Ortodoncia' },
];

describe('Test 31 · Comparar nombres de servicio', () => {
  it('ignora acentos, mayúsculas y puntuación', () => {
    expect(normalizar('  Consulta de VALORACIÓN!  ')).toBe('consulta de valoracion');
  });

  it('cruza idiomas vecinos: limpeza es limpieza', () => {
    // Una letra de diferencia. Exigir igualdad exacta perdería justo el
    // caso que motivó esto.
    expect(parecido('limpeza dental', 'Limpieza dental')).toBeGreaterThan(0.9);
  });

  it('el inglés puntúa por el término técnico que comparten', () => {
    const conLimpieza = parecido('dental cleaning', 'Limpieza dental');
    const conBlanqueo = parecido('dental cleaning', 'Blanqueamiento');

    expect(conLimpieza).toBeGreaterThan(conBlanqueo);
    expect(conBlanqueo).toBe(0);
  });

  it('no confunde servicios que no comparten nada', () => {
    expect(parecido('limpeza dental', 'Blanqueamiento')).toBe(0);
    expect(parecido('Ortodoncia', 'Limpieza dental')).toBe(0);
  });

  it('las palabras vacías no inflan el parecido', () => {
    // "de" no debería acercar "Consulta de valoración" a nada.
    expect(parecido('de', 'Consulta de valoración')).toBe(0);
  });
});

describe('Test 32 · El nombre corrige el id equivocado', () => {
  it('el caso real: pidió limpeza dental y el modelo eligió Blanqueamiento', () => {
    // Pasó en producción con una nota de voz en portugués. El id era
    // válido, existía en el catálogo, y estaba mal.
    const r = resolverServicio({
      id: 'svc-blanqueo',
      nombre: 'limpeza dental',
      catalogo: CATALOGO,
    });

    expect(r.serviceId).toBe('svc-limpieza');
    expect(r.contradiccion).toBe(true);
    expect(r.detalle).toContain('Blanqueamiento');
    expect(r.detalle).toContain('Limpieza dental');
  });

  it('corrige también desde el inglés', () => {
    const r = resolverServicio({
      id: 'svc-valoracion',
      nombre: 'dental cleaning',
      catalogo: CATALOGO,
    });

    expect(r.serviceId).toBe('svc-limpieza');
    expect(r.contradiccion).toBe(true);
  });

  it('no toca nada cuando el id y el nombre concuerdan', () => {
    const r = resolverServicio({
      id: 'svc-limpieza',
      nombre: 'limpieza dental',
      catalogo: CATALOGO,
    });

    expect(r.serviceId).toBe('svc-limpieza');
    expect(r.contradiccion).toBe(false);
    expect(r.detalle).toBeNull();
  });

  it('conserva el id si el nombre no distingue nada', () => {
    // "una cita" no señala ningún servicio. Sin señal, no se inventa una
    // corrección: eso sería cambiar un error por otro.
    const r = resolverServicio({
      id: 'svc-blanqueo',
      nombre: 'una cita',
      catalogo: CATALOGO,
    });

    expect(r.serviceId).toBe('svc-blanqueo');
    expect(r.contradiccion).toBe(false);
  });

  it('rescata el servicio cuando el modelo no dio id pero sí nombre', () => {
    const r = resolverServicio({
      id: null,
      nombre: 'limpeza dental',
      catalogo: CATALOGO,
    });

    expect(r.serviceId).toBe('svc-limpieza');
    // No hay contradicción: no había id con el que contradecirse.
    expect(r.contradiccion).toBe(false);
  });

  it('no revienta con un catálogo vacío ni sin nombre', () => {
    expect(resolverServicio({ id: 'x', nombre: 'y', catalogo: [] }).serviceId).toBeNull();
    expect(
      resolverServicio({ id: 'svc-limpieza', nombre: null, catalogo: CATALOGO }).serviceId,
    ).toBe('svc-limpieza');
    expect(
      resolverServicio({ id: 'svc-limpieza', nombre: '   ', catalogo: CATALOGO }).serviceId,
    ).toBe('svc-limpieza');
  });
});

describe('Test 33 · La barrera completa', () => {
  const base: ExtractedIntent = {
    service_id: 'svc-blanqueo',
    service_name: 'limpeza dental',
    intent: 'AGENDAR',
    urgency: 'NORMAL',
    weekday: 4,
    relative_day: 'NONE',
    period: 'AFTERNOON',
    language: 'pt',
    summary: 'Quer uma limpeza na quinta.',
    needs_human: false,
    confidence: 0.95,
  };

  it('corrige el servicio sin escalar a una persona', () => {
    // La contradicción se resuelve sola. Molestar a alguien del equipo
    // cuando el nombre lo aclara sería tirar el trabajo del agente.
    const limpio = sanitizeIntent(base, CATALOGO);

    expect(limpio.service_id).toBe('svc-limpieza');
    expect(limpio.needs_human).toBe(false);
  });

  it('sigue escalando si el id es inventado y el nombre no salva nada', () => {
    const limpio = sanitizeIntent(
      { ...base, service_id: 'svc-fantasma', service_name: 'algo raro' },
      CATALOGO,
    );

    expect(limpio.service_id).toBeNull();
    expect(limpio.needs_human).toBe(true);
  });

  it('un id inventado se rescata si el nombre sí es claro', () => {
    const limpio = sanitizeIntent(
      { ...base, service_id: 'svc-fantasma', service_name: 'limpeza dental' },
      CATALOGO,
    );

    expect(limpio.service_id).toBe('svc-limpieza');
    // Aun así escala: el modelo inventó un id, y eso mancha el resto de su
    // respuesta. Que el servicio se recupere no lo vuelve fiable.
    expect(limpio.needs_human).toBe(true);
  });
});
