import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPack, withUsdEquivalent, type Money } from '@/lib/country';
import { logout } from '@/lib/actions/auth';
import { Logo, Button } from '@/components/ui';
import { VoiceRecorder } from '@/components/voice-recorder';

export const dynamic = 'force-dynamic';

export default async function PanelPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Todo lo que sigue pasa por RLS: solo puede devolver datos de este tenant.
  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role, tenant_id')
    .eq('id', user.id)
    .single();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, country_code, primary_currency, display_currency, fx_source')
    .single();

  if (!profile || !tenant) {
    return (
      <EmptyState message="Tu cuenta no tiene un negocio asociado. Contacta a soporte." />
    );
  }

  const pack = getPack(tenant.country_code);

  const [{ count: contactCount }, { count: leadCount }] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
  ]);

  // Tasa vigente, solo si el país usa doble moneda.
  let rate: string | undefined;
  if (pack.displayCurrency) {
    const { data } = await supabase
      .from('fx_rates')
      .select('rate')
      .eq('country_code', pack.code)
      .order('effective_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    rate = data?.rate != null ? String(data.rate) : undefined;
  }

  const sample: Money = withUsdEquivalent({
    amountMinor: 184500n,
    currency: tenant.primary_currency,
    fxRate: rate,
    fxSource: tenant.fx_source ?? undefined,
    fxAt: new Date(),
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-border rf-glass">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Logo />
          <form action={logout}>
            <Button variant="ghost" type="submit" className="w-auto px-3.5 text-sm">
              Salir
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8">
        <p className="text-sm text-muted-foreground">Buen día, {profile.full_name}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{tenant.name}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Tag>{pack.displayName}</Tag>
          <Tag>{roleLabel(profile.role)}</Tag>
          <Tag>{tenant.primary_currency}</Tag>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Contactos" value={contactCount ?? 0} />
          <Stat label="Leads" value={leadCount ?? 0} />
          <Stat
            label={
              pack.displayCurrency
                ? 'Formato de moneda (doble)'
                : 'Formato de moneda'
            }
            value={pack.formatMoney(sample)}
            small
          />
        </div>

        <div className="mt-8">
          <VoiceRecorder samplePhone={pack.samplePhone} />
        </div>

        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          El monto de arriba es el mismo dato en la base para ambos países, y el
          audio se transcribe en el idioma que dicta el <em>country pack</em>.
          Un mismo motor, dos mercados.
        </p>
      </main>
    </div>
  );
}

function Stat({
  label,
  value,
  small,
}: {
  label: string;
  value: string | number;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 font-bold tracking-tight text-card-foreground ${
          small ? 'text-lg' : 'text-3xl'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <p className="max-w-sm text-center text-muted-foreground">{message}</p>
    </main>
  );
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Propietario',
  MANAGER: 'Gerente',
  RECEPTIONIST: 'Recepción',
  STAFF: 'Equipo',
};

function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}
