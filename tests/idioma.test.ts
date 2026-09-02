import { describe, it, expect } from 'vitest';
import {
  normalizarIdioma,
  resolverIdioma,
  idiomaDelPais,
  idiomasEsperados,
  localeDe,
  usaOtraEscritura,
  CONFIANZA_MINIMA_IDIOMA,
} from '@/lib/agent/idioma';
import { describeSlot } from '@/lib/agent/scheduling';
import { composeReply, composeReminder, composeFollowUp } from '@/lib/agent/reply';
import { getPack } from '@/lib/country';
import type { AgentOutcome } from '@/lib/agent/handle-voice-note';

const VE = getPack('VE');
const BR = getPack('BR');
const CUANDO = 'jueves, 3 de septiembre, 1:00 p. m.';

const BOOKED: AgentOutcome = {
  kind: 'BOOKED',
  appointmentId: 'apt-1',
  startsAt: '2026-09-03T17:00:00Z',
  label: CUANDO,
  serviceName: 'Limpieza dental',
};

describe('Test 24 · Normalización de códigos de idioma', () => {
  it('se queda con las dos primeras letras', () => {
    // Llegan de dos sitios con formatos distintos: AssemblyAI manda BCP-47
    // y el modelo devuelve lo que le apetece.
    expect(normalizarIdioma('es-VE')).toBe('es');
    expect(normalizarIdioma('pt_BR')).toBe('pt');
    expect(normalizarIdioma('EN')).toBe('en');
    expect(normalizarIdioma('  es  ')).toBe('es');
  });

  it('devuelve null para lo que no sabemos responder', () => {
    // Transcribimos 99 idiomas pero solo respondemos en tres. Decir que null
    // es distinto de decir 'es': null deja que decida el país.
    expect(normalizarIdioma('fr')).toBeNull();
    expect(normalizarIdioma('OTRO')).toBeNull();
    expect(normalizarIdioma('')).toBeNull();
    expect(normalizarIdioma(null)).toBeNull();
    expect(normalizarIdioma(undefined)).toBeNull();
  });
});

describe('Test 25 · Quién decide el idioma de la respuesta', () => {
  it('manda el cliente, no el país', () => {
    // Lo que motivó todo esto: un brasileño escribiéndole a una clínica
    // venezolana recibía español.
    expect(resolverIdioma({ detectado: 'pt', confianza: 0.98, pack: VE })).toBe('pt');
    expect(resolverIdioma({ detectado: 'es', confianza: 0.97, pack: BR })).toBe('es');
  });

  it('una detección dudosa no arrastra la conversación', () => {
    const dudosa = CONFIANZA_MINIMA_IDIOMA - 0.01;
    expect(resolverIdioma({ detectado: 'pt', confianza: dudosa, pack: VE })).toBe('es');
    expect(resolverIdioma({ detectado: 'en', confianza: dudosa, pack: BR })).toBe('pt');
  });

  it('un idioma sin plantillas cae al del país', () => {
    // Se transcribe bien, pero contestar en francés no es una opción: no hay
    // plantillas revisadas y el negocio tampoco lo hablaría.
    expect(resolverIdioma({ detectado: 'fr', confianza: 0.99, pack: VE })).toBe('es');
  });

  it('sin detección, el idioma del país', () => {
    expect(resolverIdioma({ detectado: null, pack: VE })).toBe('es');
    expect(resolverIdioma({ detectado: 'pt', confianza: null, pack: BR })).toBe('pt');
  });

  it('el idioma del país sale del pack', () => {
    expect(idiomaDelPais(VE)).toBe('es');
    expect(idiomaDelPais(BR)).toBe('pt');
  });
});

describe('Test 26 · La escritura desmiente al modelo', () => {
  // Caso real: el modelo etiquetó "你好，我需要洗牙" como inglés, y el
  // cliente habría recibido la respuesta en inglés. La escritura es una
  // prueba objetiva que no depende de que el modelo acierte.
  it('reconoce alfabetos que ninguno de los tres idiomas usa', () => {
    expect(usaOtraEscritura('你好，我需要洗牙。星期四下午有空吗？')).toBe(true);
    expect(usaOtraEscritura('Здравствуйте! Мне нужна чистка зубов.')).toBe(true);
    expect(usaOtraEscritura('こんにちは、歯のクリーニングをお願いします')).toBe(true);
    expect(usaOtraEscritura('안녕하세요, 스케일링 예약하고 싶어요')).toBe(true);
    expect(usaOtraEscritura('مرحبا، أريد تنظيف الأسنان')).toBe(true);
  });

  it('no se activa con acentos ni con signos del español', () => {
    // Un falso positivo aquí sería peor que el problema: mandaría a
    // español a clientes que sí escriben en portugués o inglés.
    expect(usaOtraEscritura('¿Tienes algo el jueves? Necesito una limpieza.')).toBe(false);
    expect(usaOtraEscritura('Oi! Preciso de uma limpeza dental na quinta às 13h.')).toBe(false);
    expect(usaOtraEscritura("Hi, I'd like a cleaning — Thursday afternoon?")).toBe(false);
    expect(usaOtraEscritura('Ação, coração, señor, ñandú, über')).toBe(false);
  });
});

