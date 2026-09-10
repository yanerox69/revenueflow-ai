/**
 * Monta el audio 3 del vídeo y lo ajusta a la grabación del demo.
 *
 * Tres cosas pasan aquí, y ninguna es cosmética:
 *
 * 1. SE UNEN DOS TOMAS. La larga tiene todo salvo el final, donde se decía
 *    "el agente lee la conversación" — que suena idéntico a "la gente". Lo
 *    confirmó el propio transcriptor: no oyó "agente" ni dándole el término
 *    como pista, ni con contexto de escena. Si el modelo lo oye mal con toda
 *    la ayuda a favor, el espectador también puede. El final se regrabó
 *    diciendo "RevenueFlow", que no admite confusión.
 *
 * 2. SE CORTAN DOS FRASES que la grabación desmiente:
 *      "Menos de diez segundos" — fueron 13,4 s reales, y en pantalla se ven
 *      23 porque WhatsApp Web tarda en pintar. Un jurado con cronómetro lo
 *      comprueba.
 *      "Cuatro palabras" — la nota grabada dice "¿Me podrías cambiar para el
 *      viernes?", que son seis y llevan la fecha dentro.
 *    Ninguna de las dos hace falta: lo que queda alrededor sigue siendo
 *    cierto y se entiende igual.
 *
 * 3. LOS SILENCIOS SE MIDEN CONTRA EL VÍDEO. Cada bloque hablado entra justo
 *    después del suceso que comenta. Pedirle a alguien que cuente cinco
 *    segundos delante de un micrófono no funciona — salieron de 1,5 s las dos
 *    veces que se intentó.
 *
 *   npx tsx scripts/montar-audio3.mts
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';

const ESCRITORIO = 'C:\\Users\\Yanero\\Desktop';
const VIDEO = path.join(ESCRITORIO, 'Saas', 'video');
const TMP = path.join(VIDEO, 'tmp-audio3');

const TOMA_LARGA = path.join(ESCRITORIO, 'WhatsApp Ptt 2026-09-10 at 9.44.35 AM.ogg');
const TOMA_FINAL = path.join(ESCRITORIO, 'WhatsApp Ptt 2026-09-10 at 9.52.34 AM.ogg');
const SALIDA = path.join(VIDEO, 'Audio3v3.ogg');

for (const f of [TOMA_LARGA, TOMA_FINAL]) {
  if (!existsSync(f)) {
    console.error(`No encuentro ${f}`);
    process.exit(1);
  }
}

const ff = (args: string[]) =>
  execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

/** Entrada y salida suaves. Sin esto, un corte a hueso chasquea. */
const FUNDIDO = 0.02;

/**
 * `-ss` va ANTES de `-i`, y no después.
 *
 * Después de `-i` es un descarte de salida: ffmpeg decodifica el fichero
 * entero, pasa TODO por los filtros y solo al final tira lo que sobra. El
 * filtro nunca ve un trozo que empiece en cero, así que un `afade` de salida
 * programado en el segundo 4 del recorte caía en el segundo 4 del original
 * —antes del recorte— y lo apagaba entero. El montaje salió con 56 segundos
 * de silencio en medio.
 */
function recorte(archivo: string, desde: number, dur: number): string[] {
  return ['-ss', desde.toFixed(3), '-i', archivo, '-t', dur.toFixed(3)];
}

/**
 * Los sucesos de la grabación, en segundos, medidos con detección de cambios
 * sobre el vídeo. Son el esqueleto al que se ajusta la narración.
 */
const VIDEO_SUCESOS = {
  notaUno: 11.8,
  respuestaUno: 34.8,
  refrescoUno: 46.6,
  notaDos: 57.2,
  respuestaDos: 69.0,
  refrescoDos: 76.2,
  fin: 84.9,
};

interface Bloque {
  desde: number;
  hasta: number;
  /** Cuándo debe EMPEZAR el bloque siguiente, en tiempo de vídeo. */
  siguienteEn: number | null;
  que: string;
}

/**
 * Los bloques hablados, recortados de la toma larga.
 *
 * Los saltos entre `hasta` y el `desde` del siguiente son las dos frases
 * cortadas: 34.21→37.13 es "menos de diez segundos", 41.77→43.93 es
 * "cuatro palabras".
 */
const BLOQUES: Bloque[] = [
  {
    desde: 0,
    hasta: 15.81,
    // No cuelga de ningún suceso: la nota ya apareció mientras hablaba. Se
    // fija a mano para repartir la espera hasta la respuesta en dos silencios
    // de seis segundos en vez de uno de once, que se hace eterno.
    siguienteEn: 23.5,
    que: 'presentación — "…desde mi teléfono"',
  },
  {
    desde: 15.81,
    hasta: 20.49,
    siguienteEn: VIDEO_SUCESOS.respuestaUno,
    que: 'sin formulario — "…marque uno para la cita"',
  },
  {
    desde: 20.49,
    hasta: 34.21,
    siguienteEn: null, // se calcula: entra tras el refresco
    que: 'qué hizo — "…agendó la cita"   [cortado: "menos de diez segundos"]',
  },
  {
    desde: 37.13,
    hasta: 41.77,
    siguienteEn: VIDEO_SUCESOS.notaDos,
    que: 'ahí está — "…lo interesante es lo siguiente"   [cortado: "cuatro palabras"]',
  },
  {
    desde: 43.93,
    hasta: 48.71,
    siguienteEn: VIDEO_SUCESOS.respuestaDos,
    que: 'no repito — "…de qué cita hablo"',
  },
];

