/**
 * Revisa una narración grabada: la transcribe y mide los silencios.
 *
 * Sirve para comprobar una toma sin escucharla entera: si el texto coincide
 * con el guion, si las pausas están donde deben, y si la confianza baja en
 * algún punto — que suele significar ruido o que se comió una palabra.
 *
 *   npx tsx scripts/revisar-narracion.mts "C:\ruta\audio.ogg"
 */
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
config({ path: ['.env.local'], quiet: true });

const archivo = process.argv[2];
if (!archivo) {
  console.error('Uso: npx tsx scripts/revisar-narracion.mts <archivo>');
  process.exit(1);
}

const { AssemblyAI } = await import('assemblyai');
const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });

console.log(`\n${archivo}\n`);

const t = await client.transcripts.transcribe({
  audio: readFileSync(archivo),
  speech_models: ['universal-3-5-pro', 'universal-2'],
  language_code: 'es',
  punctuate: true,
  format_text: true,
});

if (t.status === 'error') {
  console.error(`Falló: ${t.error}`);
  process.exit(1);
}

console.log('─'.repeat(70));
console.log('LO QUE SE OYE');
console.log('─'.repeat(70));
console.log(t.text ?? '(nada)');

console.log('\n' + '─'.repeat(70));
console.log(
  `Duración ${t.audio_duration}s · confianza ${((t.confidence ?? 0) * 100).toFixed(1)}%`,
);

// --- Silencios ------------------------------------------------------------
// Las pausas son parte del guion: el montaje ajusta el vídeo al audio, así
// que un silencio que falta se nota en el resultado final.
const palabras = t.words ?? [];
const huecos: Array<{ tras: string; seg: number; en: number }> = [];

for (let i = 1; i < palabras.length; i++) {
  const hueco = (palabras[i].start - palabras[i - 1].end) / 1000;
  if (hueco >= 1.2) {
    huecos.push({
      tras: palabras[i - 1].text,
      seg: hueco,
      en: palabras[i - 1].end / 1000,
    });
  }
}

console.log('─'.repeat(70));
console.log('PAUSAS DE MÁS DE 1,2 s');
console.log('─'.repeat(70));

if (!huecos.length) {
  console.log('  Ninguna. Si el guion las pedía, hay que regrabar o montarlas.');
} else {
  for (const h of huecos) {
    const marca = h.seg >= 2.5 ? '  OK  ' : ' corta';
    console.log(
      `${marca} ${h.seg.toFixed(1)}s  en ${h.en.toFixed(1)}s  tras "…${h.tras}"`,
    );
  }
}

// --- Palabras dudosas ------------------------------------------------------
const flojas = palabras
  .filter((p) => (p.confidence ?? 1) < 0.6)
  .map((p) => `${p.text} (${Math.round((p.confidence ?? 0) * 100)}%)`);

console.log('─'.repeat(70));
if (flojas.length) {
  console.log('PALABRAS QUE SE ENTIENDEN MAL');
  console.log('  ' + flojas.join(' · '));
  console.log('  Suele ser ruido encima, o que se comió la palabra.');
} else {
  console.log('Todas las palabras se entienden con claridad.');
}
console.log('');

// --- Nivel de audio --------------------------------------------------------
// ffmpeg mide el volumen y el ruido de fondo mejor que el oído.
try {
  const salida = execFileSync(
    'ffmpeg',
    ['-i', archivo, '-af', 'volumedetect', '-f', 'null', '-'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  void salida;
} catch (e) {
  const texto = (e as { stderr?: string }).stderr ?? '';
  const medio = texto.match(/mean_volume:\s*(-?[\d.]+) dB/)?.[1];
  const pico = texto.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1];

  if (medio && pico) {
    console.log('─'.repeat(70));
    console.log('NIVEL');
    console.log(`  medio ${medio} dB · pico ${pico} dB`);
    if (Number(pico) > -1) console.log('  ⚠ satura: el pico casi toca el techo');
    if (Number(medio) < -30) console.log('  ⚠ muy bajo, habrá que subirlo');
    console.log('  (el montaje normaliza a -16 LUFS igualmente)');
    console.log('');
  }
}
