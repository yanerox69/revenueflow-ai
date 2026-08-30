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
