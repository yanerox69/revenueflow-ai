import type { CountryPack } from '@/lib/country';
import type { AgentOutcome } from './handle-voice-note';
import { idiomaDelPais, type Idioma } from './idioma';

/**
 * Redacta la respuesta al cliente.
 *
 * A propósito NO pasa por el modelo: este mensaje contiene hechos —servicio,
 * día, hora— que deben ser exactos. Una alucinación aquí es una cita perdida
 * en la vida real. El modelo interpreta; las plantillas confirman.
 *
 * El idioma lo pone quien escribe, no el país del negocio. El tono, cuando
 * coinciden, lo pone la persona del country pack.
 */

interface Vocabulario {
  /** "listo", "pronto", "done" — la muletilla de confirmación. */
  ok: string;
  /** Cómo se llama una cita aquí: "cita", "horário", "appointment". */
  appointment: string;
}

const VOCABULARIO_NEUTRO: Record<Idioma, Vocabulario> = {
  es: { ok: 'listo', appointment: 'cita' },
  pt: { ok: 'pronto', appointment: 'horário' },
  en: { ok: 'done', appointment: 'appointment' },
};

/**
 * La persona del country pack está escrita en el idioma de su país. Usarla
 * al responder en otro idioma mete palabras sueltas del idioma equivocado en
 * mitad de la frase, que queda peor que no tener acento local.
 */
function vocabulario(pack: CountryPack, idioma: Idioma): Vocabulario {
  if (idioma !== idiomaDelPais(pack)) return VOCABULARIO_NEUTRO[idioma];

  return {
    ok: pack.persona.confirmations[0] ?? VOCABULARIO_NEUTRO[idioma].ok,
    appointment: pack.persona.appointment,
  };
}

export function composeReply(
  outcome: AgentOutcome,
  pack: CountryPack,
  idioma: Idioma = idiomaDelPais(pack),
): string {
  const { ok, appointment } = vocabulario(pack, idioma);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  switch (outcome.kind) {
    case 'BOOKED':
      // El formato de hora en español ya termina en punto ("1:45 p. m."),
      // así que no se le agrega otro.
      switch (idioma) {
        case 'pt':
          return (
            `${cap(ok)}! Agendei ${outcome.serviceName} para ` +
            `${endSentence(outcome.label)} ` +
            `Se precisar remarcar, é só me chamar por aqui.`
          );
        case 'en':
          return (
            `${cap(ok)}! I've booked your ${outcome.serviceName} for ` +
            `${endSentence(outcome.label)} ` +
            `If you need to change it, just message me here.`
          );
        default:
          return (
            `¡${cap(ok)}! Te agendé ${outcome.serviceName} para el ` +
            `${endSentence(outcome.label)} ` +
            `Si necesitas cambiar la ${appointment}, escríbeme por aquí.`
          );
      }

    case 'NO_AVAILABILITY':
      switch (idioma) {
        case 'pt':
          return (
            `Obrigado pela mensagem. Não tenho horário para ${outcome.serviceName} ` +
            `nas próximas duas semanas. Vou passar para alguém da equipe ` +
            `encontrar um espaço para você.`
          );
        case 'en':
          return (
            `Thanks for reaching out. I don't have any openings for ` +
            `${outcome.serviceName} in the next two weeks. I'm passing you to ` +
            `someone on the team to find you a slot.`
          );
        default:
          return (
            `Gracias por escribir. No tengo cupo para ${outcome.serviceName} en ` +
            `las próximas dos semanas. Te paso con alguien del equipo para ` +
            `buscarte un espacio.`
          );
      }

    case 'RESCHEDULED':
      switch (idioma) {
        case 'pt':
          return (
            `${cap(ok)}! Mudei seu ${outcome.serviceName} para ` +
            `${endSentence(outcome.label)} O horário anterior fica livre.`
          );
        case 'en':
          return (
            `${cap(ok)}! I moved your ${outcome.serviceName} to ` +
            `${endSentence(outcome.label)} The earlier slot is now free.`
          );
        default:
          return (
            `¡${cap(ok)}! Cambié tu ${outcome.serviceName} para el ` +
            `${endSentence(outcome.label)} El horario anterior queda libre.`
          );
      }

    case 'CONFIRMED':
      switch (idioma) {
        case 'pt':
          return (
            `Perfeito, ${outcome.serviceName} confirmado para ` +
            `${endSentence(outcome.label)} Te espero!`
          );
        case 'en':
          return (
            `Perfect, your ${outcome.serviceName} is confirmed for ` +
            `${endSentence(outcome.label)} See you then!`
          );
        default:
          return (
            `Perfecto, ${outcome.serviceName} confirmado para el ` +
            `${endSentence(outcome.label)} ¡Te espero!`
          );
      }

    case 'CANCELLED':
      switch (idioma) {
        case 'pt':
          return (
            `Pronto, cancelei seu ${outcome.serviceName}. Quando quiser ` +
            `remarcar, é só me chamar.`
          );
        case 'en':
          return (
            `Done, I've cancelled your ${outcome.serviceName}. Whenever you ` +
            `want to book again, just message me here.`
          );
        default:
          return (
            `Listo, cancelé tu ${outcome.serviceName}. Cuando quieras volver ` +
            `a agendar, escríbeme por aquí.`
          );
      }

    case 'NO_APPOINTMENT':
      switch (idioma) {
        case 'pt':
          return 'Não encontrei nenhum agendamento seu. Quer marcar um?';
        case 'en':
          return "I couldn't find any appointment under your name. Would you like to book one?";
        default:
          return 'No encontré ninguna cita tuya. ¿Quieres que agende una?';
      }

    case 'NEEDS_HUMAN':
    case 'NO_ACTION':
      switch (idioma) {
        case 'pt':
          return 'Obrigado pela mensagem. Vou passar para alguém da equipe para te ajudar melhor.';
        case 'en':
          return "Thanks for your message. I'm passing you to someone on the team who can help you better.";
        default:
          return 'Gracias por tu mensaje. Te paso con alguien del equipo para ayudarte mejor.';
      }
  }
}

