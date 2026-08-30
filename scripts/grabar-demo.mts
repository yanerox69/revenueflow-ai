/**
 * Graba el demo en video real, maneja la app y captura los paneles.
 *
 * Produce, en Desktop\Saas\video\material:
 *   demo.webm        el flujo completo, 1280x720
 *   panel-ve.png     panel venezolano
 *   panel-br.png     panel brasileño
 *
 *   npx tsx scripts/grabar-demo.mts
 */
import { chromium, type Page } from 'playwright';
import { mkdirSync, readdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';

const URL = 'https://revenueflow-ai-yanero.vercel.app';
const AUDIO = path.resolve('public/demo/DEMO-jueves-tarde.ogg');
const OUT = 'C:\\Users\\Yanero\\Desktop\\Saas\\video\\material';
const SIZE = { width: 1280, height: 720 };

const CUENTAS = {
  ve: { email: 'owner.ve@demo.local', password: 'demo-Passw0rd!' },
  br: { email: 'owner.br@demo.local', password: 'demo-Passw0rd!' },
};

mkdirSync(OUT, { recursive: true });

async function entrar(page: Page, cuenta: { email: string; password: string }) {
  await page.goto(`${URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[name="email"]', cuenta.email);
  await page.fill('input[name="password"]', cuenta.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/panel', { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
}

const browser = await chromium.launch();

// ---- 1. Sesión venezolana, guardada para reusar sin grabar el login ------
console.log('1. Iniciando sesión…');
const login = await browser.newContext({ viewport: SIZE });
const loginPage = await login.newPage();
await entrar(loginPage, CUENTAS.ve);
const estadoVe = await login.storageState();
await login.close();

// ---- 2. Grabación del demo ----------------------------------------------
console.log('2. Grabando el demo…');
const rec = await browser.newContext({
  viewport: SIZE,
  storageState: estadoVe,
  recordVideo: { dir: OUT, size: SIZE },
  deviceScaleFactor: 2,
});
const page = await rec.newPage();

await page.goto(`${URL}/panel`, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000); // el jurado ve de qué negocio se trata

// El resultado aparece bajo el grabador: hay que dejarlo dentro del encuadre
// ANTES de subir, o la cita agendada queda fuera de pantalla.
await page.getByText('Prueba la recepción').scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy({ top: -60, behavior: 'smooth' }));
await page.waitForTimeout(2500);

// Subir el audio dispara el pipeline.
await page.setInputFiles('input[type="file"]', AUDIO);
console.log('   audio enviado, esperando la cita…');

await page.getByText('Cita agendada').waitFor({ timeout: 90_000 });
console.log('   cita agendada');

// Recorrido lento por el resultado, acompañando a la narración:
// primero la transcripción, luego la cita, luego la respuesta al cliente.
await page.waitForTimeout(1500);

for (const ancla of ['TRANSCRIPCIÓN', 'CITA AGENDADA', 'Respuesta al cliente']) {
  await page.getByText(ancla, { exact: false }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(6500);
}

// Plano final con todo a la vista.
await page.getByText('CITA AGENDADA').first().scrollIntoViewIfNeeded();
await page.waitForTimeout(6000);

await rec.close();

// Playwright nombra el video con un hash; lo renombramos.
const grabado = readdirSync(OUT).find((f) => f.endsWith('.webm'));
if (grabado) {
  const destino = path.join(OUT, 'demo.webm');
  if (existsSync(destino)) rmSync(destino);
  renameSync(path.join(OUT, grabado), destino);
  console.log(`   → ${destino}`);
}

// ---- 3. Capturas de los dos paneles -------------------------------------
console.log('3. Capturando paneles…');
for (const [codigo, cuenta] of Object.entries(CUENTAS)) {
  const ctx = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await entrar(p, cuenta);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(OUT, `panel-${codigo}.png`) });
  await ctx.close();
  console.log(`   → panel-${codigo}.png`);
}

await browser.close();
console.log('\nListo.\n');
