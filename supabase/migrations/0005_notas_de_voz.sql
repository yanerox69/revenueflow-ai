-- =====================================================================
-- Notas de voz: el canal real en LatAm.
-- El cliente no escribe, manda 40 segundos de audio.
-- =====================================================================

create type transcription_status as enum ('PENDING','PROCESSING','DONE','FAILED');

alter table messages
  add column media_mime              text,
  add column duration_seconds        numeric(8,2),
  add column transcription_status    transcription_status,
  add column transcription_confidence numeric(4,3),
  add column detected_language       text,
  add column transcription_error     text,
  add column provider_job_id         text;

-- Buscar trabajos de transcripción pendientes sin escanear toda la tabla.
create index messages_transcription_pending
  on messages (tenant_id, transcription_status)
  where transcription_status in ('PENDING','PROCESSING');

-- Cuánto audio procesa cada tenant. A $30/mes esto decide el margen.
alter table usage_events
  add column unit text;

-- El número de WhatsApp del negocio es lo que enruta un webhook a su tenant.
alter table tenant_settings
  add column whatsapp_phone_number_id text;

create unique index tenant_settings_wa_phone
  on tenant_settings (whatsapp_phone_number_id)
  where whatsapp_phone_number_id is not null;

comment on column messages.transcription is
  'Texto de la nota de voz. NULL si el mensaje no traía audio.';
comment on column messages.detected_language is
  'Idioma detectado por el proveedor. Debe coincidir con el pack del tenant.';
