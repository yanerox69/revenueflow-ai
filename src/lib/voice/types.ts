/**
 * Contrato de transcripción.
 *
 * El núcleo habla con esta interfaz, no con AssemblyAI. Si mañana cambia el
 * proveedor, se escribe otro adaptador y nada más se toca.
 */

export interface TranscriptionRequest {
  audio: ArrayBuffer | Uint8Array;
  /**
   * ISO-639-1. A qué idioma se recurre si la detección falla o va con poca
   * confianza. Normalmente el del país del negocio.
   *
   * No se impone: imponerlo hacía que un cliente en otro idioma se
   * transcribiera mal y en silencio.
   */
  fallbackLanguage: string;
  /** Idiomas que es razonable esperar. Guía la detección sin cerrarla. */
  expectedLanguages?: string[];
  contentType?: string;
  /** Descripción en prosa de la escena. Sube bastante la precisión. */
  prompt?: string;
  /** Términos exactos a favorecer: los servicios reales del negocio. */
  keyterms?: string[];
}

export interface TranscriptionResult {
  text: string;
  /** 0–1. Útil para decidir si el agente actúa o escala a un humano. */
  confidence: number | null;
  detectedLanguage: string | null;
  /** 0–1 sobre el idioma detectado. Decide si le hacemos caso. */
  languageConfidence: number | null;
  durationSeconds: number | null;
  providerJobId: string;
}

export class TranscriptionError extends Error {
  constructor(
    message: string,
    readonly providerJobId?: string,
  ) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

export interface Transcriber {
  readonly name: string;
  transcribe(req: TranscriptionRequest): Promise<TranscriptionResult>;
}
