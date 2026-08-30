-- =====================================================================
-- RevenueFlow · TODAS LAS MIGRACIONES EN UN SOLO ARCHIVO
-- Generado por: npm run build:sql — no editar a mano.
-- =====================================================================

-- ===== 0001_fundacion.sql =====

-- =====================================================================
-- RevenueFlow · Fundación multipaís
-- 14 tablas. Toda tabla de tenant lleva tenant_id y RLS.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Enums -----------------------------------------------------
create type user_role       as enum ('OWNER','MANAGER','RECEPTIONIST','STAFF');
create type lead_status     as enum ('NEW','CONTACTED','QUALIFIED','BOOKED','WON','LOST');
create type ai_mode         as enum ('AI','HUMAN','HYBRID');
create type conv_status     as enum ('OPEN','PENDING','CLOSED');
create type msg_direction   as enum ('IN','OUT');
create type appt_status     as enum ('SCHEDULED','CONFIRMED','COMPLETED','NO_SHOW','CANCELLED');
create type urgency_level   as enum ('LOW','NORMAL','HIGH','EMERGENCY');

-- ---------- Núcleo ----------------------------------------------------
create table tenants (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  country_code      char(2) not null,
  locale            text not null,
  timezone          text not null,
  vertical          text,
  primary_currency  char(3) not null,
  display_currency  char(3),
  fx_source         text,
  tax_id            text,
  tax_id_kind       text,
  is_demo           boolean not null default false,
  created_at        timestamptz not null default now()
);

create table tenant_settings (
  tenant_id              uuid primary key references tenants(id) on delete cascade,
  business_hours         jsonb not null default '{}'::jsonb,
  lunch_break            jsonb,
  ai_enabled             boolean not null default true,
  escalation_phone       text,
  currency_display_mode  text not null default 'DUAL'
);

create table users (
  -- FK real contra auth.users: sin ella, register_tenant podría crear un
  -- tenant para un usuario inexistente y dejarlo huérfano (test 4).
  id          uuid primary key references auth.users(id) on delete cascade,
  tenant_id   uuid not null references tenants(id) on delete cascade,
  email       text not null,
  full_name   text not null,
  role        user_role not null default 'STAFF',
  created_at  timestamptz not null default now(),
  unique (tenant_id, email)
);
create index on users (tenant_id);

-- ---------- CRM -------------------------------------------------------
create table contacts (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references tenants(id) on delete cascade,
  name             text not null,
  phone_e164       text not null,
  email            text,
  personal_id      text,
  preferred_locale text,
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now(),
  unique (tenant_id, phone_e164)   -- el teléfono ES la clave real en WhatsApp
);
create index on contacts (tenant_id);

create table leads (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references tenants(id) on delete cascade,
  contact_id             uuid not null references contacts(id) on delete cascade,
  source                 text not null default 'whatsapp',
  status                 lead_status not null default 'NEW',
  urgency                urgency_level not null default 'NORMAL',
  service_type           text,
  estimated_amount_minor bigint,
  estimated_currency     char(3),
  fx_rate                numeric(18,6),
  fx_source              text,
  fx_at                  timestamptz,
  usd_equivalent_minor   bigint,
  is_demo                boolean not null default false,
  created_at             timestamptz not null default now(),

  -- Un tenant con doble moneda no puede guardar un monto sin su tasa.
  constraint leads_money_needs_fx check (
    estimated_amount_minor is null
    or estimated_currency is null
    or fx_rate is not null
    or estimated_currency = 'BRL'
  )
);
create index on leads (tenant_id, status);

-- ---------- Conversaciones -------------------------------------------
create table conversations (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  channel         text not null default 'whatsapp',
  status          conv_status not null default 'OPEN',
  ai_mode         ai_mode not null default 'AI',
  last_message_at timestamptz,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now()
);
create index on conversations (tenant_id, last_message_at desc);

create table messages (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction       msg_direction not null,
  body            text,
  media_url       text,
  transcription   text,          -- notas de voz: requisito duro en LatAm
  external_id     text,
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (tenant_id, external_id)  -- idempotencia de webhooks
);
create index on messages (tenant_id, conversation_id, created_at);

-- ---------- Servicios y agenda ---------------------------------------
create table services (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  name               text not null,
  duration_minutes   int not null default 60,
  price_amount_minor bigint,
  price_currency     char(3),
  is_demo            boolean not null default false
);
create index on services (tenant_id);

create table availability_rules (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  weekday    int not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  capacity   int not null default 1,
  is_demo    boolean not null default false,
  check (end_time > start_time)
);
create index on availability_rules (tenant_id, weekday);

