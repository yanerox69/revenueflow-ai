/**
 * Genera el deck de 10 slides: PNG individuales + un PDF.
 *
 *   npx tsx scripts/generar-slides.mts
 *
 * Salida en Desktop\Saas\video\slides\
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const MAT = 'C:\\Users\\Yanero\\Desktop\\Saas\\video\\material';
const OUT = 'C:\\Users\\Yanero\\Desktop\\Saas\\video\\slides';
mkdirSync(OUT, { recursive: true });

/** Las imágenes se incrustan en base64: el PDF debe ser autocontenido. */
const img = (nombre: string) =>
  `data:image/png;base64,${readFileSync(path.join(MAT, nombre)).toString('base64')}`;

const RESULTADO = img('resultado2.png');
const PANEL_VE = img('panel-ve.png');
const PANEL_BR = img('panel-br.png');

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Plus Jakarta Sans', system-ui, sans-serif; -webkit-font-smoothing:antialiased; }
.slide {
  width:1920px; height:1080px; background:#f8fafc; color:#1e293b;
  padding:100px 120px; position:relative; overflow:hidden;
  display:flex; flex-direction:column; justify-content:center;
  page-break-after:always; break-after:page;
}
.slide::before {
  content:''; position:absolute; inset:0; opacity:.55;
  background-image:
    linear-gradient(rgba(37,99,235,.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(37,99,235,.05) 1px, transparent 1px);
  background-size:48px 48px;
}
.slide > * { position:relative; }
.num { position:absolute; bottom:56px; right:120px; font-size:20px; color:#94a3b8; font-weight:600; }
h1 { font-size:96px; font-weight:800; letter-spacing:-3px; line-height:1.05; }
h2 { font-size:62px; font-weight:700; letter-spacing:-1.6px; line-height:1.15; }
.kicker { font-size:22px; font-weight:700; letter-spacing:2.4px; text-transform:uppercase; color:#2563eb; margin-bottom:28px; }
p { font-size:32px; color:#475569; line-height:1.5; margin-top:32px; max-width:1250px; }
.azul { color:#2563eb; } .acento { color:#ea580c; }
.centro { text-align:center; align-items:center; }
.tarjetas { display:flex; gap:32px; margin-top:56px; }
.t { flex:1; background:#fff; border:1px solid #e2e8f0; border-radius:22px;
     padding:40px; box-shadow:0 6px 28px rgba(15,23,42,.06); }
.t .lbl { font-size:18px; text-transform:uppercase; letter-spacing:1.6px; color:#64748b; font-weight:700; }
.t .big { font-size:44px; font-weight:800; margin-top:16px; letter-spacing:-1px; }
.t .sub { font-size:22px; color:#64748b; margin-top:12px; }
ul { list-style:none; margin-top:48px; }
li { font-size:36px; font-weight:600; margin-bottom:26px; display:flex; gap:20px; align-items:flex-start; }
li b { color:#ea580c; font-weight:800; }
.pipeline { display:flex; align-items:center; justify-content:center; gap:20px; margin-top:64px; flex-wrap:wrap; }
.caja { background:#fff; border:1px solid #e2e8f0; border-radius:18px; padding:26px 32px;
        font-size:28px; font-weight:600; box-shadow:0 4px 20px rgba(15,23,42,.06); }
.flecha { font-size:42px; color:#94a3b8; }
.shot { border-radius:20px; border:1px solid #e2e8f0; box-shadow:0 12px 44px rgba(15,23,42,.12); max-width:100%; }
table { width:100%; border-collapse:collapse; margin-top:52px; font-size:30px; }
td { padding:22px 0; border-bottom:1px solid #e2e8f0; }
td:first-child { font-weight:700; width:38%; }
td:last-child { color:#475569; }
`;

const SLIDES: string[] = [
  // 1
  `<div class="slide centro">
     <h1>RevenueFlow</h1>
     <p style="font-size:40px;margin-top:36px">
       The reception desk that <span class="acento" style="font-weight:700">actually listens</span>.
     </p>
     <p style="font-size:26px;margin-top:44px;color:#64748b">
       Voice-first WhatsApp reception for Latin American small businesses.<br>Built on AssemblyAI.
     </p>
     <p style="font-size:24px;margin-top:40px" class="azul">revenueflow-ai-yanero.vercel.app</p>
   </div>`,

  // 2
  `<div class="slide">
     <div class="kicker">The problem</div>
     <h2>In Latin America,<br>customers don't type.<br><span class="acento">They talk.</span></h2>
     <p>A voice note arrives at 8pm. The clinic is closed.<br>
        Every CRM shows it as a grey box that says “audio message”.</p>
     <p style="font-weight:700;color:#1e293b">By morning, that customer booked somewhere else.</p>
   </div>`,

  // 3
  `<div class="slide">
     <div class="kicker">Why now</div>
     <h2>WhatsApp isn't a channel.<br>It's the phone.</h2>
     <div class="tarjetas">
       <div class="t"><div class="lbl">Penetration</div><div class="big azul">~90%+</div>
         <div class="sub">of people in major LatAm markets</div></div>
       <div class="t"><div class="lbl">Tools that read voice notes</div><div class="big acento">0</div>
         <div class="sub">every CRM stops at the grey box</div></div>
       <div class="t"><div class="lbl">People answering</div><div class="big">1</div>
         <div class="sub">usually the owner</div></div>
     </div>
     <p style="font-size:20px;margin-top:36px;color:#94a3b8">
       Penetration figures: cite your source here before submitting.
     </p>
   </div>`,

  // 4
  `<div class="slide centro">
     <div class="kicker">The solution</div>
     <h2>From a voice note to a booked appointment.</h2>
     <div class="pipeline">
       <div class="caja">🎙️ voice</div><div class="flecha">→</div>
       <div class="caja">AssemblyAI</div><div class="flecha">→</div>
       <div class="caja">LLM Gateway</div><div class="flecha">→</div>
       <div class="caja">business rules</div><div class="flecha">→</div>
       <div class="caja">✅ booked</div>
     </div>
     <p style="margin-top:64px;font-size:36px;font-weight:700;color:#1e293b">
       No forms. No menus. No “press one for appointments”.
     </p>
   </div>`,

  // 5
  `<div class="slide centro" style="padding:70px 120px">
     <div class="kicker">Live demo</div>
     <img src="${RESULTADO}" class="shot" style="max-height:720px;object-fit:contain">
     <p style="margin-top:32px;font-size:30px;font-weight:700;color:#1e293b">
       Spanish voice note → transcription → intent → real calendar → booked.
       <span class="acento">Under 10 seconds.</span>
     </p>
   </div>`,

  // 6
  `<div class="slide">
     <div class="kicker">How we use AssemblyAI</div>
     <h2>One API key. The whole pipeline.</h2>
     <table>
       <tr><td>Universal-3.5&nbsp;Pro</td><td>Spanish and Portuguese · 100% confidence on the demo note</td></tr>
       <tr><td><code>keyterms_prompt</code></td><td>Biased with the clinic's <b>own service catalog</b></td></tr>
       <tr><td><code>prompt</code></td><td>Describes the scene: customer, vertical, country</td></tr>
       <tr><td>LLM Gateway</td><td>Intent extraction against a strict schema</td></tr>
     </table>
   </div>`,

  // 7
  `<div class="slide">
     <div class="kicker">The architecture decision</div>
     <h2>The model decides <span class="azul">what the customer wants</span>.<br>
         The system decides <span class="acento">what's allowed</span>.</h2>
     <ul>
       <li><b>✕</b> It cannot invent a service — only picks from the catalog</li>
       <li><b>✕</b> It cannot invent a date — returns a weekday, we compute the date</li>
       <li><b>✕</b> It cannot invent availability — the slot comes from the database</li>
     </ul>
     <p style="font-weight:600;color:#1e293b">Complaint, payment or doubt → escalates to a human and stops.</p>
   </div>`,

  // 8
  `<div class="slide centro" style="padding:80px 100px">
     <div class="kicker">Multi-country from line one</div>
     <h2>Same engine. Two markets.</h2>
     <div class="tarjetas" style="margin-top:44px">
       <div class="t" style="padding:0;overflow:hidden">
         <img src="${PANEL_VE}" style="width:100%;display:block">
       </div>
       <div class="t" style="padding:0;overflow:hidden">
         <img src="${PANEL_BR}" style="width:100%;display:block">
       </div>
     </div>
     <p style="margin-top:40px;font-size:34px;font-weight:700;color:#1e293b">
       Adding a country is writing <span class="acento">one file</span> — not rebuilding the product.
     </p>
   </div>`,

  // 9
  `<div class="slide">
     <div class="kicker">Not a prototype</div>
     <h2>Built to survive a real business.</h2>
     <table>
       <tr><td>84 tests</td><td>including tenant isolation verified against the live database</td></tr>
       <tr><td>Row Level Security</td><td>on every table — audited automatically by a test</td></tr>
       <tr><td>Idempotent ingestion</td><td>WhatsApp retries webhooks; we never transcribe twice</td></tr>
       <tr><td>Audio metered</td><td>per second — at $30/month the margin is decided there</td></tr>
       <tr><td>Deployed</td><td>public, open source, continuous deployment</td></tr>
     </table>
   </div>`,

  // 10
  `<div class="slide centro">
     <div class="kicker">What's next</div>
     <h2>Real WhatsApp numbers.<br>Automatic no-show recovery.<br>Colombia, Mexico, Peru.</h2>
     <p style="margin-top:56px;font-size:38px;font-weight:700;color:#1e293b">
       Latin America runs on voice notes.
     </p>
     <p style="margin-top:8px;font-size:38px;font-weight:800" class="acento">
       RevenueFlow is the first reception desk that actually listens.
     </p>
     <p style="margin-top:52px;font-size:26px" class="azul">
       revenueflow-ai-yanero.vercel.app · github.com/yanerox69/revenueflow-ai
     </p>
   </div>`,
];

const html =
  `<html><head><meta charset="utf-8"><style>${CSS}</style></head><body>` +
  SLIDES.map((s, i) =>
    s.replace('</div>', `<div class="num">${i + 1} / ${SLIDES.length}</div></div>`),
  ).join('') +
  `</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

// PNG por slide
const nodos = await page.locator('.slide').all();
for (let i = 0; i < nodos.length; i++) {
  const n = String(i + 1).padStart(2, '0');
  await nodos[i].screenshot({ path: path.join(OUT, `slide-${n}.png`) });
  console.log(`  → slide-${n}.png`);
}

// PDF completo
await page.pdf({
  path: path.join(OUT, 'RevenueFlow-slides.pdf'),
  width: '1920px',
  height: '1080px',
  printBackground: true,
  pageRanges: `1-${SLIDES.length}`,
});
console.log('  → RevenueFlow-slides.pdf');

await browser.close();
console.log('\nDeck listo.\n');
