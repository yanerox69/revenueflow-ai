/**
 * Contrato de transcripción.
 *
 * El núcleo habla con esta interfaz, no con AssemblyAI. Si mañana cambia el
 * proveedor, se escribe otro adaptador y nada más se toca.
 */

export interface TranscriptionRequest {
  audio: ArrayBuffer | Uint8Array;
  /**
   * ISO-639-1. NO fuerza el idioma de la transcripción: el proveedor detecta
   * el idioma real del audio automáticamente, porque un cliente puede
   * escribirle a un negocio en un idioma distinto al del país del tenant.
   * Este valor solo se usa como referencia si la detección no es concluyente.
   */
  language: string;
  /**
   * Lista ORDENADA de respaldo para `speech_models`. La aporta el CountryPack
   * del tenant. Si se omite, el adaptador usa su propio default.
   */
  speechModels?: readonly string[];
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
  /** 0–1. Confianza de la detección automática de idioma, no de la transcripción. */
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
