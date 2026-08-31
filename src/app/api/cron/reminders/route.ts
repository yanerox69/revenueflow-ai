import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { procesarRecordatorios } from '@/lib/agent/reminders';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Tanda de recordatorios y seguimientos.
 *
 * La dispara el cron de Vercel (ver vercel.json). También se puede invocar a
 * mano con la misma cabecera, para probarlo sin esperar al horario.
 */
export async function GET(request: Request) {
  if (!autorizado(request)) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const resultado = await procesarRecordatorios();

    if (resultado.errores.length) {
      console.error('[cron] errores en la tanda:', resultado.errores);
    }

    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    console.error('[cron] fallo general:', (e as Error).message);
    return NextResponse.json({ error: 'Falló la tanda.' }, { status: 500 });
  }
}

/**
 * Vercel firma sus llamadas de cron con CRON_SECRET.
 *
 * Sin secreto configurado se rechaza todo: un endpoint que manda mensajes a
 * clientes reales no puede quedar abierto por olvidar una variable.
 */
function autorizado(request: Request): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto) {
    console.error('[cron] Falta CRON_SECRET: se rechaza la llamada.');
    return false;
  }

  const cabecera = request.headers.get('authorization') ?? '';
  const esperado = `Bearer ${secreto}`;

  const a = Buffer.from(cabecera);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
