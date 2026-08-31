import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getPack, withUsdEquivalent, type Money } from '@/lib/country';
import { logout } from '@/lib/actions/auth';
import { Logo, Button } from '@/components/ui';
import { VoiceRecorder } from '@/components/voice-recorder';
import {
  Stat,
  Seccion,
  ListaCitas,
  ListaPorCerrar,
  ListaConversaciones,
  type CitaProxima,
  type ConversacionReciente,
} from '@/components/panel';

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
    .select('full_name, role')
    .eq('id', user.id)
    .single();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name, country_code, locale, primary_currency, display_currency, fx_source')
    .single();

  if (!profile || !tenant) {
    return (
      <EmptyState message="Tu cuenta no tiene un negocio asociado. Contacta a soporte." />
    );
  }

  const pack = getPack(tenant.country_code);
  const ahora = new Date().toISOString();

  const [
    { count: contactos },
    { count: leads },
    { data: citasRaw },
    { data: convsRaw },
    { count: agendadasIa },
  ] = await Promise.all([
    supabase.from('contacts').select('*', { count: 'exact', head: true }),
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase
      .from('appointments')
      .select(
        'id, starts_at, status, created_by_ai, reminder_sent_at, confirmed_at, services(name), contacts(name, phone_e164)',
      )
      .gte('starts_at', ahora)
      .not('status', 'eq', 'CANCELLED')
      .order('starts_at')
      .limit(8),
    supabase
      .from('conversations')
      .select('id, channel, ai_mode, last_message_at, contacts(name, phone_e164)')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(6),
    supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('created_by_ai', true),
  ]);

  // Citas ya pasadas que siguen abiertas: el negocio tiene que cerrarlas.
  const { data: porCerrarRaw } = await supabase
    .from('appointments')
    .select(
      'id, starts_at, status, created_by_ai, reminder_sent_at, confirmed_at, services(name), contacts(name, phone_e164)',
    )
    .lt('ends_at', ahora)
    .in('status', ['SCHEDULED', 'CONFIRMED'])
    .order('starts_at', { ascending: false })
    .limit(8);

  const aCita = (c: Record<string, unknown>): CitaProxima => ({
    id: c.id as string,
    starts_at: c.starts_at as string,
    status: c.status as string,
    created_by_ai: c.created_by_ai as boolean,
    reminder_sent_at: (c.reminder_sent_at as string | null) ?? null,
    confirmed_at: (c.confirmed_at as string | null) ?? null,
    servicio: (c.services as { name?: string } | null)?.name ?? null,
    contacto: (c.contacts as { name?: string } | null)?.name ?? null,
    telefono: (c.contacts as { phone_e164?: string } | null)?.phone_e164 ?? null,
  });

  const citas: CitaProxima[] = (citasRaw ?? []).map(aCita);
  const porCerrar: CitaProxima[] = (porCerrarRaw ?? []).map(aCita);

  // El último mensaje de cada conversación, en una sola consulta.
  interface FilaMensaje {
    conversation_id: string;
    direction: string;
    body: string | null;
    transcription: string | null;
  }

  const ids = (convsRaw ?? []).map((c) => c.id);
  let mensajes: FilaMensaje[] = [];

  if (ids.length) {
    const { data } = await supabase
      .from('messages')
      .select('conversation_id, direction, body, transcription, created_at')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false })
      .limit(60);
    mensajes = (data ?? []) as FilaMensaje[];
  }

  // La consulta viene ordenada por fecha descendente: el primero que aparece
  // de cada conversación es el más reciente.
  const ultimoPorConv = new Map<string, FilaMensaje>();
  for (const m of mensajes) {
    if (!ultimoPorConv.has(m.conversation_id)) ultimoPorConv.set(m.conversation_id, m);
  }

  const conversaciones: ConversacionReciente[] = (convsRaw ?? []).map((c) => {
    const m = ultimoPorConv.get(c.id);
    return {
      id: c.id,
      canal: c.channel,
      ai_mode: c.ai_mode,
      last_message_at: c.last_message_at,
      contacto: (c.contacts as { name?: string } | null)?.name ?? null,
      telefono: (c.contacts as { phone_e164?: string } | null)?.phone_e164 ?? null,
      ultimo: m
        ? { direction: m.direction, body: m.body, transcription: m.transcription }
        : null,
    };
  });

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
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Logo />
          <form action={logout}>
            <Button variant="ghost" type="submit" className="w-auto px-3.5 text-sm">
              Salir
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">
        <p className="text-sm text-muted-foreground">Buen día, {profile.full_name}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{tenant.name}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Tag>{pack.displayName}</Tag>
          <Tag>{roleLabel(profile.role)}</Tag>
          <Tag>{tenant.primary_currency}</Tag>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Citas próximas" value={citas.length} />
          <Stat
            label="Agendadas por IA"
            value={agendadasIa ?? 0}
            hint="sin intervención humana"
          />
          <Stat label="Contactos" value={contactos ?? 0} />
          <Stat label="Leads" value={leads ?? 0} />
        </div>

        <div className="mt-6">
          <VoiceRecorder samplePhone={pack.samplePhone} />
        </div>

        {porCerrar.length > 0 && (
          <div className="mt-6">
            <Seccion titulo="Pendientes de cerrar" cuenta={porCerrar.length}>
              <ListaPorCerrar citas={porCerrar} pack={pack} locale={tenant.locale} />
            </Seccion>
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Seccion titulo="Próximas citas" cuenta={citas.length}>
            <ListaCitas citas={citas} pack={pack} locale={tenant.locale} />
          </Seccion>

          <Seccion titulo="Conversaciones recientes" cuenta={conversaciones.length}>
            <ListaConversaciones
              conversaciones={conversaciones}
              pack={pack}
              locale={tenant.locale}
            />
          </Seccion>
        </div>

        <p className="mt-8 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Los importes se guardan con su tasa y su equivalente: {pack.formatMoney(sample)}.
          El audio se transcribe en el idioma que dicta el <em>country pack</em>.
          Un mismo motor, dos mercados.
        </p>
      </main>
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
