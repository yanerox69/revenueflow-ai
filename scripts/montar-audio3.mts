/**
 * Monta el audio 3 del vídeo a partir de dos tomas.
 *
 * La toma larga tiene todo salvo el final: ahí se decía "el agente lee la
 * conversación", que suena idéntico a "la gente" — lo confirmó el propio
 * transcriptor, que no oyó "agente" ni dándole el término como pista. Si el
 * modelo lo oye mal con toda la ayuda a favor, el espectador también puede.
 * El final se regrabó diciendo "RevenueFlow", que no admite confusión.
 *
 * El empalme cae dentro de una pausa de 1,9 s que ya existía, así que no hay
 * costura que oír.
 *
 * Las pausas del guion se insertan aquí en vez de grabarlas: pedirle a
 * alguien que cuente cinco segundos en silencio delante de un micrófono no
 * funciona, y salieron de 1,5 s las dos veces.
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

/**
 * Dónde termina cada bloque y cuánto silencio hay antes de la palabra
 * siguiente, según los tiempos que devolvió el transcriptor.
 *
 * El margen que se deja tras la última palabra NO puede pasar de ese hueco,
 * o el corte se come el principio de la palabra de después. Pasó en el
 * primer montaje: con un margen fijo de 0,25 s y un hueco real de 0,03 s,
 * quedó "…desde mi teléfono, sin [pausa] formulario".
 */
const MARGEN_MAX = 0.2;

/** Entrada y salida suaves. Sin esto, un corte a hueso chasquea. */
const FUNDIDO = 0.02;

/**
 * `-ss` va ANTES de `-i`, y no después.
 *
 * Después de `-i` es un descarte de salida: ffmpeg decodifica el fichero
 * entero, pasa TODO por los filtros, y solo al final tira lo que sobra. El
 * filtro nunca ve un trozo que empiece en cero, así que un `afade` de salida
 * programado en el segundo 4 del recorte caía en el segundo 4 del original
 * —antes del recorte— y lo apagaba entero. El montaje salió con 56 segundos
 * de silencio en medio.
 *
 * Antes de `-i` es una búsqueda de entrada: solo se decodifica el tramo
 * pedido y el reloj empieza en cero, que es lo que espera `afade`.
 */
function recorte(archivo: string, desde: number, dur: number): string[] {
  return ['-ss', desde.toFixed(3), '-i', archivo, '-t', dur.toFixed(3)];
}

interface Bloque {
  hasta: number;
  hueco: number;
  pausa: number;
  que: string;
}

const BLOQUES: Bloque[] = [
  { hasta: 15.79, hueco: 0.03, pausa: 3, que: 'presentación — "…desde mi teléfono"' },
  { hasta: 20.29, hueco: 0.99, pausa: 5, que: 'sin formulario — "…marque uno para citas"' },
  { hasta: 36.89, hueco: 0.24, pausa: 3, que: 'qué hizo — "…menos de diez segundos"' },
  { hasta: 41.29, hueco: 0.68, pausa: 5, que: 'ahí está — "…lo interesante es lo siguiente"' },
  { hasta: 48.51, hueco: 1.88, pausa: 5, que: 'cuatro palabras — "…de qué cita hablo"' },
];

/** El bloque final regrabado, sin el silencio de los bordes. */
const FINAL_DESDE = 1.9;
const FINAL_HASTA = 21.0;

const piezas: string[] = [];

// --- Ruido de sala ---------------------------------------------------------
// Los dos primeros segundos de la toma final son el cuarto en silencio: es
// el mismo suelo de ruido que el resto. Insertar silencio digital puro entre
// dos trozos con ruido de sala suena a corte de señal.
const TONO = path.join(TMP, 'tono.wav');
ff([...recorte(TOMA_FINAL, 0.2, 1.4), '-ac', '1', '-ar', '48000', TONO]);

function pausa(segundos: number, i: number): string {
  const out = path.join(TMP, `pausa-${i}.wav`);
  // Se repite el trozo de ruido de sala hasta cubrir la pausa.
  ff(['-stream_loop', '-1', '-i', TONO, '-t', String(segundos), '-ac', '1', '-ar', '48000', out]);
  return out;
}

// --- Bloques hablados ------------------------------------------------------
let desde = 0;

BLOQUES.forEach((b, i) => {
  // Nunca más allá del 70 % del hueco: deja aire antes de la palabra
  // siguiente aunque el transcriptor se haya desviado un poco.
  const margen = Math.min(MARGEN_MAX, b.hueco * 0.7);
  const hasta = b.hasta + margen;
  const dur = hasta - desde;
  const out = path.join(TMP, `bloque-${i}.wav`);

  ff([
    ...recorte(TOMA_LARGA, desde, dur),
    '-af',
    `afade=t=in:st=0:d=${FUNDIDO},` +
      `afade=t=out:st=${(dur - FUNDIDO).toFixed(3)}:d=${FUNDIDO}`,
    '-ac', '1', '-ar', '48000',
    out,
  ]);

  piezas.push(out, pausa(b.pausa, i));
  console.log(
    `  ${dur.toFixed(1).padStart(5)}s  ${b.que}` +
      `   (margen ${margen.toFixed(2)}s)\n` +
      `  ${String(b.pausa).padStart(5)}s  ⏸`,
  );

  desde = hasta;
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
console.log(`  ${(FINAL_HASTA - FINAL_DESDE).toFixed(1).padStart(5)}s  cierre (toma nueva)`);

// --- Unir y nivelar --------------------------------------------------------
const lista = path.join(TMP, 'lista.txt');
writeFileSync(lista, piezas.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'), 'utf8');

// El mismo loudnorm que usa el montaje del vídeo, para que este audio suene
// igual que los otros cinco.
ff([
  '-f', 'concat', '-safe', '0', '-i', lista,
  '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
  '-c:a', 'libopus', '-b:a', '64k',
  SALIDA,
]);

const dur = execFileSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=noprint_wrappers=1:nokey=1', SALIDA,
], { encoding: 'utf8' }).trim();

rmSync(TMP, { recursive: true, force: true });

console.log(`\n  ${SALIDA}`);
console.log(`  ${Number(dur).toFixed(1)}s\n`);
console.log('  Compruébalo con:');
console.log(`    npx tsx scripts/revisar-narracion.mts "${SALIDA}"\n`);
