/**
 * Saca los tiempos de cada palabra de una narración.
 *
 * Hace falta para montar: los silencios del guion se insertan al final de
 * frases concretas, y para eso hay que saber en qué milisegundo termina cada
 * una. A oído no se acierta.
 *
 *   npx tsx scripts/tiempos-narracion.mts <audio> [palabra_a_marcar ...]
 */
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
config({ path: ['.env.local'], quiet: true });

const [archivo, ...marcar] = process.argv.slice(2);
if (!archivo) {
  console.error('Uso: npx tsx scripts/tiempos-narracion.mts <audio> [palabras]');
  process.exit(1);
}

const { AssemblyAI } = await import('assemblyai');
const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });

const t = await client.transcripts.transcribe({
  audio: readFileSync(archivo),
  speech_models: ['universal-3-5-pro'],
  language_code: 'es',
  punctuate: true,
  format_text: true,
});

const buscadas = new Set(marcar.map((m) => m.toLowerCase()));
const palabras = t.words ?? [];

console.log(`\n  ${palabras.length} palabras · ${t.audio_duration}s\n`);

palabras.forEach((p, i) => {
  const limpia = p.text.toLowerCase().replace(/[^\wáéíóúñü]/g, '');
  const siguiente = palabras[i + 1];
  const hueco = siguiente ? (siguiente.start - p.end) / 1000 : 0;

  if (buscadas.size === 0 || buscadas.has(limpia)) {
    console.log(
      `  [${String(i).padStart(3)}] ${p.text.padEnd(16)} ` +
        `termina ${(p.end / 1000).toFixed(2)}s` +
        (siguiente
          ? `   hueco ${hueco.toFixed(2)}s   siguiente "${siguiente.text}"`
          : ''),
    );
  }
});

console.log('');
