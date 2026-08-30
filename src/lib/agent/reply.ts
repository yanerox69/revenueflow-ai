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

    case 'NEEDS_HUMAN':
    case 'NO_ACTION':
      return pt
        ? 'Obrigado pela mensagem. Vou passar para alguém da equipe para te ajudar melhor.'
        : 'Gracias por tu mensaje. Te paso con alguien del equipo para ayudarte mejor.';
  }
}

/** Cierra una frase con punto, salvo que ya termine en uno. */
export function endSentence(text: string): string {
  const t = text.trimEnd();
  return t.endsWith('.') ? t : `${t}.`;
}