describe('Test 27 · Qué idiomas se le piden al transcriptor', () => {
  it('el del país primero, porque es el más probable', () => {
    expect(idiomasEsperados(VE)[0]).toBe('es');
    expect(idiomasEsperados(BR)[0]).toBe('pt');
  });

  it('sin repetir y con los tres', () => {
    const ve = idiomasEsperados(VE);
    expect(new Set(ve).size).toBe(ve.length);
    expect(ve).toEqual(expect.arrayContaining(['es', 'pt', 'en']));
  });
});

describe('Test 28 · La respuesta sale en el idioma del cliente', () => {
  it('responde en portugués a un cliente de un negocio venezolano', () => {
    const texto = composeReply(BOOKED, VE, 'pt');
    expect(texto).toContain('Agendei');
    expect(texto).toContain('Limpieza dental'); // el servicio no se traduce
  });

  it('responde en inglés', () => {
    const texto = composeReply(BOOKED, VE, 'en');
    expect(texto).toMatch(/I've booked/);
  });

  it('no mezcla idiomas al salirse del país', () => {
    // La persona del country pack está escrita en español. Usarla en una
    // frase en portugués mete "cita" en mitad del mensaje.
    const pt = composeReply(BOOKED, VE, 'pt');
    expect(pt).not.toMatch(/¡|¿/);
    expect(pt).not.toMatch(/\bcita\b/);

    const en = composeReply(BOOKED, VE, 'en');
    expect(en).not.toMatch(/¡|¿/);
    expect(en).not.toMatch(/\bcita\b/);
  });

  it('conserva el sabor local cuando el idioma sí es el del país', () => {
    // Esto no se puede perder: es lo que hace que no suene a robot.
    const es = composeReply(BOOKED, VE, 'es');
    expect(es).toContain(VE.persona.appointment);
  });

  it('sin idioma explícito se comporta como antes', () => {
    expect(composeReply(BOOKED, VE)).toBe(composeReply(BOOKED, VE, 'es'));
    expect(composeReply(BOOKED, BR)).toBe(composeReply(BOOKED, BR, 'pt'));
  });

  it('cubre los tres idiomas en todos los desenlaces', () => {
    const casos: AgentOutcome[] = [
      BOOKED,
      { kind: 'RESCHEDULED', appointmentId: 'a', startsAt: 'x', label: CUANDO, serviceName: 'S' },
      { kind: 'CONFIRMED', appointmentId: 'a', label: CUANDO, serviceName: 'S' },
      { kind: 'CANCELLED', appointmentId: 'a', serviceName: 'S' },
      { kind: 'NO_APPOINTMENT' },
      { kind: 'NO_AVAILABILITY', serviceName: 'S' },
      { kind: 'NEEDS_HUMAN', reason: 'r' },
      { kind: 'NO_ACTION', reason: 'r' },
    ];

    for (const caso of casos) {
      for (const idioma of ['es', 'pt', 'en'] as const) {
        const texto = composeReply(caso, VE, idioma);
        expect(texto.length, `${caso.kind}/${idioma}`).toBeGreaterThan(10);
        expect(texto, `${caso.kind}/${idioma}`).not.toContain('..');
      }
    }
  });
});

describe('Test 29 · La hora se dice como se dice en cada sitio', () => {
  // Estaba con `hour12: true` fijo, así que el tenant brasileño llevaba
  // desde el principio diciendo "1:00 PM" en vez de "13:00". No lo pilló
  // nadie porque el fixture de portugués era un string escrito a mano.
  const TARDE = new Date('2026-09-03T17:00:00Z'); // 1 p. m. en Caracas

  it('Venezuela usa 12 horas', () => {
    const texto = describeSlot(TARDE, VE.timezone, localeDe('es', VE));
    expect(texto).toMatch(/1:00/);
    expect(texto).toMatch(/p\.\s?m\./i);
  });

  it('Brasil usa 24 horas', () => {
    const texto = describeSlot(TARDE, BR.timezone, localeDe('pt', BR));
    expect(texto).toMatch(/\b1[34]:00\b/); // 13:00 o 14:00 según el huso
    expect(texto).not.toMatch(/PM|p\.\s?m\./i);
  });

  it('el inglés usa 12 horas aunque el negocio sea brasileño', () => {
    const texto = describeSlot(TARDE, BR.timezone, localeDe('en', BR));
    expect(texto).toMatch(/PM/);
    expect(texto).toMatch(/September/);
  });

  it('un cliente en portugués no recibe la fecha en español', () => {
    // Lo que salió en la primera prueba real: frase en portugués, fecha en
    // español. Delata al robot más que no traducir nada.
    const texto = describeSlot(TARDE, VE.timezone, localeDe('pt', VE));
    expect(texto).toMatch(/setembro/);
    expect(texto).not.toMatch(/septiembre/);
  });
});

describe('Test 30 · Recordatorios en el idioma del contacto', () => {
  // El caso que hace falta que funcione: el cron dispara a las nueve de la
  // mañana sin ningún mensaje entrante del que deducir nada.
  it('recuerda en inglés a quien escribió en inglés', () => {
    const texto = composeReminder('Dental cleaning', CUANDO, VE, 'en');
    expect(texto).toMatch(/Reminder/);
    expect(texto).toMatch(/confirm/i);
    expect(texto).not.toMatch(/¿|¡/);
  });

  it('el seguimiento tampoco da por hecho que faltó, en ningún idioma', () => {
    for (const idioma of ['es', 'pt', 'en'] as const) {
      const texto = composeFollowUp('Limpieza dental', VE, idioma);
      expect(texto, idioma).not.toMatch(/no viniste|faltaste|you missed|você faltou/i);
    }
  });
});
