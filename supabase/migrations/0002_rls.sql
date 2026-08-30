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
