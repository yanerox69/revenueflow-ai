import 'server-only';
import { createHash } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Política de uso.
 *
 * Cada segundo de audio cuesta dinero. Con el repositorio público y las
 * credenciales demo a la vista, sin límites una sola persona puede vaciar
 * la cuenta de créditos.
 */
export const LIMITES = {
  /** Tamaño máximo del archivo. 2 MB de Opus son ~30 minutos: de sobra
   *  para una nota de voz, y corta de raíz el archivo de cuatro horas. */
  maxBytes: 2 * 1024 * 1024,

  /** Peticiones por hora desde la misma red. */
  porIp: { max: 12, ventana: '1 hour' },

  /** Peticiones por día y negocio. */
  porTenantDia: { max: 40, ventana: '24 hours' },

  /** Segundos de audio por día y negocio. 15 minutos. */
  segundosPorDia: 900,
} as const;

export type MotivoRechazo =
  | 'ARCHIVO_GRANDE'
  | 'DEMASIADAS_PETICIONES'
  | 'CUOTA_DIARIA'
  | 'CUOTA_AUDIO';

export interface Veredicto {
  permitido: boolean;
  motivo?: MotivoRechazo;
  mensaje?: string;
  /** Segundos hasta que se libere, para la cabecera Retry-After. */
  reintentarEn?: number;
}

const OK: Veredicto = { permitido: true };

/**
 * La IP no se guarda en claro: se almacena su hash.
 * Es un dato personal y la LGPD aplica en Brasil.
 */
function hashIp(ip: string): string {
  const sal = process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'sal-local';
  return createHash('sha256').update(`${ip}:${sal}`).digest('hex').slice(0, 32);
}

export function extraerIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'desconocida';
}

/** Comprueba el tamaño antes de leer el archivo entero en memoria. */
export function verificarTamaño(bytes: number): Veredicto {
  if (bytes <= LIMITES.maxBytes) return OK;
  return {
    permitido: false,
    motivo: 'ARCHIVO_GRANDE',
    mensaje:
      `El audio supera los ${LIMITES.maxBytes / 1024 / 1024} MB. ` +
      'Una nota de voz normal pesa mucho menos.',
  };
}

/**
 * Se ejecuta ANTES de mandar nada a transcribir. El orden importa: primero
 * lo barato (contadores), y solo si pasa se gasta un crédito.
 */
export async function verificarLimites(
  tenantId: string,
  ip: string,
): Promise<Veredicto> {
  const db = createSupabaseAdminClient();

  const porIp = await bump(db, `ip:${hashIp(ip)}`, LIMITES.porIp);
  if (!porIp.allowed) {
    return {
      permitido: false,
      motivo: 'DEMASIADAS_PETICIONES',
      mensaje: 'Demasiadas pruebas seguidas. Intenta de nuevo en un rato.',
      reintentarEn: segundosHasta(porIp.resets_at),
    };
  }

  const porTenant = await bump(db, `tenant:${tenantId}`, LIMITES.porTenantDia);
  if (!porTenant.allowed) {
    return {
      permitido: false,
      motivo: 'CUOTA_DIARIA',
      mensaje: 'Este negocio alcanzó su cuota de pruebas de hoy.',
      reintentarEn: segundosHasta(porTenant.resets_at),
    };
  }

  const { data: segundos } = await db.rpc('tenant_audio_seconds', {
    p_tenant_id: tenantId,
    p_window: '24 hours',
  });

  if (Number(segundos ?? 0) >= LIMITES.segundosPorDia) {
    return {
      permitido: false,
      motivo: 'CUOTA_AUDIO',
      mensaje:
        `Este negocio alcanzó su límite de ${LIMITES.segundosPorDia / 60} ` +
        'minutos de audio al día.',
      reintentarEn: 3600,
    };
  }

  return OK;
}

type Db = ReturnType<typeof createSupabaseAdminClient>;
type Resultado = { allowed: boolean; hits: number; resets_at: string };

async function bump(
  db: Db,
  bucket: string,
  regla: { max: number; ventana: string },
): Promise<Resultado> {
  const { data, error } = await db.rpc('bump_rate_limit', {
    p_bucket: bucket,
    p_max_hits: regla.max,
    p_window: regla.ventana,
  });

  // Si el contador falla, NO se bloquea al usuario: se registra y se sigue.
  // Un límite roto no debe tumbar el producto.
  if (error || !data?.[0]) {
    console.error('[limits] fallo consultando el contador:', error?.message);
    return { allowed: true, hits: 0, resets_at: new Date().toISOString() };
  }

  return data[0] as Resultado;
}

function segundosHasta(iso: string): number {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}
