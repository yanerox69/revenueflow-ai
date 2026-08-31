-- =====================================================================
-- Recordatorios y recuperación.
--
-- Dos mensajes automáticos por cita:
--   1. Recordatorio el día antes, pidiendo confirmación.
--   2. Seguimiento después, que recupera a quien no fue.
--
-- NO se marca la cita como NO_SHOW automáticamente: el sistema no sabe si
-- la persona asistió. Solo el negocio lo sabe. Adivinarlo produce mensajes
-- embarazosos ("no pudimos verte" a alguien que sí fue) y datos falsos.
-- =====================================================================

alter table appointments
  add column reminder_sent_at  timestamptz,
  add column confirmed_at      timestamptz,
  add column follow_up_sent_at timestamptz;

-- Buscar citas pendientes de aviso sin recorrer la tabla entera.
create index appointments_pendiente_recordatorio
  on appointments (tenant_id, starts_at)
  where status in ('SCHEDULED','CONFIRMED') and reminder_sent_at is null;

create index appointments_pendiente_seguimiento
  on appointments (tenant_id, ends_at)
  where follow_up_sent_at is null;

comment on column appointments.reminder_sent_at is
  'Cuándo se envió el recordatorio. NULL = pendiente. Sirve de llave de '
  'idempotencia: el cron puede correr mil veces sin duplicar mensajes.';
comment on column appointments.follow_up_sent_at is
  'Cuándo se envió el seguimiento posterior a la cita.';
