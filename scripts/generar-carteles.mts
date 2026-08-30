/**
 * Genera los carteles del video como PNG a 1280x720, con el estilo del
 * producto. Se renderizan en Chromium para que la tipografía sea idéntica.
 *
 *   npx tsx scripts/generar-carteles.mts
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = 'C:\\Users\\Yanero\\Desktop\\Saas\\video\\material';
mkdirSync(OUT, { recursive: true });

const BASE = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:1280px; height:720px; display:flex; align-items:center;
    justify-content:center; background:#f8fafc; color:#1e293b;
    font-family:'Plus Jakarta Sans', system-ui, sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  .wrap { padding:0 90px; width:100%; }
  h1 { font-size:64px; font-weight:800; letter-spacing:-2px; line-height:1.08; }
  h2 { font-size:46px; font-weight:700; letter-spacing:-1.2px; line-height:1.２; }
  p  { font-size:26px; color:#475569; line-height:1.5; margin-top:26px; max-width:900px; }
  .acento { color:#ea580c; }
  .azul   { color:#2563eb; }
  .grid {
    position:absolute; inset:0; opacity:.5;
    background-image:
      linear-gradient(rgba(37,99,235,.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(37,99,235,.06) 1px, transparent 1px);
    background-size:36px 36px;
  }
  ul { list-style:none; margin-top:38px; }
  li { font-size:31px; font-weight:600; margin-bottom:20px; display:flex; gap:16px; align-items:center; }
  li span { color:#ea580c; font-weight:800; }
`;

/** Cada cartel: nombre de archivo y cuerpo HTML. */
const CARTELES: Array<[string, string]> = [
  [
    'c1-titulo',
    `<div class="grid"></div>
     <div class="wrap" style="text-align:center">
       <h1>RevenueFlow</h1>
       <p style="margin:22px auto 0; font-size:30px">
         La primera recepción que <span class="acento" style="font-weight:700">de verdad escucha</span>.
       </p>
     </div>`,
  ],
  [
    'c2-problema',
    `<div class="grid"></div>
     <div class="wrap">
       <h2>En Latinoamérica,<br>WhatsApp no es un canal.</h2>
       <h2 class="azul" style="margin-top:14px">Es el teléfono.</h2>
       <p>Los clientes no escriben. <strong style="color:#1e293b">Hablan.</strong><br>
          Y todo CRM muestra eso como un recuadro gris que dice «mensaje de audio».</p>
     </div>`,
  ],
  [
    'c3-pipeline',
    `<div class="wrap" style="text-align:center">
       <div style="display:flex; align-items:center; justify-content:center; gap:18px; flex-wrap:wrap">
         ${[
           ['🎙️', 'voz'],
           ['→', ''],
           ['', 'AssemblyAI'],
           ['→', ''],
           ['', 'LLM Gateway'],
           ['→', ''],
           ['', 'reglas del negocio'],
           ['→', ''],
           ['✅', 'cita'],
         ]
           .map(([icono, texto]) =>
             texto === ''
               ? `<span style="font-size:38px;color:#94a3b8">${icono}</span>`
               : `<div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;
                    padding:20px 24px;font-size:22px;font-weight:600;
                    box-shadow:0 4px 16px rgba(15,23,42,.06)">${icono} ${texto}</div>`,
           )
           .join('')}
       </div>
       <p style="margin:52px auto 0; text-align:center">
         Una sola llave. Un solo proveedor.
       </p>
     </div>`,
  ],
  [
    'c4-regla',
    `<div class="grid"></div>
     <div class="wrap">
       <h2>El modelo decide <span class="azul">qué quiere</span> el cliente.</h2>
       <h2 style="margin-top:12px">El sistema decide <span class="acento">qué se puede hacer</span>.</h2>
       <ul>
         <li><span>✕</span> No puede inventar un servicio</li>
         <li><span>✕</span> No puede inventar una fecha</li>
         <li><span>✕</span> No puede inventar disponibilidad</li>
       </ul>
     </div>`,
  ],
  [
    'c5-paises',
    `<div class="grid"></div>
     <div class="wrap" style="text-align:center">
       <h2>El mismo motor. Dos países.</h2>
       <div style="display:flex;gap:28px;margin-top:46px;justify-content:center">
         ${[
           ['Venezuela', 'Bs. 1.845,00 ≈ $37,50', 'BCV 49,20 · español · RIF'],
           ['Brasil', 'R$ 1.845,00', 'reales · português · CNPJ'],
         ]
           .map(
             ([pais, monto, detalle]) => `
             <div style="flex:1;max-width:430px;background:#fff;border:1px solid #e2e8f0;
                  border-radius:18px;padding:34px;box-shadow:0 4px 20px rgba(15,23,42,.06)">
               <div style="font-size:15px;text-transform:uppercase;letter-spacing:1.4px;
                    color:#64748b;font-weight:600">${pais}</div>
               <div style="font-size:30px;font-weight:700;margin-top:14px">${monto}</div>
               <div style="font-size:18px;color:#64748b;margin-top:10px">${detalle}</div>
             </div>`,
           )
           .join('')}
       </div>
       <p style="margin:44px auto 0;text-align:center;font-size:28px;color:#1e293b;font-weight:600">
         Agregar un país es escribir <span class="acento">un archivo</span>.
       </p>
     </div>`,
  ],
  [
    'c6-cierre',
    `<div class="grid"></div>
     <div class="wrap" style="text-align:center">
       <h1 style="font-size:52px">La primera recepción<br>que de verdad escucha.</h1>
       <p style="margin:34px auto 0;text-align:center;font-size:24px">
         En línea · Código abierto, MIT · 84 tests
       </p>
       <div style="margin-top:34px;font-size:27px;font-weight:700" class="azul">
         revenueflow-ai-yanero.vercel.app
       </div>
     </div>`,
  ],
];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 2,
});

for (const [nombre, cuerpo] of CARTELES) {
  await page.setContent(
    `<html><head><style>${BASE}</style></head><body>${cuerpo}</body></html>`,
    { waitUntil: 'networkidle' },
  );
  await page.waitForTimeout(600); // que cargue la fuente
  await page.screenshot({ path: path.join(OUT, `${nombre}.png`) });
  console.log(`  → ${nombre}.png`);
}

await browser.close();
console.log('\nCarteles listos.\n');
