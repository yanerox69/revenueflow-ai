-- El idioma lo pone el cliente, no el país del negocio.
--
-- Hasta aquí `detected_language` se guardaba pero no se usaba para nada: la
-- respuesta salía siempre en el idioma del country pack. Estas dos columnas
-- son lo que falta para que la decisión sea real y sobreviva al mensaje.

-- Cuánta confianza tiene el transcriptor en el idioma que detectó. Sin esto
-- no se puede distinguir "es portugués" de "creo que quizá es portugués", y
-- una detección dudosa arrastraría la conversación entera al idioma erróneo.
alter table public.messages
  add column if not exists language_confidence numeric(4, 3);

comment on column public.messages.language_confidence is
  '0–1 sobre detected_language. Por debajo de 0.5 se prefiere el idioma del país.';

-- El idioma preferido del contacto, aprendido de sus mensajes.
--
-- Va en el contacto y no en el mensaje porque hace falta cuando NO hay
-- mensaje: el recordatorio del día antes lo manda un cron a las 9 de la
-- mañana, sin nada entrante que mirar. Sin esta columna, un cliente
-- brasileño atendido en portugués recibiría el recordatorio en español.
alter table public.contacts
  add column if not exists language text
  check (language is null or language in ('es', 'pt', 'en'));

comment on column public.contacts.language is
  'Idioma en el que se le responde. Se aprende del primer mensaje entendido.';
