/**
 * Prueba real contra AssemblyAI con un archivo de audio local.
 * Consume créditos: úsalo con audios cortos.
 *
 *   npx tsx scripts/try-voice.mts <archivo> [VE|BR]
 */
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { AssemblyAITranscriber } from '../src/lib/voice/assemblyai';
import { buildVoiceContext } from '../src/lib/voice/context';
import { getPack } from '../src/lib/country';

config({ path: ['.env.local', '.env'], quiet: true });

const [file, countryArg] = process.argv.slice(2);
if (!file) {
  console.error('Uso: npx tsx scripts/try-voice.mts <archivo.wav> [VE|BR]');
  process.exit(1);
}

const pack = getPack(countryArg ?? 'VE');
const audio = readFileSync(file);

// Mismo contexto que armaría el pipeline para un tenant real.
const context = buildVoiceContext({
  pack,
  vertical: 'clinica_dental',
  businessName: 'Clínica Dental Sonrisa',
  serviceNames: [
    'Limpieza dental',
    'Consulta de valoración',
    'Blanqueamiento',
    'Extracción simple',
  ],
});

console.log(`\nPaís      ${pack.displayName} (${pack.code})`);
console.log(`Idioma    ${pack.speechLanguage}`);
console.log(`Audio     ${(audio.length / 1024).toFixed(0)} KB`);
console.log(`\nPrompt enviado:\n  ${context.prompt}`);
console.log(`\nKeyterms enviados:\n  ${context.keyterms.join(' · ')}`);
console.log('\nTranscribiendo…\n');

const started = Date.now();

try {
  const result = await new AssemblyAITranscriber().transcribe({
    audio,
    fallbackLanguage: pack.speechLanguage,
    contentType: 'audio/wav',
    prompt: context.prompt,
    keyterms: context.keyterms,
  });

  console.log('─'.repeat(64));
  console.log(result.text);
  console.log('─'.repeat(64));
  console.log(`\nIdioma detectado  ${result.detectedLanguage}`);
  console.log(`Confianza         ${result.confidence != null ? (result.confidence * 100).toFixed(1) + '%' : 'n/d'}`);
  console.log(`Duración audio    ${result.durationSeconds}s`);
  console.log(`Tiempo real       ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`Job               ${result.providerJobId}\n`);
} catch (e) {
  console.error('\nFALLÓ:', (e as Error).message, '\n');
  process.exit(1);
}
