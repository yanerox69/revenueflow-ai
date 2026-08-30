import type { ComponentProps, ReactNode } from 'react';

export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        viewBox="0 0 32 32"
        className="h-7 w-7 shrink-0"
        aria-hidden="true"
        fill="none"
      >
        <rect width="32" height="32" rx="9" fill="var(--primary)" />
        <path
          d="M9 21.5c3.2 0 4.1-5.4 7-5.4s3.8 5.4 7 5.4"
          stroke="var(--on-primary)"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="23" cy="11" r="2.6" fill="var(--accent)" />
      </svg>
      <span className="text-[17px] font-bold tracking-tight">RevenueFlow</span>
    </span>
  );
}

/** Campo con etiqueta SIEMPRE visible y error junto al campo, no arriba. */
export function Field({
  label,
  name,
  hint,
  error,
  children,
  ...props
}: {
  label: string;
  name: string;
  hint?: string;
  error?: string;
  children?: ReactNode;
} & Omit<ComponentProps<'input'>, 'name'>) {
  const describedBy =
    [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(' ') ||
    undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={name} className="block text-sm font-medium">
        {label}
      </label>

      {children ?? (
        <input
          id={name}
          name={name}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="w-full rounded-lg border border-border bg-card px-3.5 py-2.5
                     text-[15px] text-card-foreground transition-colors duration-150
                     placeholder:text-muted-foreground/70
                     hover:border-primary/40
                     focus:border-primary focus:outline-none"
          {...props}
        />
      )}

      {hint && !error && (
        <p id={`${name}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${name}-error`}
          className="flex items-start gap-1.5 text-xs font-medium text-destructive"
        >
          <svg viewBox="0 0 16 16" className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4.5v4M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {error}
        </p>
      )}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: { variant?: 'primary' | 'ghost' } & ComponentProps<'button'>) {
  const base =
    'inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 ' +
    'rounded-lg px-4 text-[15px] font-semibold transition-all duration-150 ' +
    'disabled:cursor-not-allowed disabled:opacity-60';

  const styles =
    variant === 'primary'
      ? 'bg-primary text-on-primary hover:brightness-110 active:brightness-95'
      : 'border border-border text-foreground hover:bg-muted';

  return (
    <button className={`${base} ${styles} ${className}`} {...props}>
      {children}
    </button>
  );
}

/** Banda de error a nivel de formulario. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-destructive/30
                 bg-destructive/8 px-3.5 py-3 text-sm text-destructive"
    >
      <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4.5v4M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

/** Marco de dos columnas para login y registro. */
export function AuthShell({
  children,
  headline,
  sub,
}: {
  children: ReactNode;
  headline: string;
  sub: string;
}) {
  return (
    <main className="flex min-h-dvh flex-col lg:flex-row">
      {/* Panel de marca — oculto en móvil para no empujar el formulario */}
      <aside className="rf-grid relative hidden lg:flex lg:w-[44%] lg:flex-col
                        lg:justify-between border-r border-border bg-muted/40 p-10 xl:p-14">
        <Logo />
        <div className="max-w-md">
          <h2 className="text-3xl font-bold leading-tight tracking-tight xl:text-[2.5rem]">
            {headline}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
            {sub}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Venezuela · Brasil — cada país con su moneda, sus documentos y su forma
          de hablar.
        </p>
      </aside>

      <section className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </section>
    </main>
  );
}
