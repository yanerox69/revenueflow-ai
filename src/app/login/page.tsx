'use client';

import Link from 'next/link';
import { Suspense, useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { login, signInWithGoogle, type AuthState } from '@/lib/actions/auth';
import { AuthShell, Field, Button, FormError, GoogleButton, Divider } from '@/components/ui';

export default function LoginPage() {
  return (
    <AuthShell
      headline="Ningún mensaje sin responder."
      sub="Tu recepción por WhatsApp atiende, entiende los audios y agenda sola — mientras tú trabajas."
    >
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}

function LoginForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, {});

  // Los fallos del acceso con Google vuelven por la URL.
  const urlError = useSearchParams().get('error') ?? undefined;

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight">Entrar</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        ¿Aún no tienes cuenta?{' '}
        <Link
          href="/registro"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Crea tu negocio
        </Link>
      </p>

      <form action={signInWithGoogle} className="mt-8">
        <GoogleButton label="Continuar con Google" />
      </form>

      <div className="my-5">
        <Divider label="o con tu correo" />
      </div>

      <form action={action} className="space-y-5">
        <FormError message={state.error ?? urlError} />

        <Field
          label="Correo"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="tu@negocio.com"
          required
          error={state.fieldErrors?.email}
        />
        <Field
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          error={state.fieldErrors?.password}
        />

        <Button type="submit" disabled={pending}>
          {pending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </>
  );
}
