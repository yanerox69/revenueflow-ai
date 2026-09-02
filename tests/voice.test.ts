import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import type { AssemblyAI } from 'assemblyai';
import { AssemblyAITranscriber } from '@/lib/voice/assemblyai';
import { TranscriptionError } from '@/lib/voice/types';
import { buildVoiceContext, sanitizeKeyterms } from '@/lib/voice/context';
import { getPack } from '@/lib/country';

/** Cliente del SDK falso que captura los parámetros enviados. */
function fakeClient(response: Record<string, unknown>) {
  const transcribe = vi.fn(async (params: Record<string, unknown>) => {
    void params;
    return response;
  });
  return {
    client: { transcripts: { transcribe } } as unknown as AssemblyAI,
    transcribe,
  };
}

const OK_RESPONSE = {
  id: 'job_1',
  status: 'completed',
  text: 'Necesito una cita para una limpieza dental el jueves.',
  confidence: 0.94,
  language_code: 'es',
  audio_duration: 6.2,
  error: null,
};

describe('Test 9 · El country pack sugiere, no impone', () => {
  it('define el idioma de respaldo por país', () => {
    expect(getPack('VE').speechLanguage).toBe('es');
    expect(getPack('BR').speechLanguage).toBe('pt');
  });

  it('envía el modelo insignia explícitamente', async () => {
    const { client, transcribe } = fakeClient(OK_RESPONSE);
    await new AssemblyAITranscriber({ client }).transcribe({
      audio: new Uint8Array([1, 2, 3]),
      fallbackLanguage: 'es',
    });

    const params = transcribe.mock.calls[0][0] as Record<string, unknown>;

    // Omitirlo haría que la API caiga a universal-3-pro sin avisar.
    expect(params.speech_models).toEqual(['universal-3-5-pro', 'universal-2']);
    expect(params.punctuate).toBe(true);
  });

  it('detecta el idioma en vez de imponerlo', async () => {
    // Con `language_code` fijo, un cliente que hablara otro idioma se
    // transcribía mal y en silencio. Ahora se detecta.
    const { client, transcribe } = fakeClient(OK_RESPONSE);
    await new AssemblyAITranscriber({ client }).transcribe({
      audio: new Uint8Array([1]),
      fallbackLanguage: 'es',
      expectedLanguages: ['es', 'pt', 'en'],
    });

    const params = transcribe.mock.calls[0][0] as Record<string, unknown>;
    const opts = params.language_detection_options as Record<string, unknown>;

    expect(params.language_detection).toBe(true);
    expect(params).not.toHaveProperty('language_code');
    expect(opts.expected_languages).toEqual(['es', 'pt', 'en']);
    expect(opts.fallback_language).toBe('es');
  });

  it('una nota con ruido cae al idioma del país en vez de fallar entera', () => {
    // El valor por defecto de la API es "error". Perder el acento es
    // recuperable; perder el mensaje del cliente, no.
    const { client, transcribe } = fakeClient(OK_RESPONSE);
    return new AssemblyAITranscriber({ client })
      .transcribe({ audio: new Uint8Array([1]), fallbackLanguage: 'pt' })
      .then(() => {
        const params = transcribe.mock.calls[0][0] as Record<string, unknown>;
        const opts = params.language_detection_options as Record<string, unknown>;

        expect(opts.on_low_language_confidence).toBe('fallback');
        expect(opts.code_switching).toBe(true);
        expect(opts.fallback_language).toBe('pt');
      });
  });

  it('pasa prompt y keyterms cuando se aportan', async () => {
    const { client, transcribe } = fakeClient(OK_RESPONSE);
    await new AssemblyAITranscriber({ client }).transcribe({
      audio: new Uint8Array([1]),
      fallbackLanguage: 'es',
      prompt: 'Nota de voz de un cliente a una clínica dental.',
      keyterms: ['Limpieza dental', 'Blanqueamiento'],
    });

    const params = transcribe.mock.calls[0][0] as Record<string, unknown>;
    expect(params.prompt).toContain('clínica dental');
    expect(params.keyterms_prompt).toEqual(['Limpieza dental', 'Blanqueamiento']);
  });

  it('omite keyterms si el negocio no tiene servicios cargados', async () => {
    const { client, transcribe } = fakeClient(OK_RESPONSE);
    await new AssemblyAITranscriber({ client }).transcribe({
      audio: new Uint8Array([1]),
      fallbackLanguage: 'es',
      keyterms: [],
    });

    const params = transcribe.mock.calls[0][0] as Record<string, unknown>;
    expect(params).not.toHaveProperty('keyterms_prompt');
  });

  it('devuelve el resultado normalizado', async () => {
    const { client } = fakeClient(OK_RESPONSE);
    const result = await new AssemblyAITranscriber({ client }).transcribe({
      audio: new Uint8Array([1]),
      fallbackLanguage: 'es',
    });

    expect(result.text).toContain('limpieza dental');
    expect(result.confidence).toBe(0.94);
    expect(result.durationSeconds).toBe(6.2);
    expect(result.providerJobId).toBe('job_1');
  });
});

