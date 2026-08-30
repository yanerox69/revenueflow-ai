import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

/**
 * Vuelta de Google. Canjea el código por una sesión y decide a dónde va.
 *
 * Quien entra con Google tiene cuenta pero todavía NO tiene negocio: el
 * registro por correo crea ambos a la vez, este camino no. Por eso se le
 * manda a completar los datos del negocio antes que al panel.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error_description') ?? url.searchParams.get('error');

  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(oauthError)}`, url.origin),
    );
  }
  if (!code) {
    return NextResponse.redirect(new URL('/login', url.origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent('No se pudo completar el acceso.')}`, url.origin),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.redirect(new URL('/login', url.origin));

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.redirect(
    new URL(profile ? '/panel' : '/registro/negocio', url.origin),
  );
}
