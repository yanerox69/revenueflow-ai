-- =====================================================================
-- La tabla de control de migraciones no es dato de tenant, pero vive en
-- `public` y por lo tanto PostgREST la expone. Sin RLS, cualquiera con la
-- clave publicable podría listarla.
--
-- La detectó el propio auditor (tables_without_rls). Se cierra:
-- RLS activa y SIN políticas = nadie la lee por la API. Las migraciones
-- siguen funcionando porque corren por conexión directa, no por PostgREST.
-- =====================================================================

alter table if exists _migrations enable row level security;
alter table if exists _migrations force row level security;

revoke all on table _migrations from anon, authenticated;
