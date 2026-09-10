/**
 * Transcribe el mismo recorte con distintos niveles de ayuda.
 *
 * Sirve para resolver una duda concreta: cuando una palabra se puede oír de
 * dos formas, se le da al modelo todo el contexto que favorece una de ellas.
 * Si aun así devuelve la otra, es que eso es lo que suena — y si suena así
 * para el modelo, probablemente suene así para quien vea el vídeo.
 *
 *   npx tsx scripts/comparar-transcripcion.mts <recorte.ogg> "termino esperado"
 */
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
config({ path: ['.env.local'], quiet: true });

const [archivo, esperado] = process.argv.slice(2);
if (!archivo) {
  console.error('Uso: npx tsx scripts/comparar-transcripcion.mts <recorte> [termino]');
  process.exit(1);
}

const { AssemblyAI } = await import('assemblyai');
const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! });
const audio = readFileSync(archivo);

const casos: Array<[string, Record<string, unknown>]> = [
  ['sin ayuda', {}],
  ...(esperado
    ? ([
        ['con keyterms', { keyterms_prompt: [esperado] }],
        [
          'con escena + keyterms',
          {
            prompt:
              'Narracion de un video que explica un agente de inteligencia ' +
              'artificial que atiende WhatsApp, lee la conversacion del ' +
              'cliente y agenda citas automaticamente.',
            keyterms_prompt: [esperado],
          },
        ],
      ] as Array<[string, Record<string, unknown>]>)
    : []),
];

console.log('');

for (const [nombre, extra] of casos) {
  const t = await client.transcripts.transcribe({
    audio,
    speech_models: ['universal-3-5-pro'],
    language_code: 'es',
    punctuate: true,
    format_text: true,
    ...extra,
  });

  console.log(`  ${nombre.padEnd(22)} ${t.text}`);
}

if (esperado) {
  console.log(
    `\n  Si "${esperado}" no aparece en ninguna, es lo que suena de verdad.\n`,
  );
}
