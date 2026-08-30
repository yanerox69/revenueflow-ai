'use client';

import { useRef, useState } from 'react';
import { Button, Field, FormError } from '@/components/ui';

type Phase = 'idle' | 'recording' | 'uploading' | 'done' | 'error';

type Outcome =
  | { kind: 'BOOKED'; startsAt: string; label: string; serviceName: string }
  | { kind: 'NO_AVAILABILITY'; serviceName: string }
  | { kind: 'NEEDS_HUMAN'; reason: string }
  | { kind: 'NO_ACTION'; reason: string };

interface Agent {
  outcome: Outcome;
  intent: { summary: string; urgency: string; confidence: number };
  reply: { text: string; delivery: 'SENT' | 'SKIPPED' | 'FAILED'; deliveryReason?: string };
}

interface Result {
  transcription: string | null;
  detectedLanguage: string | null;
  confidence: number | null;
  durationSeconds: number | null;
  languageMismatch: boolean;
  agent: Agent | null;
}

export function VoiceRecorder({ samplePhone }: { samplePhone: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string>();
  const [phone, setPhone] = useState(samplePhone);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const raf = useRef<number>(0);
  const audioCtx = useRef<AudioContext | null>(null);

  async function start() {
    setError(undefined);
    setResult(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('No se pudo acceder al micrófono. Revisa los permisos del navegador.');
      setPhase('error');
      return;
    }

    // Medidor de nivel: sin esto no se sabe si está grabando de verdad.
    const ctx = new AudioContext();
    audioCtx.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buffer = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(buffer);
      let peak = 0;
      for (const v of buffer) peak = Math.max(peak, Math.abs(v - 128));
      setLevel(Math.min(1, peak / 60));
      raf.current = requestAnimationFrame(tick);
    };
    tick();

    chunks.current = [];
    const mr = new MediaRecorder(stream);
    mr.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      cancelAnimationFrame(raf.current);
      void ctx.close();
      void upload(new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' }));
    };

    recorder.current = mr;
    mr.start();

    setSeconds(0);
    setPhase('recording');
    timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  }

  function stop() {
    if (timer.current) clearInterval(timer.current);
    recorder.current?.stop();
    setLevel(0);
    setPhase('uploading');
  }

  async function upload(blob: Blob) {
    const form = new FormData();
    form.append('audio', blob, 'nota.webm');
    form.append('from', phone);

    try {
      const res = await fetch('/api/voice', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'No se pudo procesar el audio.');
        setPhase('error');
        return;
      }
      setResult(data);
      setPhase('done');
    } catch {
      setError('Se perdió la conexión al enviar el audio.');
      setPhase('error');
    }
  }

  const busy = phase === 'uploading';

  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-lg font-bold tracking-tight">Prueba la recepción</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Graba una nota de voz como lo haría un cliente por WhatsApp. Por ejemplo:
        <em> «Hola, necesito una cita para una limpieza dental, para el jueves si se puede.»</em>
      </p>

      <div className="mt-5 max-w-xs">
        <Field
          label="Teléfono del cliente"
          name="from"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={phase === 'recording' || busy}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        {phase === 'recording' ? (
          <Button onClick={stop} className="w-auto px-5">
            <StopIcon /> Detener · {formatClock(seconds)}
          </Button>
        ) : (
          <Button onClick={start} disabled={busy} className="w-auto px-5">
            <MicIcon /> {busy ? 'Transcribiendo…' : 'Grabar nota de voz'}
          </Button>
        )}

        {phase === 'recording' && <LevelMeter level={level} />}
      </div>

      <div aria-live="polite" className="mt-5">
        {phase === 'error' && <FormError message={error} />}

        {busy && (
          <div className="space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        )}

        {phase === 'done' && result && <Transcript result={result} />}
      </div>
    </section>
  );
}

