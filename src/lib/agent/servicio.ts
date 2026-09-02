import type { ServiceOption } from './intent';

/**
 * Comprueba que el servicio elegido es de verdad el que pidió el cliente.
 *
 * El modelo devuelve un `service_id`, que es un UUID opaco: si se equivoca,
 * no hay forma de notarlo. En una prueba real, un cliente pidió "limpeza
 * dental" y el agente reservó "Blanqueamiento" — el id era válido, existía
 * en el catálogo, y estaba mal.
 *
 * La defensa es pedirle también EL NOMBRE que entendió. Dos respuestas sobre
 * lo mismo se pueden contradecir, y una contradicción sí se detecta. Es el
 * mismo principio que con el día de la semana y con la escritura: el modelo
 * señala, el sistema comprueba.
 */

/** Por debajo de esto, el nombre no se parece a nada del catálogo. */
const UMBRAL_PARECIDO = 0.45;

/** Cuánto tiene que ganar el primero al segundo para considerarse claro. */
const MARGEN_MINIMO = 0.15;

/** Palabras que no distinguen un servicio de otro. */
const VACIAS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'e',
  'do', 'da', 'dos', 'das', 'o', 'os', 'as', 'um', 'uma',
  'the', 'a', 'an', 'of', 'for',
]);

/** Minúsculas, sin acentos y sin puntuación. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function palabras(texto: string): string[] {
  return normalizar(texto)
    .split(' ')
    .filter((p) => p.length > 1 && !VACIAS.has(p));
}

/** Distancia de edición, acotada: no hace falta el valor exacto si es grande. */
function distancia(a: string, b: string): number {
  if (a === b) return 0;

  const fila = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    let anterior = fila[0];
    fila[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const temp = fila[j];
      fila[j] = Math.min(
        fila[j] + 1,
        fila[j - 1] + 1,
        anterior + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      anterior = temp;
    }
  }

  return fila[b.length];
}

/**
 * Dos palabras "iguales" aunque estén en idiomas vecinos.
 *
 * "limpeza" y "limpieza" son la misma palabra con una letra de diferencia.
 * Exigir igualdad exacta perdería justo el caso que motivó todo esto.
 */
function mismaPalabra(a: string, b: string): boolean {
  if (a === b) return true;

  const largo = Math.max(a.length, b.length);
  if (largo < 4) return false;

  return distancia(a, b) / largo <= 0.25;
}

/**
 * Cuánto se parecen dos nombres, de 0 a 1.
 *
 * Coeficiente de Dice sobre palabras, con igualdad difusa. Sirve entre
 * idiomas porque los términos técnicos apenas cambian: "dental cleaning" y
 * "Limpieza dental" comparten "dental", y eso ya los separa de
 * "Blanqueamiento", que no comparte nada.
 */
export function parecido(a: string, b: string): number {
  const pa = palabras(a);
  const pb = palabras(b);
  if (!pa.length || !pb.length) return 0;

  const usadas = new Set<number>();
  let comunes = 0;

  for (const x of pa) {
    for (let i = 0; i < pb.length; i++) {
      if (usadas.has(i)) continue;
      if (mismaPalabra(x, pb[i])) {
        usadas.add(i);
        comunes++;
        break;
      }
    }
  }

  return (2 * comunes) / (pa.length + pb.length);
}

export interface ResolucionServicio {
  /** El id que se va a usar. null si no hay ninguno defendible. */
  serviceId: string | null;
  /** El modelo se contradijo: su id y su nombre apuntan a servicios distintos. */
  contradiccion: boolean;
  /** Para el log: qué dijo el modelo y qué se hizo. */
  detalle: string | null;
}

export interface ResolverServicioInput {
  /** El id que devolvió el modelo. */
  id: string | null;
  /** El nombre del servicio, en las palabras del cliente. */
  nombre: string | null;
  catalogo: ServiceOption[];
}

/**
 * Decide qué servicio se agenda.
 *
 * Cuando el nombre apunta con claridad a un servicio, MANDA EL NOMBRE: está
 * anclado en lo que dijo el cliente, mientras que el id es una elección
 * ciega del modelo. Si el nombre no distingue nada, se conserva el id.
 */
export function resolverServicio(input: ResolverServicioInput): ResolucionServicio {
  const { id, nombre, catalogo } = input;

  const idValido = id && catalogo.some((s) => s.id === id) ? id : null;

  if (!nombre?.trim() || catalogo.length === 0) {
    return { serviceId: idValido, contradiccion: false, detalle: null };
  }

  const puntuados = catalogo
    .map((s) => ({ servicio: s, punto: parecido(nombre, s.name) }))
    .sort((a, b) => b.punto - a.punto);

  const mejor = puntuados[0];
  const segundo = puntuados[1];

  const claro =
    mejor.punto >= UMBRAL_PARECIDO &&
    (!segundo || mejor.punto - segundo.punto >= MARGEN_MINIMO);

  if (!claro) {
    // El nombre no separa un servicio de otro. No hay nada que comprobar.
    return { serviceId: idValido, contradiccion: false, detalle: null };
  }

  if (idValido === mejor.servicio.id) {
    return { serviceId: idValido, contradiccion: false, detalle: null };
  }

  const antes = catalogo.find((s) => s.id === idValido)?.name ?? '(ninguno)';

  return {
    serviceId: mejor.servicio.id,
    contradiccion: idValido != null,
    detalle:
      `el modelo eligió "${antes}" pero entendió "${nombre}"; ` +
      `se agenda "${mejor.servicio.name}"`,
  };
}
