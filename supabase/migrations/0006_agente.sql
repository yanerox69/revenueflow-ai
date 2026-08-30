-- =====================================================================
-- El agente no conversa: actúa.
-- Se registra QUÉ decidió y con qué evidencia, para poder auditarlo.
-- =====================================================================

alter table appointments
  add column created_by_ai   boolean not null default false,
  add column source_message_id uuid references messages(id) on delete set null;

alter table leads
  add column intent_summary text,
  add column intent_confidence numeric(4,3);

-- Un negocio no puede tener dos citas en el mismo horario con el mismo
-- recurso. Sin esto, dos audios simultáneos reservan el mismo hueco.
create unique index appointments_no_doble_reserva
  on appointments (tenant_id, starts_at)
  where status in ('SCHEDULED','CONFIRMED');

comment on column appointments.created_by_ai is
  'true = la agendó el agente sin intervención humana.';