describe('Test 10 · La transcripción falla de forma explícita', () => {
  it('convierte el estado de error en TranscriptionError, no en texto vacío', async () => {
    const { client } = fakeClient({
      id: 'job_2',
      status: 'error',
      text: null,
      error: 'Audio demasiado corto',
    });

    await expect(
      new AssemblyAITranscriber({ client }).transcribe({
        audio: new Uint8Array([1]),
        fallbackLanguage: 'es',
      }),
    ).rejects.toThrow(TranscriptionError);
  });

  it('envuelve una excepción del SDK', async () => {
    const client = {
      transcripts: {
        transcribe: vi.fn(async () => {
          throw new Error('network down');
        }),
      },
    } as unknown as AssemblyAI;

    await expect(
      new AssemblyAITranscriber({ client }).transcribe({
        audio: new Uint8Array([1]),
        fallbackLanguage: 'es',
      }),
    ).rejects.toThrow(/network down/);
  });
});

describe('Test 11 · La firma del webhook de WhatsApp', () => {
  const SECRET = 'app-secret-de-prueba';

  function verify(raw: string, header: string | null): boolean {
    if (!header?.startsWith('sha256=')) return false;
    const expected = createHmac('sha256', SECRET).update(raw, 'utf8').digest();
    const received = Buffer.from(header.slice(7), 'hex');
    if (received.length !== expected.length) return false;
    return expected.equals(received);
  }

  const body = JSON.stringify({ entry: [{ changes: [] }] });
  const good = 'sha256=' + createHmac('sha256', SECRET).update(body, 'utf8').digest('hex');

  it('acepta una firma válida', () => expect(verify(body, good)).toBe(true));
  it('rechaza el cuerpo alterado', () => expect(verify(body + ' ', good)).toBe(false));
  it('rechaza si no hay firma', () => expect(verify(body, null)).toBe(false));
  it('rechaza longitud distinta sin lanzar', () => {
    expect(() => verify(body, 'sha256=abcd')).not.toThrow();
    expect(verify(body, 'sha256=abcd')).toBe(false);
  });
});

describe('Test 12 · Contexto de voz por país y vertical', () => {
  it('describe la escena en español para un tenant venezolano', () => {
    const { prompt } = buildVoiceContext({
      pack: getPack('VE'),
      vertical: 'clinica_dental',
      businessName: 'Clínica Dental Sonrisa',
    });

    expect(prompt).toContain('clínica dental');
    expect(prompt).toContain('Venezuela');
    expect(prompt).toContain('cita');
  });

  it('describe la escena en portugués para un tenant brasileño', () => {
    const { prompt } = buildVoiceContext({
      pack: getPack('BR'),
      vertical: 'estetica',
      businessName: 'Studio Bella',
    });

    expect(prompt).toContain('centro de estética');
    expect(prompt).toContain('Brasil');
    expect(prompt).not.toContain('cita'); // no debe colarse español
  });

  it('usa una descripción genérica si el vertical es desconocido', () => {
    const { prompt } = buildVoiceContext({ pack: getPack('VE'), vertical: 'algo_raro' });
    expect(prompt).toContain('negocio de servicios');
  });

  it('convierte los servicios del negocio en keyterms', () => {
    const { keyterms } = buildVoiceContext({
      pack: getPack('VE'),
      serviceNames: ['Limpieza dental', 'Blanqueamiento', 'Limpieza dental'],
    });

    expect(keyterms).toEqual(['Limpieza dental', 'Blanqueamiento']); // deduplicado
  });
});

describe('Límites de keyterms', () => {
  it('descarta frases de más de 6 palabras', () => {
    expect(sanitizeKeyterms(['una frase de exactamente siete palabras aquí'])).toEqual([]);
    expect(sanitizeKeyterms(['seis palabras exactas van a pasar'])).toHaveLength(1);
  });

  it('normaliza espacios y descarta vacíos', () => {
    expect(sanitizeKeyterms(['  Limpieza   dental ', '', '   '])).toEqual(['Limpieza dental']);
  });

  it('no supera el tope de 1000 términos', () => {
    const many = Array.from({ length: 1200 }, (_, i) => `servicio${i}`);
    expect(sanitizeKeyterms(many)).toHaveLength(1000);
  });
});
