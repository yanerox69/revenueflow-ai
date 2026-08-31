import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: ['.env.local', '.env'], quiet: true });

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(URL && SERVICE);

describe('Test 19 · Tamaño máximo del audio', () => {
  it('acepta una nota de voz normal y rechaza un archivo largo', async () => {
    const { verificarTamaño, LIMITES } = await import('@/lib/limits');

    // Una nota de WhatsApp de 14 s pesa ~26 KB.
    expect(verificarTamaño(26 * 1024).permitido).toBe(true);
    expect(verificarTamaño(LIMITES.maxBytes).permitido).toBe(true);

    const rechazo = verificarTamaño(LIMITES.maxBytes + 1);
    expect(rechazo.permitido).toBe(false);
    expect(rechazo.motivo).toBe('ARCHIVO_GRANDE');
  });

  it('el tope es mucho menor que el de WhatsApp: 16 MB de Opus son horas de audio', async () => {
    const { LIMITES } = await import('@/lib/limits');
    expect(LIMITES.maxBytes).toBeLessThan(16 * 1024 * 1024);
  });
});

describe('Test 20 · Extracción de la IP', () => {
  it('toma la primera IP de x-forwarded-for', async () => {
    const { extraerIp } = await import('@/lib/limits');
    const req = new Request('https://x.test', {
      headers: { 'x-forwarded-for': '203.0.113.7, 70.41.3.18' },
    });
    expect(extraerIp(req)).toBe('203.0.113.7');
  });

  it('no revienta si no hay cabeceras de proxy', async () => {
    const { extraerIp } = await import('@/lib/limits');
    expect(extraerIp(new Request('https://x.test'))).toBe('desconocida');
  });
});

describe.skipIf(!configured)('Test 21 · El contador bloquea de verdad', () => {
  let db: SupabaseClient;
  const bucket = `prueba:${Date.now()}`;

  beforeAll(() => {
    db = createClient(URL!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  it('permite hasta el tope y luego rechaza', async () => {
    const llamar = async () => {
      const { data } = await db.rpc('bump_rate_limit', {
        p_bucket: bucket,
        p_max_hits: 3,
        p_window: '1 hour',
      });
      return data![0] as { allowed: boolean; hits: number };
    };

    expect((await llamar()).allowed).toBe(true); // 1
    expect((await llamar()).allowed).toBe(true); // 2
    expect((await llamar()).allowed).toBe(true); // 3

    const cuarta = await llamar();
    expect(cuarta.allowed).toBe(false);
    expect(cuarta.hits).toBe(3);

    // Insistir no empuja la ventana ni incrementa el contador.
    const quinta = await llamar();
    expect(quinta.allowed).toBe(false);
    expect(quinta.hits).toBe(3);

    await db.from('rate_limits').delete().eq('bucket', bucket);
  });

  it('la tabla de contadores no es accesible sin la clave de servicio', async () => {
    const anon = createClient(URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await anon.from('rate_limits').select('bucket');
    expect(data ?? []).toEqual([]);
  });

  it('cuenta los segundos de audio del tenant', async () => {
    const { data: tenant } = await db
      .from('tenants')
      .select('id')
      .eq('is_demo', true)
      .limit(1)
      .single();

    const { data, error } = await db.rpc('tenant_audio_seconds', {
      p_tenant_id: tenant!.id,
      p_window: '24 hours',
    });

    expect(error).toBeNull();
    expect(Number(data)).toBeGreaterThanOrEqual(0);
  });
});
