/**
 * Monta el video final a partir de los audios narrados y el material visual.
 *
 *   npx tsx scripts/montar-video.mts
 *
 * Salida: Desktop\Saas\video\RevenueFlow.mp4
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const VIDEO = 'C:\\Users\\Yanero\\Desktop\\Saas\\video';
const MAT = path.join(VIDEO, 'material');
const TMP = path.join(VIDEO, 'tmp');
const SALIDA = path.join(VIDEO, 'RevenueFlow.mp4');

mkdirSync(TMP, { recursive: true });

const ff = (args: string[]) =>
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

function duracion(archivo: string): number {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', archivo,
  ]).toString().trim();
  return parseFloat(out);
}

/**
 * Parámetros idénticos en todos los segmentos: si no, el concat falla.
 *
 * 1080p y no 720p porque el demo enseña el panel de un negocio con texto
 * pequeño, y bajarlo a 720 lo dejaba en el límite de lo legible. Los
 * carteles son de 2560×1440, así que no pierden nada al subir.
 */
const ANCHO = 1920;
const ALTO = 1080;

const V = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
           '-pix_fmt', 'yuv420p', '-r', '30', '-s', `${ANCHO}x${ALTO}`];
const A = ['-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2'];
/** Normaliza el volumen: las seis tomas tienen niveles ligeramente distintos. */
const NORM = 'loudnorm=I=-16:TP=-1.5:LRA=11';

interface Segmento {
  nombre: string;
  audio: string;
  /** Imágenes con su reparto de tiempo. Si es un video, va en `video`. */
  imagenes?: string[];
  video?: string;
  /** Píxeles a quitar de abajo. La grabación de pantalla deja asomar el
   *  fondo de escritorio bajo la ventana del navegador. */
  recortarAbajo?: number;
}

const SEGMENTOS: Segmento[] = [
  { nombre: '1-gancho',   audio: 'DEMO-jueves-tarde.ogg', imagenes: ['c1-titulo.png'] },
  { nombre: '2-intro',    audio: 'Audio1.ogg',  imagenes: ['c1-titulo.png', 'c2-problema.png'] },
  { nombre: '3-problema', audio: 'Audio2.ogg',  imagenes: ['c2-problema.png'] },
  // v2: WhatsApp real a la izquierda y el panel a la derecha, en una toma.
  // El audio va ajustado a los tiempos de esta grabación en concreto — si se
  // vuelve a grabar el demo, hay que rehacerlo con montar-audio3.mts.
  { nombre: '4-demo', audio: 'Audio3v3.ogg', video: 'demo-v2.mp4', recortarAbajo: 20 },
  { nombre: '5-como',     audio: 'Audio4.ogg',  imagenes: ['c3-pipeline.png', 'c4-regla.png'] },
  { nombre: '6-paises',   audio: 'Audio5.ogg',  imagenes: ['c5-paises.png', 'panel-ve.png', 'panel-br.png'] },
  { nombre: '7-cierre',   audio: 'Audio6.ogg',  imagenes: ['c6-cierre.png'] },
];

function rutaAudio(nombre: string): string {
  const enVideo = path.join(VIDEO, nombre);
  if (existsSync(enVideo)) return enVideo;
  return path.resolve('public/demo', nombre); // la nota de voz del cliente
}

const partes: string[] = [];
console.log('\nMontando segmentos…\n');

for (const seg of SEGMENTOS) {
  const audio = rutaAudio(seg.audio);
  const dur = duracion(audio);
  const salida = path.join(TMP, `${seg.nombre}.mp4`);

  if (seg.video) {
    // El demo dura menos que la narración: se congela el último fotograma.
    const src = path.join(MAT, seg.video);
    const relleno = Math.max(0, dur - duracion(src));

    // La grabación no es 16:9. Se ajusta por el lado que quepa y se rellena
    // con negro; estirarla a 1920x1080 deformaría el panel y las caras de
    // WhatsApp, que es de las cosas que más delatan un montaje descuidado.
    const recorte = seg.recortarAbajo
      ? `crop=iw:ih-${seg.recortarAbajo}:0:0,`
      : '';

    ff([
      '-i', src, '-i', audio,
      '-filter_complex',
      `[0:v]${recorte}tpad=stop_mode=clone:stop_duration=${relleno.toFixed(2)},fps=30,` +
        `scale=${ANCHO}:${ALTO}:force_original_aspect_ratio=decrease,` +
        `pad=${ANCHO}:${ALTO}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[v];` +
      `[1:a]${NORM}[a]`,
      '-map', '[v]', '-map', '[a]', '-t', dur.toFixed(2),
      ...V, ...A, salida,
    ]);
  } else {
    // Reparto del tiempo entre las imágenes del segmento.
    const imgs = seg.imagenes!;
    const trozo = dur / imgs.length;
    const entradas: string[] = [];
    const filtros: string[] = [];

    imgs.forEach((img, i) => {
      entradas.push('-loop', '1', '-t', trozo.toFixed(2), '-i', path.join(MAT, img));
      filtros.push(
        `[${i}:v]scale=${ANCHO}:${ALTO}:force_original_aspect_ratio=decrease,` +
        `pad=${ANCHO}:${ALTO}:(ow-iw)/2:(oh-ih)/2:color=0xf8fafc,fps=30,setsar=1[v${i}]`,
      );
    });

    const cadena = imgs.map((_, i) => `[v${i}]`).join('');
    ff([
      ...entradas, '-i', audio,
      '-filter_complex',
      `${filtros.join(';')};${cadena}concat=n=${imgs.length}:v=1:a=0[v];` +
      `[${imgs.length}:a]${NORM}[a]`,
      '-map', '[v]', '-map', '[a]', '-t', dur.toFixed(2),
      ...V, ...A, salida,
    ]);
  }

  partes.push(salida);
  console.log(`  ${seg.nombre.padEnd(12)} ${dur.toFixed(1)}s`);
}

// ---- Unir todo -----------------------------------------------------------
const lista = path.join(TMP, 'lista.txt');
writeFileSync(lista, partes.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'));

console.log('\nUniendo…');
ff(['-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', SALIDA]);

const total = duracion(SALIDA);
const min = Math.floor(total / 60);
const seg = Math.round(total % 60);

console.log(`\n${SALIDA}`);
console.log(`Duración: ${min}:${String(seg).padStart(2, '0')}\n`);