/**
 * Recordatorio del día antes. Pide confirmación explícita: es lo que
 * convierte una cita olvidada en una cita confirmada o en un hueco que el
 * negocio puede volver a vender.
 */
export function composeReminder(
  serviceName: string,
  cuando: string,
  pack: CountryPack,
  idioma: Idioma = idiomaDelPais(pack),
): string {
  const { appointment } = vocabulario(pack, idioma);

  switch (idioma) {
    case 'pt':
      return (
        `Oi! Lembrete do seu ${appointment}: ${serviceName}, ` +
        `${endSentence(cuando)} Confirma que você vem? Se precisar remarcar, ` +
        `é só me avisar.`
      );
    case 'en':
      return (
        `Hi! Reminder about your ${appointment}: ${serviceName}, ` +
        `${endSentence(cuando)} Can you confirm you're coming? If you need to ` +
        `reschedule, just let me know.`
      );
    default:
      return (
        `¡Hola! Te recuerdo tu ${appointment}: ${serviceName}, ` +
        `${endSentence(cuando)} ¿Me confirmas que vienes? Si necesitas ` +
        `cambiarla, avísame por aquí.`
      );
  }
}

/**
 * Seguimiento posterior.
 *
 * Redactado a propósito para funcionar tanto si la persona fue como si no.
 * El sistema no sabe cuál de las dos pasó, y un mensaje que da por hecho lo
 * segundo ofende a quien sí asistió.
 */
export function composeFollowUp(
  serviceName: string,
  pack: CountryPack,
  idioma: Idioma = idiomaDelPais(pack),
): string {
  switch (idioma) {
    case 'pt':
      return (
        `Oi! Como foi o seu ${serviceName}? Se não conseguiu vir, me escreve ` +
        `e eu remarco sem problema.`
      );
    case 'en':
      return (
        `Hi! How did your ${serviceName} go? If you couldn't make it, message ` +
        `me and I'll rebook you, no problem.`
      );
    default:
      return (
        `¡Hola! ¿Cómo te fue con tu ${serviceName}? Si no pudiste venir, ` +
        `escríbeme y te reagendo sin problema.`
      );
  }
}

/** Cierra una frase con punto, salvo que ya termine en uno. */
export function endSentence(text: string): string {
  const t = text.trimEnd();
  return t.endsWith('.') ? t : `${t}.`;
}
