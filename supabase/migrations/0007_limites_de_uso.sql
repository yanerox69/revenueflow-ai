-- =====================================================================
-- Límites de uso.
--
-- El repositorio es público y las credenciales demo están a la vista:
-- cualquiera puede subir audio y consumir créditos de transcripción.
-- Sin esto, una sola petición con un archivo largo vacía la cuenta.
-- =====================================================================

create table rate_limits (
  bucket      text primary key,
  hits        integer not null default 0,
  seconds     numeric(10,2) not null default 0,
  window_ends timestamptz not null
);

-- No es dato de tenant, pero vive en `public` y PostgREST la expondría.
alter table rate_limits enable row level security;
alter table rate_limits force row level security;
revoke all on table rate_limits from anon, authenticated;

create index rate_limits_expiry on rate_limits (window_ends);

comment on table rate_limits is
  'Contadores por ventana. La clave `bucket` nunca contiene una IP en claro: '
  'se guarda su hash, para no almacenar datos personales (LGPD).';

-- ---------------------------------------------------------------------
-- Incremento atómico. Devuelve si la petición cabe dentro del límite.
--
-- Se comprueba ANTES de sumar: si ya se alcanzó el tope, no se incrementa,
-- de modo que reintentar en bucle no empuja la ventana hacia adelante.
-- ---------------------------------------------------------------------
create or replace function bump_rate_limit(
  p_bucket   text,
  p_max_hits integer,
  p_window   interval
)
returns table (allowed boolean, hits integer, resets_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now   timestamptz := now();
  v_hits  integer;
  v_ends  timestamptz;
begin
  insert into rate_limits (bucket, hits, window_ends)
  values (p_bucket, 0, v_now + p_window)
  on conflict (bucket) do update
    set hits        = case when rate_limits.window_ends <= v_now then 0 else rate_limits.hits end,
        seconds     = case when rate_limits.window_ends <= v_now then 0 else rate_limits.seconds end,
        window_ends = case when rate_limits.window_ends <= v_now then v_now + p_window else rate_limits.window_ends end
  returning rate_limits.hits, rate_limits.window_ends into v_hits, v_ends;

  if v_hits >= p_max_hits then
    return query select false, v_hits, v_ends;
    return;
  end if;

  update rate_limits
     set hits = rate_limits.hits + 1
   where rate_limits.bucket = p_bucket
  returning rate_limits.hits into v_hits;

  return query select true, v_hits, v_ends;
end;
$$;

-- ---------------------------------------------------------------------
-- Segundos de audio consumidos por un tenant en la ventana indicada.
-- La fuente es `usage_events`, que ya registra cada transcripción.
-- ---------------------------------------------------------------------
create or replace function tenant_audio_seconds(
  p_tenant_id uuid,
  p_window    interval
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(quantity), 0)
    from usage_events
   where tenant_id = p_tenant_id
     and kind = 'voice_transcription'
     and occurred_at > now() - p_window
$$;

revoke all on function bump_rate_limit(text, integer, interval) from public;
revoke all on function tenant_audio_seconds(uuid, interval) from public;
