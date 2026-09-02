/**
 * Comprueba qué productos de AssemblyAI admite la clave actual.
 *
 * Son dos servicios distintos con la misma clave: transcripción y LLM
 * Gateway. Perder el acceso a uno no dice nada del otro, y el agente los
 * necesita a los dos.
 *
 *   npx tsx scripts/probar-assemblyai.mts
 */
import { config } from 'dotenv';
config({ path: ['.env.local'], quiet: true });

const key = process.env.ASSEMBLYAI_API_KEY;

if (!key) {
  console.error('Falta ASSEMBLYAI_API_KEY en .env.local');
  throw new Error('sin clave');
}

console.log(`\nClave: ${key.slice(0, 6)}…${key.slice(-4)}  (${key.length} caracteres)\n`);

// --- LLM Gateway: es quien entiende lo que pide el cliente ------------------
const g = await fetch('https://llm-gateway.assemblyai.com/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: key, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'qwen3.5-4b-32k-fast',
    messages: [{ role: 'user', content: 'di hola' }],
    max_tokens: 5,
  }),
});

console.log(`LLM Gateway     HTTP ${g.status}  ${g.ok ? 'OK' : 'FALLA'}`);
console.log(`  ${(await g.text()).slice(0, 260)}\n`);

// --- Transcripción: es quien convierte la nota de voz en texto -------------
const t = await fetch('https://api.assemblyai.com/v2/transcript', {
  method: 'POST',
  headers: { Authorization: key, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    audio_url: 'https://assembly.ai/wildfires.mp3',
    speech_models: ['universal-3-5-pro', 'universal-2'],
    language_detection: true,
  }),
});

const tj = (await t.json()) as { id?: string; status?: string; error?: string };
console.log(`Transcripción   HTTP ${t.status}  ${t.ok ? 'OK' : 'FALLA'}`);
console.log(`  ${t.ok ? `id=${tj.id} status=${tj.status}` : JSON.stringify(tj).slice(0, 260)}\n`);

if (!g.ok) {
  console.log('Sin LLM Gateway el agente no entiende nada: transcribe y se');
  console.log('para. Es lo que hay que resolver antes que ninguna otra cosa.\n');
}
