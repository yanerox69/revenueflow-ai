/**
 * Sondea qué modelos del LLM Gateway acepta esta cuenta, y si soportan
 * structured outputs. Peticiones mínimas.
 *
 *   npx tsx scripts/probe-models.mts
 */
import { config } from 'dotenv';
config({ path: ['.env.local'], quiet: true });

const KEY = process.env.ASSEMBLYAI_API_KEY!;
const URL = 'https://llm-gateway.assemblyai.com/v1/chat/completions';

const CANDIDATES = [
  'qwen3.5-4b-32k-fast',
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
  'gpt-5-nano',
  'gpt-5-mini',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.5-flash-lite',
  'qwen3-32B',
  'gpt-oss-20b',
];

const SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'prueba',
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: { ok: { type: 'boolean' } },
      required: ['ok'],
    },
    strict: true,
  },
};

async function attempt(model: string, structured: boolean) {
  const body: Record<string, unknown> = {
    model,
    max_tokens: 32,
    messages: [{ role: 'user', content: 'Responde {"ok":true} y nada más.' }],
  };
  if (structured) body.response_format = SCHEMA;

  const res = await fetch(URL, {
    method: 'POST',
    headers: { authorization: KEY, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.ok) return { ok: true, detail: '' };
  const text = await res.text();
  const msg = text.match(/"errors":\["([^"]+)"/)?.[1] ?? text.slice(0, 90);
  return { ok: false, detail: msg };
}

console.log('\nmodelo                        plano   structured');
console.log('─'.repeat(62));

for (const model of CANDIDATES) {
  const plain = await attempt(model, false);
  const structured = plain.ok ? await attempt(model, true) : { ok: false, detail: '' };

  const mark = (r: { ok: boolean }) => (r.ok ? '  OK  ' : ' FALLA');
  console.log(
    `${model.padEnd(28)} ${mark(plain)}  ${mark(structured)}` +
      (plain.ok ? '' : `   ${plain.detail}`),
  );
}
console.log();
