import { AssemblyAI } from 'assemblyai';
import {
  TranscriptionError,
  type Transcriber,
  type TranscriptionRequest,
  type TranscriptionResult,
} from './types';

/**
 * Lista ORDENADA de respaldo, no ejecución en paralelo: se intenta el primero
 * y se cae al siguiente si no está disponible.
 *
 * Es obligatorio pasarla: si se omite, la API aplica su propio default
 * (`universal-3-pro`) y te quedas sin el modelo insignia sin enterarte.
 */
const SPEECH_MODELS = ['universal-3-5-pro', 'universal-2'];

export interface AssemblyAIOptions {
  apiKey?: string;
  client?: AssemblyAI;
}

export class AssemblyAITranscriber implements Transcriber {
  readonly name = 'assemblyai';
  private readonly client: AssemblyAI;

  constructor(opts: AssemblyAIOptions = {}) {
    if (opts.client) {
      this.client = opts.client;
      return;
    }

    const apiKey = opts.apiKey ?? process.env.ASSEMBLYAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Falta ASSEMBLYAI_API_KEY. Créala en assemblyai.com/dashboard/api-keys ' +
          'y ponla en .env.local.',
      );
    }
    // El SDK se encarga de subida, envío y polling.
    this.client = new AssemblyAI({ apiKey });
  }

  async transcribe(req: TranscriptionRequest): Promise<TranscriptionResult> {
    const audio = Buffer.from(
      req.audio instanceof Uint8Array ? req.audio : new Uint8Array(req.audio),
    );

    const params: Record<string, unknown> = {
      audio,
      speech_models: req.speechModels ?? SPEECH_MODELS,
      language_code: req.language,
      punctuate: true,
      format_text: true,
    };

    if (req.prompt) params.prompt = req.prompt;
    if (req.keyterms?.length) params.keyterms_prompt = req.keyterms;

    let transcript;
    try {
      transcript = await this.client.transcripts.transcribe(
        params as Parameters<typeof this.client.transcripts.transcribe>[0],
      );
    } catch (e) {
      throw new TranscriptionError(`Falló la transcripción: ${(e as Error).message}`);
    }

    if (transcript.status === 'error') {
      throw new TranscriptionError(
        transcript.error ?? 'El proveedor reportó un error sin detalle.',
        transcript.id,
      );
    }

    return {
      text: (transcript.text ?? '').trim(),
      confidence: transcript.confidence ?? null,
      detectedLanguage: transcript.language_code ?? null,
      durationSeconds: transcript.audio_duration ?? null,
      providerJobId: transcript.id,
    };
  }
}
