import type { CountryPack } from '@/lib/country';
import type { AgentOutcome } from './handle-voice-note';

/**
 * Redacta la respuesta al cliente.
 *
 * A propósito NO pasa por el modelo: este mensaje contiene hechos —servicio,
 * día, hora— que deben ser exactos. Una alucinación aquí es una cita perdida
 * en la vida real. El modelo interpreta; las plantillas confirman.
 *
 * El tono sale de la persona del country pack, para que suene local.
 */
export function composeReply(outcome: AgentOutcome, pack: CountryPack): string {
  const pt = pack.speechLanguage === 'pt';
  const { appointment, confirmations } = pack.persona;
  const ok = confirmations[0] ?? (pt ? 'pronto' : 'listo');
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  switch (outcome.kind) {
    case 'BOOKED':
      // El formato de hora en español ya termina en punto ("1:45 p. m."),
      // así que no se le agrega otro.
      return pt
        ? `${cap(ok)}! Agendei ${outcome.serviceName} para ` +
          `${endSentence(outcome.label)} ` +
          `Se precisar remarcar, é só me chamar por aqui.`
        : `¡${cap(ok)}! Te agendé ${outcome.serviceName} para el ` +
          `${endSentence(outcome.label)} ` +
          `Si necesitas cambiar la ${appointment}, escríbeme por aquí.`;

    case 'NO_AVAILABILITY':
      return pt
        ? `Obrigado pela mensagem. Não tenho horário para ${outcome.serviceName} ` +
          `nas próximas duas semanas. Vou passar para alguém da equipe ` +
          `encontrar um espaço para você.`
        : `Gracias por escribir. No tengo cupo para ${outcome.serviceName} en ` +
          `las próximas dos semanas. Te paso con alguien del equipo para ` +
          `buscarte un espacio.`;

    case 'RESCHEDULED':
      return pt
        ? `${cap(ok)}! Mudei seu ${outcome.serviceName} para ` +
            `${endSentence(outcome.label)} O horário anterior fica livre.`
        : `¡${cap(ok)}! Cambié tu ${outcome.serviceName} para el ` +
            `${endSentence(outcome.label)} El horario anterior queda libre.`;

    case 'CONFIRMED':
      return pt
        ? `Perfeito, ${outcome.serviceName} confirmado para ` +
            `${endSentence(outcome.label)} Te espero!`
        : `Perfecto, ${outcome.serviceName} confirmado para el ` +
            `${endSentence(outcome.label)} ¡Te espero!`;

    case 'CANCELLED':
      return pt
        ? `Pronto, cancelei seu ${outcome.serviceName}. Quando quiser ` +
            `remarcar, é só me chamar.`
        : `Listo, cancelé tu ${outcome.serviceName}. Cuando quieras volver ` +
            `a agendar, escríbeme por aquí.`;

    case 'NO_APPOINTMENT':
      return pt
        ? 'Não encontrei nenhum agendamento seu. Quer marcar um?'
        : 'No encontré ninguna cita tuya. ¿Quieres que agende una?';

    case 'NEEDS_HUMAN':
    case 'NO_ACTION':
      return pt
        ? 'Obrigado pela mensagem. Vou passar para alguém da equipe para te ajudar melhor.'
        : 'Gracias por tu mensaje. Te paso con alguien del equipo para ayudarte mejor.';
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
): string {
  return pack.speechLanguage === 'pt'
    ? `Oi! Lembrete do seu ${pack.persona.appointment}: ${serviceName}, ` +
        `${endSentence(cuando)} Confirma que você vem? Se precisar remarcar, ` +
        `é só me avisar.`
    : `¡Hola! Te recuerdo tu ${pack.persona.appointment}: ${serviceName}, ` +
        `${endSentence(cuando)} ¿Me confirmas que vienes? Si necesitas ` +
        `cambiarla, avísame por aquí.`;
}

/**
 * Seguimiento posterior.
 *
 * Redactado a propósito para funcionar tanto si la persona fue como si no.
 * El sistema no sabe cuál de las dos pasó, y un mensaje que da por hecho lo
 * segundo ofende a quien sí asistió.
 */
export function composeFollowUp(serviceName: string, pack: CountryPack): string {
  return pack.speechLanguage === 'pt'
    ? `Oi! Como foi o seu ${serviceName}? Se não conseguiu vir, me escreve ` +
        `e eu remarco sem problema.`
    : `¡Hola! ¿Cómo te fue con tu ${serviceName}? Si no pudiste venir, ` +
        `escríbeme y te reagendo sin problema.`;
}

/** Cierra una frase con punto, salvo que ya termine en uno. */
export function endSentence(text: string): string {
  const t = text.trimEnd();
  return t.endsWith('.') ? t : `${t}.`;
}
