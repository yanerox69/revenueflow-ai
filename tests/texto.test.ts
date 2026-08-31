import { describe, it, expect } from 'vitest';

/**
 * Réplica de la condición que decide qué mensajes de WhatsApp se procesan.
 * Vive aquí porque es una regla de producto, no un detalle del route handler:
 * si cambia, hay que darse cuenta.
 */
interface MensajeWa {
  type: string;
  audio?: { id: string };
  text?: { body: string };
}

function seProcesa(m: MensajeWa): boolean {
  const esAudio = m.type === 'audio' && Boolean(m.audio?.id);
  const esTexto = m.type === 'text' && Boolean(m.text?.body?.trim());
  return esAudio || esTexto;
}

describe('Test 31 · Qué mensajes de WhatsApp acepta el agente', () => {
  it('acepta una nota de voz', () => {
    expect(seProcesa({ type: 'audio', audio: { id: 'wamid.123' } })).toBe(true);
  });

  it('acepta un mensaje escrito', () => {
    // Un cliente real mezcla audio y texto en la misma conversación.
    expect(seProcesa({ type: 'text', text: { body: 'Hola, quiero una cita' } })).toBe(true);
  });

  it('descarta un texto vacío o de solo espacios', () => {
    expect(seProcesa({ type: 'text', text: { body: '   ' } })).toBe(false);
    expect(seProcesa({ type: 'text', text: { body: '' } })).toBe(false);
  });

  it('descarta un audio sin identificador de medio', () => {
    expect(seProcesa({ type: 'audio' })).toBe(false);
  });

  it('ignora los tipos que el agente no sabe atender', () => {
    // Fingir que entiende una foto o una ubicación sería peor que callar:
    // respondería cualquier cosa a algo que no leyó.
    for (const type of ['image', 'location', 'sticker', 'document', 'video', 'contacts']) {
      expect(seProcesa({ type })).toBe(false);
    }
  });

  it('un texto con emojis o acentos se procesa igual', () => {
    expect(seProcesa({ type: 'text', text: { body: '¿Tienen cita el jueves? 🦷' } })).toBe(true);
  });
});
