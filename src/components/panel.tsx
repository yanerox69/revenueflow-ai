import type { CountryPack } from '@/lib/country';

export interface CitaProxima {
  id: string;
  starts_at: string;
  status: string;
  created_by_ai: boolean;
  reminder_sent_at: string | null;
  servicio: string | null;
  contacto: string | null;
  telefono: string | null;
}

export interface ConversacionReciente {
  id: string;
  contacto: string | null;
  telefono: string | null;
  canal: string;
  ai_mode: string;
  last_message_at: string | null;
  ultimo: { direction: string; body: string | null; transcription: string | null } | null;
}

/** Tarjeta de métrica. */
export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tracking-tight text-card-foreground">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Seccion({
  titulo,
  cuenta,
  children,
}: {
  titulo: string;
  cuenta?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <header className="flex items-baseline justify-between border-b border-border px-5 py-4">
        <h2 className="text-[15px] font-bold tracking-tight">{titulo}</h2>
        {cuenta !== undefined && cuenta > 0 && (
          <span className="text-xs text-muted-foreground">{cuenta}</span>
        )}
      </header>
      {children}
    </section>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-muted-foreground">{children}</p>;
}

/** Próximas citas, con quién las agendó y si ya se avisó al cliente. */
export function ListaCitas({
  citas,
  pack,
  locale,
}: {
  citas: CitaProxima[];
  pack: CountryPack;
  locale: string;
}) {
  if (!citas.length) {
    return (
      <Vacio>
        No hay citas próximas.
        <br />
        Graba una nota de voz abajo y aparecerá aquí.
      </Vacio>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {citas.map((c) => {
        const cuando = new Intl.DateTimeFormat(locale, {
          timeZone: pack.timezone,
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(new Date(c.starts_at));

        return (
          <li key={c.id} className="flex items-start justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-card-foreground">
                {c.servicio ?? 'Cita'}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {c.contacto ?? c.telefono ?? 'Sin contacto'}
              </p>
              <p className="mt-1.5 text-sm capitalize text-card-foreground">{cuando}</p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1.5">
              {c.created_by_ai && <Etiqueta tono="acento">Agendada por IA</Etiqueta>}
              <Etiqueta tono={c.reminder_sent_at ? 'ok' : 'neutro'}>
                {c.reminder_sent_at ? 'Recordatorio enviado' : 'Recordatorio pendiente'}
              </Etiqueta>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Conversaciones recientes: lo que dijo el cliente y quién atiende. */
export function ListaConversaciones({
  conversaciones,
  pack,
  locale,
}: {
  conversaciones: ConversacionReciente[];
  pack: CountryPack;
  locale: string;
}) {
  if (!conversaciones.length) {
    return <Vacio>Todavía no hay conversaciones.</Vacio>;
  }

  return (
    <ul className="divide-y divide-border">
      {conversaciones.map((c) => {
        const texto = c.ultimo?.transcription ?? c.ultimo?.body ?? null;
        const esNuestro = c.ultimo?.direction === 'OUT';

        const cuando = c.last_message_at
          ? new Intl.DateTimeFormat(locale, {
              timeZone: pack.timezone,
              day: 'numeric',
              month: 'short',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            }).format(new Date(c.last_message_at))
          : null;

        return (
          <li key={c.id} className="px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="truncate text-[15px] font-semibold text-card-foreground">
                {c.contacto ?? c.telefono ?? 'Desconocido'}
              </p>
              {cuando && (
                <span className="shrink-0 text-xs text-muted-foreground">{cuando}</span>
              )}
            </div>

            {texto ? (
              <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {esNuestro && <span className="text-card-foreground">Tú: </span>}
                {texto}
              </p>
            ) : (
              <p className="mt-1.5 text-sm italic text-muted-foreground">
                Nota de voz sin transcribir
              </p>
            )}

            <div className="mt-2 flex flex-wrap gap-1.5">
              <Etiqueta tono="neutro">{c.canal}</Etiqueta>
              <Etiqueta tono={c.ai_mode === 'AI' ? 'acento' : 'neutro'}>
                {c.ai_mode === 'AI' ? 'Atiende la IA' : 'Atiende una persona'}
              </Etiqueta>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Etiqueta({
  children,
  tono,
}: {
  children: React.ReactNode;
  tono: 'acento' | 'ok' | 'neutro';
}) {
  const estilos = {
    acento: 'bg-accent/12 text-accent',
    ok: 'bg-primary/12 text-primary',
    neutro: 'bg-muted text-muted-foreground',
  } as const;

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estilos[tono]}`}>
      {children}
    </span>
  );
}