create table appointments (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  lead_id    uuid references leads(id) on delete set null,
  service_id uuid references services(id) on delete set null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  status     appt_status not null default 'SCHEDULED',
  is_demo    boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on appointments (tenant_id, starts_at);

-- ---------- Tasas de cambio (global, no de tenant) -------------------
create table fx_rates (
  id           uuid primary key default gen_random_uuid(),
  country_code char(2) not null,
  source       text not null,
  rate         numeric(18,6) not null check (rate > 0),
  effective_at timestamptz not null,
  fetched_at   timestamptz not null default now(),
  unique (country_code, source, effective_at)
);

-- ---------- LGPD ------------------------------------------------------
create table consent_records (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  contact_id  uuid not null references contacts(id) on delete cascade,
  purpose     text not null,
  legal_basis text not null,
  granted_at  timestamptz,
  revoked_at  timestamptz,
  source      text
);
create index on consent_records (tenant_id, contact_id);

-- ---------- Uso y costo ----------------------------------------------
create table ai_runs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  model           text not null,
  input_tokens    int not null default 0,
  output_tokens   int not null default 0,
  cost_usd_minor  bigint not null default 0,
  created_at      timestamptz not null default now()
);
create index on ai_runs (tenant_id, created_at);

create table usage_events (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references tenants(id) on delete cascade,
  kind        text not null,
  quantity    numeric not null default 1,
  occurred_at timestamptz not null default now()
);
create index on usage_events (tenant_id, occurred_at);


-- ===== 0002_rls.sql =====

-- =====================================================================
-- RevenueFlow · Aislamiento entre tenants (RLS) + integridad de dinero
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. El literal de país no puede vivir en el esquema.
--    Sustituimos el CHECK por un trigger que consulta al tenant.
-- ---------------------------------------------------------------------
alter table leads drop constraint if exists leads_money_needs_fx;

create or replace function enforce_money_fx()
returns trigger
language plpgsql
as $$
declare
  dual boolean;
begin
  select display_currency is not null
    into dual
    from tenants
   where id = new.tenant_id;

  if dual and new.estimated_amount_minor is not null and new.fx_rate is null then
    raise exception
      'Tenant de doble moneda: todo monto exige fx_rate (lead %)', new.id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger leads_enforce_money_fx
  before insert or update on leads
  for each row execute function enforce_money_fx();

-- ---------------------------------------------------------------------
-- 2. Resolución del tenant del usuario autenticado.
--    SECURITY DEFINER para que no recurse contra la RLS de `users`.
-- ---------------------------------------------------------------------
create or replace function auth_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from users where id = auth.uid()
$$;

revoke all on function auth_tenant_id() from public;
grant execute on function auth_tenant_id() to authenticated;

-- ---------------------------------------------------------------------
-- 3. RLS en todas las tablas de tenant.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  tenant_tables text[] := array[
    'tenant_settings','users','contacts','leads','conversations','messages',
    'services','availability_rules','appointments','consent_records',
    'ai_runs','usage_events'
  ];
begin
  foreach t in array tenant_tables loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);

    execute format($f$
      create policy %I on %I
        for all
        to authenticated
        using (tenant_id = auth_tenant_id())
        with check (tenant_id = auth_tenant_id())
    $f$, t || '_tenant_isolation', t);
  end loop;
end $$;

-- `tenants` se aísla por su propia PK.
alter table tenants enable row level security;
alter table tenants force row level security;

create policy tenants_tenant_isolation on tenants
  for all
  to authenticated
  using (id = auth_tenant_id())
  with check (id = auth_tenant_id());

-- `fx_rates` es referencia global, de solo lectura para los usuarios.
alter table fx_rates enable row level security;
alter table fx_rates force row level security;

create policy fx_rates_read on fx_rates
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------
-- 4. Registro atómico: usuario + tenant + rol OWNER, o nada.
-- ---------------------------------------------------------------------
create or replace function register_tenant(
  p_user_id       uuid,
  p_email         text,
  p_full_name     text,
  p_business_name text,
  p_country_code  char(2),
  p_locale        text,
  p_timezone      text,
  p_primary_currency char(3),
  p_display_currency char(3),
  p_fx_source     text,
  p_tax_id_kind   text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  insert into tenants (
    name, country_code, locale, timezone,
    primary_currency, display_currency, fx_source, tax_id_kind
  )
  values (
    p_business_name, p_country_code, p_locale, p_timezone,
    p_primary_currency, p_display_currency, p_fx_source, p_tax_id_kind
  )
  returning id into v_tenant_id;

  insert into tenant_settings (tenant_id) values (v_tenant_id);

  insert into users (id, tenant_id, email, full_name, role)
  values (p_user_id, v_tenant_id, p_email, p_full_name, 'OWNER');

  return v_tenant_id;
end;
$$;

revoke all on function register_tenant(uuid,text,text,text,char,text,text,char,char,text,text) from public;


-- ===== 0003_rls_audit.sql =====

-- =====================================================================
-- Auditoría de RLS.
-- Si alguien agrega una tabla y olvida la política, este test lo canta.
-- =====================================================================

create or replace function tables_without_rls()
returns table (table_name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.relname::text
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind = 'r'
     and c.relrowsecurity = false
   order by 1
$$;

revoke all on function tables_without_rls() from public;