/** El bloque final regrabado, sin el silencio de los bordes. */
const FINAL_DESDE = 1.9;
const FINAL_HASTA = 21.0;

/**
 * Arranca con un poco de aire.
 *
 * Sin esto, la narración empieza en el fotograma cero y la primera pausa se
 * come once segundos esperando a la respuesta. Retrasar la entrada reparte
 * ese silencio en dos sitios donde no molesta.
 */
const ENTRADA = 2.0;

// --- Ruido de sala ---------------------------------------------------------
// Los dos primeros segundos de la toma final son el cuarto en silencio: el
// mismo suelo de ruido que el resto. Insertar silencio digital puro entre
// dos trozos con ruido de sala suena a corte de señal.
const TONO = path.join(TMP, 'tono.wav');
ff([...recorte(TOMA_FINAL, 0.2, 1.4), '-ac', '1', '-ar', '48000', TONO]);

let n = 0;
function pausa(segundos: number): string {
  const out = path.join(TMP, `pausa-${n++}.wav`);
  ff(['-stream_loop', '-1', '-i', TONO, '-t', segundos.toFixed(3), '-ac', '1', '-ar', '48000', out]);
  return out;
}

// --- Montaje ---------------------------------------------------------------
const piezas: string[] = [pausa(ENTRADA)];
let reloj = ENTRADA; // dónde vamos en el tiempo del vídeo

console.log(`\n  ${ENTRADA.toFixed(1).padStart(5)}s  ⏸ entrada\n`);

BLOQUES.forEach((b, i) => {
  const dur = b.hasta - b.desde;
  const out = path.join(TMP, `bloque-${i}.wav`);

  ff([
    ...recorte(TOMA_LARGA, b.desde, dur),
    '-af',
    `afade=t=in:st=0:d=${FUNDIDO},` +
      `afade=t=out:st=${(dur - FUNDIDO).toFixed(3)}:d=${FUNDIDO}`,
    '-ac', '1', '-ar', '48000',
    out,
  ]);

  piezas.push(out);
  console.log(`  ${dur.toFixed(1).padStart(5)}s  ${b.que}`);
  reloj += dur;

  // El siguiente bloque entra cuando toca según el vídeo. Si ya vamos tarde
  // —el bloque anterior se alargó más allá del suceso— se deja un respiro
  // mínimo en vez de un salto negativo.
  const objetivo = b.siguienteEn ?? reloj + 1.5;
  const espera = Math.max(1.2, objetivo - reloj);

  piezas.push(pausa(espera));
  console.log(`  ${espera.toFixed(1).padStart(5)}s  ⏸`);
  reloj += espera;
});

// --- El final regrabado ----------------------------------------------------
const final = path.join(TMP, 'final.wav');
const durFinal = FINAL_HASTA - FINAL_DESDE;
ff([
  ...recorte(TOMA_FINAL, FINAL_DESDE, durFinal),
  '-af',
  `afade=t=in:st=0:d=${FUNDIDO},` +
    `afade=t=out:st=${(durFinal - 0.3).toFixed(3)}:d=0.3`,
  '-ac', '1', '-ar', '48000',
  final,
]);
piezas.push(final);
reloj += durFinal;
console.log(`  ${durFinal.toFixed(1).padStart(5)}s  cierre (toma nueva)`);

// --- Unir y nivelar --------------------------------------------------------
const lista = path.join(TMP, 'lista.txt');
writeFileSync(lista, piezas.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'), 'utf8');

// El mismo loudnorm que usa el montaje del vídeo, para que suene igual que
// los otros cinco audios.
ff([
  '-f', 'concat', '-safe', '0', '-i', lista,
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
  '-c:a', 'libopus', '-b:a', '64k',
  SALIDA,
]);

const dur = Number(
  execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', SALIDA,
  ], { encoding: 'utf8' }).trim(),
);

rmSync(TMP, { recursive: true, force: true });

console.log(`\n  ${SALIDA}`);
console.log(`  audio ${dur.toFixed(1)}s · vídeo ${VIDEO_SUCESOS.fin}s`);

const sobra = dur - VIDEO_SUCESOS.fin;
if (sobra > 0.5) {
  console.log(`  el audio dura ${sobra.toFixed(1)}s más: el montaje congela el último fotograma`);
} else if (sobra < -0.5) {
  console.log(`  el vídeo dura ${(-sobra).toFixed(1)}s más: sobra cola al final`);
}
console.log('');
