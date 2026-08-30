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

/** Aviso informativo — no es un error. */
export function FormNotice({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-2 rounded-lg border border-primary/30
                 bg-primary/8 px-3.5 py-3 text-sm text-card-foreground"
    >
      <svg viewBox="0 0 16 16" className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 7.5v4M8 5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

/** Botón de acceso con Google. */
export function GoogleButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2.5
                 rounded-lg border border-border px-4 text-[15px] font-semibold
                 text-foreground transition-colors duration-150 hover:bg-muted"
    >
      <svg viewBox="0 0 18 18" className="h-[18px] w-[18px]" aria-hidden="true">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
        <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
      </svg>
      {label}
    </button>
  );
}

/** Separador entre métodos de acceso. */
export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="h-px flex-1 bg-border" />
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
