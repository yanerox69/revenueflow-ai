import type { CountryPack } from '@/lib/country';

/** Máximos documentados para pre-grabado con Universal-3.5 Pro. */
const MAX_KEYTERMS = 1000;
const MAX_WORDS_PER_KEYTERM = 6;

export interface VoiceContextInput {
  pack: CountryPack;
  /** Vertical del tenant: 'clinica_dental', 'estetica'… */
  vertical?: string | null;
  businessName?: string | null;
  /** Nombres de los servicios del negocio. */
  serviceNames?: string[];
}

export interface VoiceContext {
  prompt: string;
  keyterms: string[];
}

/** Cómo se llama cada vertical en el idioma del cliente. */
const VERTICAL_LABELS: Record<string, { es: string; pt: string }> = {
  clinica_dental: { es: 'una clínica dental', pt: 'uma clínica odontológica' },
  estetica: { es: 'un centro de estética', pt: 'um centro de estética' },
  barberia: { es: 'una barbería', pt: 'uma barbearia' },
  taller: { es: 'un taller mecánico', pt: 'uma oficina mecânica' },
  veterinaria: { es: 'una veterinaria', pt: 'uma clínica veterinária' },
  gimnasio: { es: 'un gimnasio', pt: 'uma academia' },
};

/**
 * Construye el contexto que se le entrega al modelo.
 *
 * `prompt` describe la escena en prosa; `keyterms_prompt` lleva los términos
 * exactos. Son complementarios: la documentación pide explícitamente NO meter
 * listas de palabras dentro del prompt.
 */
export function buildVoiceContext(input: VoiceContextInput): VoiceContext {
  const { pack, vertical, businessName, serviceNames = [] } = input;
  const lang = pack.speechLanguage === 'pt' ? 'pt' : 'es';

  const business =
    (vertical && VERTICAL_LABELS[vertical]?.[lang]) ??
    (lang === 'pt' ? 'um negócio de serviços' : 'un negocio de servicios');

  // Nivel "escenario": describe de qué va el audio sin inventar detalles.
  const prompt =
    lang === 'pt'
      ? `Mensagem de voz de um cliente no WhatsApp para ${business}` +
        `${businessName ? ` (${businessName})` : ''} em ${pack.displayName}, ` +
        'pedindo informações ou marcando um horário.'
      : `Nota de voz de un cliente por WhatsApp a ${business}` +
        `${businessName ? ` (${businessName})` : ''} en ${pack.displayName}, ` +
        'pidiendo información o solicitando una cita.';

  return { prompt, keyterms: sanitizeKeyterms(serviceNames) };
}

/**
 * Los nombres de servicio vienen de la base y pueden ser cualquier cosa.
 * Se recortan a los límites de la API antes de enviarlos.
 */
export function sanitizeKeyterms(terms: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of terms) {
    const term = raw?.trim().replace(/\s+/g, ' ');
    if (!term) continue;
    if (term.split(' ').length > MAX_WORDS_PER_KEYTERM) continue;

    const key = term.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    out.push(term);
    if (out.length >= MAX_KEYTERMS) break;
  }

  return out;
}