function Transcript({ result }: { result: Result }) {
  if (!result.transcription) {
    return (
      <p className="text-sm text-muted-foreground">
        No se detectó voz en el audio. Intenta hablar más cerca del micrófono.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-primary/25 bg-primary/6 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Transcripción
      </p>
      <p className="mt-2 text-[15px] leading-relaxed text-card-foreground">
        “{result.transcription}”
      </p>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        {result.detectedLanguage && <Chip>Idioma: {result.detectedLanguage}</Chip>}
        {result.confidence != null && (
          <Chip>Confianza: {Math.round(result.confidence * 100)}%</Chip>
        )}
        {result.durationSeconds != null && (
          <Chip>{result.durationSeconds.toFixed(1)} s de audio</Chip>
        )}
      </div>

      {result.languageMismatch && (
        <p className="mt-3 text-xs text-accent">
          El idioma detectado no coincide con el del negocio — el agente
          responderá en el idioma del cliente.
        </p>
      )}

      {result.agent && <AgentOutcome agent={result.agent} />}
    </div>
  );
}

/** Lo que el agente HIZO — no lo que respondería. */
function AgentOutcome({ agent }: { agent: Agent }) {
  const { outcome, intent } = agent;

  if (outcome.kind === 'BOOKED') {
    return (
      <>
        <div className="mt-4 rounded-lg border border-accent/40 bg-accent/8 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">
            <CheckIcon /> Cita agendada
          </p>
          <p className="mt-2 text-[17px] font-bold tracking-tight text-card-foreground">
            {outcome.serviceName}
          </p>
          <p className="mt-0.5 text-[15px] capitalize text-card-foreground">{outcome.label}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Sin intervención humana · confianza {Math.round(intent.confidence * 100)}%
          </p>
        </div>
        <ReplyBubble reply={agent.reply} />
      </>
    );
  }

  const messages: Record<string, string> = {
    NO_AVAILABILITY: `No hay disponibilidad para ${
      'serviceName' in outcome ? outcome.serviceName : 'ese servicio'
    } en las próximas dos semanas.`,
    NEEDS_HUMAN: 'reason' in outcome ? outcome.reason : 'Requiere atención humana.',
    NO_ACTION: 'reason' in outcome ? outcome.reason : 'Sin acción automática.',
  };

  const escalated = outcome.kind === 'NEEDS_HUMAN';

  return (
    <div
      className={`mt-4 rounded-lg border p-4 ${
        escalated ? 'border-accent/40 bg-accent/8' : 'border-border bg-muted/50'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {escalated ? 'Escalado a una persona' : 'Sin agendar'}
      </p>
      <p className="mt-2 text-sm text-card-foreground">{messages[outcome.kind]}</p>
      <p className="mt-2 text-xs text-muted-foreground">{intent.summary}</p>
      <ReplyBubble reply={agent.reply} />
    </div>
  );
}

/** Lo que le llega al cliente por WhatsApp. */
function ReplyBubble({ reply }: { reply: Agent['reply'] }) {
  const nota: Record<string, string> = {
    SENT: 'Enviado por WhatsApp',
    SKIPPED: 'WhatsApp no está conectado — así se vería el mensaje',
    FAILED: `No se pudo enviar: ${reply.deliveryReason ?? ''}`,
  };

  return (
    <div className="mt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Respuesta al cliente
      </p>
      <div className="mt-2 max-w-md rounded-2xl rounded-tl-sm border border-border bg-muted/60 px-4 py-3">
        <p className="text-[15px] leading-relaxed text-card-foreground">{reply.text}</p>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{nota[reply.delivery]}</p>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5 8.2l2.1 2.1L11 6.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LevelMeter({ level }: { level: number }) {
  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => {
        const active = level * 14 > i;
        return (
          <span
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${
              active ? 'bg-accent' : 'bg-border'
            }`}
            style={{ height: active ? 6 + i * 1.6 : 6 }}
          />
        );
      })}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-muted px-2.5 py-1">{children}</span>;
}

function formatClock(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
    </svg>
  );
}
