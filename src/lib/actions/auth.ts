'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getPack, listCountryCodes } from '@/lib/country';

export type AuthState = {
  error?: string;
  /** Mensaje informativo, no de error (p. ej. "confirma tu correo"). */
  notice?: string;
  fieldErrors?: Record<string, string>;
};

const loginSchema = z.object({
  email: z.string().email('Correo inválido.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
});

export async function login(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: 'Correo o contraseña incorrectos.' };
  redirect('/panel');
}

const registerSchema = z.object({
  fullName: z.string().min(2, 'Escribe tu nombre.'),
  businessName: z.string().min(2, 'Escribe el nombre del negocio.'),
  email: z.string().email('Correo inválido.'),
  password: z.string().min(8, 'Mínimo 8 caracteres.'),
  country: z.enum(listCountryCodes() as [string, ...string[]], {
    message: 'Selecciona un país.',
  }),
  taxId: z.string().optional(),
});

export async function register(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error) };
  }

  const { fullName, businessName, email, password, country, taxId } = parsed.data;
  const pack = getPack(country);

  // El documento fiscal se valida con las reglas del país, no con un regex global.
  if (taxId && !pack.validateTaxId(taxId)) {
    return { fieldErrors: { taxId: `${pack.taxIdKind} inválido.` } };
  }

  const supabase = await createSupabaseServerClient();
  const { data: signUp, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError || !signUp.user) {
    return { error: signUpError?.message ?? 'No se pudo crear la cuenta.' };
  }

  // Alta atómica de tenant + settings + rol OWNER.
  const admin = createSupabaseAdminClient();
  const { error: tenantError } = await admin.rpc('register_tenant', {
    p_user_id: signUp.user.id,
    p_email: email,
    p_full_name: fullName,
    p_business_name: businessName,
    p_country_code: pack.code,
    p_locale: pack.locale,
    p_timezone: pack.timezone,
    p_primary_currency: pack.primaryCurrency,
    p_display_currency: pack.displayCurrency,
    p_fx_source: pack.fxSource,
    p_tax_id_kind: pack.taxIdKind,
  });

  if (tenantError) {
    // Sin tenant no hay cuenta utilizable: no dejamos un usuario huérfano.
    await admin.auth.admin.deleteUser(signUp.user.id);
    return { error: 'No se pudo crear el negocio. Intenta de nuevo.' };
  }

  // Si Supabase exige confirmar el correo, signUp NO devuelve sesión.
  // Redirigir al panel en ese caso deja al usuario en un bucle de login sin
  // explicación, con la cuenta creada pero inutilizable.
  if (!signUp.session) {
    return {
      notice:
        `Tu negocio quedó creado. Te enviamos un correo a ${email}: ` +
        'confirma la dirección y ya podrás entrar.',
    };
  }

  redirect('/panel');
}

const businessSchema = z.object({
  businessName: z.string().min(2, 'Escribe el nombre del negocio.'),
  country: z.enum(listCountryCodes() as [string, ...string[]], {
    message: 'Selecciona un país.',
  }),
  taxId: z.string().optional(),
});

/**
 * Crea el negocio de un usuario que ya tiene sesión (llegó por Google).
 * El registro por correo hace las dos cosas de una; este camino las separa.
 */
export async function createBusiness(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = businessSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error) };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return { error: 'Tu sesión expiró. Vuelve a entrar.' };

  const pack = getPack(parsed.data.country);
  const { businessName, taxId } = parsed.data;

  if (taxId && !pack.validateTaxId(taxId)) {
    return { fieldErrors: { taxId: `${pack.taxIdKind} inválido.` } };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc('register_tenant', {
    p_user_id: user.id,
    p_email: user.email,
    p_full_name:
      (user.user_metadata?.full_name as string | undefined) ?? user.email.split('@')[0],
    p_business_name: businessName,
    p_country_code: pack.code,
    p_locale: pack.locale,
    p_timezone: pack.timezone,
    p_primary_currency: pack.primaryCurrency,
    p_display_currency: pack.displayCurrency,
    p_fx_source: pack.fxSource,
    p_tax_id_kind: pack.taxIdKind,
  });

  if (error) return { error: 'No se pudo crear el negocio. Intenta de nuevo.' };

  redirect('/panel');
}

/**
 * Inicia el flujo de Google. Supabase devuelve la URL de consentimiento y
 * redirigimos allí; el callback termina de crear la sesión.
 */
export async function signInWithGoogle() {
  const supabase = await createSupabaseServerClient();
  const origin = (await headers()).get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? '';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent('No se pudo iniciar sesión con Google.')}`);
  }

  redirect(data.url);
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/login');
}

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0]);
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
