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
