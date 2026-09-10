/**
 * Genera la portada de la entrega: 2560×1440 (16:9), en inglés.
 *
 * Va aparte de `generar-carteles.mts` por dos razones: aquel produce el
 * material del vídeo, que es en español y para verse en movimiento, y su
 * fichero arrastra mojibake de un accidente de codificación antiguo —
 * incluye un carácter roto dentro del propio CSS. Tocarlo para añadir una
 * portada sería arriesgar los seis carteles que ya funcionan.
 *
 * La portada es lo primero que ve un jurado en la lista de proyectos, antes
 * de abrir nada. Por eso no lleva solo el nombre: enseña la transformación
 * completa —nota de voz entra, cita sale— para que se entienda sin leer la
 * descripción.
 *
 *   npx tsx scripts/generar-portada.mts
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = 'C:\\Users\\Yanero\\Desktop\\Saas\\video\\material';
mkdirSync(OUT, { recursive: true });

const HTML = `
<html>
<head>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  * { margin:0; padding:0; box-sizing:border-box; }

  body {
    width:1280px; height:720px;
    background:#f8fafc; color:#0f172a;
    font-family:'Plus Jakarta Sans', system-ui, sans-serif;
    -webkit-font-smoothing:antialiased;
    display:flex; align-items:center; justify-content:center;
    position:relative; overflow:hidden;
  }

  .grid {
    position:absolute; inset:0; opacity:.55;
    background-image:
      linear-gradient(rgba(37,99,235,.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(37,99,235,.06) 1px, transparent 1px);
    background-size:36px 36px;
  }

  .wrap { position:relative; display:flex; gap:70px; align-items:center; padding:0 78px; }

  .izq { width:520px; }

  h1 { font-size:62px; font-weight:800; letter-spacing:-2.2px; line-height:1; }

  .lema {
    font-size:27px; font-weight:600; color:#334155;
    margin-top:20px; line-height:1.35;
  }
  .lema b { color:#ea580c; font-weight:700; }

  .pie {
    margin-top:34px; font-size:18px; font-weight:600; color:#64748b;
    line-height:1.6;
  }
  .pie span { color:#2563eb; }

  /* --- la columna de la derecha: lo que pasa de verdad --- */
  .flujo { width:520px; display:flex; flex-direction:column; gap:14px; }

  .burbuja {
    background:#dcf8c6; border-radius:16px 16px 16px 4px;
    padding:18px 22px; box-shadow:0 1px 2px rgba(15,23,42,.08);
  }
  .burbuja .quien { font-size:14px; font-weight:700; color:#3f7d3a; margin-bottom:7px; }
  .burbuja .texto { font-size:19px; font-weight:500; color:#1e293b; line-height:1.4; }
  .onda { display:flex; align-items:center; gap:9px; margin-top:11px; }
  .onda i { display:block; width:3px; background:#3f7d3a; border-radius:2px; opacity:.55; }
  .onda .t { font-size:13px; color:#3f7d3a; font-weight:600; margin-left:5px; }

  .flecha {
    display:flex; align-items:center; gap:12px;
    font-size:15px; font-weight:700; color:#ea580c;
    padding-left:6px;
  }
  .flecha .linea { width:2px; height:26px; background:#fbbf24; border-radius:2px; }

  .cita {
    background:#fff; border:1px solid #e2e8f0; border-radius:14px;
    padding:20px 22px; box-shadow:0 4px 14px rgba(15,23,42,.07);
  }
  .cita .cab { display:flex; justify-content:space-between; align-items:center; margin-bottom:11px; }
  .cita .serv { font-size:20px; font-weight:700; }
  .cita .chip {
    font-size:12px; font-weight:700; color:#c2410c;
    background:#ffedd5; padding:5px 10px; border-radius:999px;
  }
  .cita .cuando { font-size:17px; color:#475569; font-weight:600; }
</style>
</head>
<body>
  <div class="grid"></div>

  <div class="wrap">
    <div class="izq">
      <h1>RevenueFlow</h1>
      <div class="lema">
        The reception desk that<br><b>actually listens</b>.
      </div>
      <div class="pie">
        WhatsApp voice notes → booked appointments.<br>
        Spanish, Portuguese, English. <span>Two countries.</span>
      </div>
    </div>

    <div class="flujo">
      <div class="burbuja">
        <div class="quien">Customer · voice note</div>
        <div class="texto">"Hola, necesito una cita para una limpieza dental. ¿Tienes algo el jueves en la tarde?"</div>
        <div class="onda">
          ${[9, 15, 22, 13, 26, 18, 30, 21, 12, 24, 16, 28, 11, 19, 14, 23, 9, 17, 25, 13]
            .map((h) => `<i style="height:${h}px"></i>`)
            .join('')}
          <span class="t">0:12</span>
        </div>
      </div>

      <!--
        Dice "seconds later" y no una cifra concreta a propósito. Medido de
        verdad: 6,1 s para una nota corta y 13,4 s para una de doce segundos
        — transcribir audio largo cuesta más. Poner "7 seconds" al lado de
        una nota de 0:12 es una cifra que el propio vídeo desmiente.
      -->
      <div class="flecha">
        <div class="linea"></div>
        SECONDS LATER
      </div>

      <div class="cita">
        <div class="cab">
          <div class="serv">Limpieza dental</div>
          <div class="chip">BOOKED BY AI</div>
        </div>
        <div class="cuando">Thursday 17 September · 1:00 p. m.</div>
      </div>
    </div>
  </div>
</body>
</html>
`;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 2, // 2560×1440
});

await page.setContent(HTML, { waitUntil: 'networkidle' });
await page.waitForTimeout(700); // que cargue la fuente

const destino = path.join(OUT, 'portada.png');
await page.screenshot({ path: destino });
await browser.close();

console.log(`\n  ${destino}\n  2560x1440 (16:9)\n`);
