'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { login, type AuthState } from '@/lib/actions/auth';
import { AuthShell, Field, Button, FormError } from '@/components/ui';

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, {});

  return (
    <AuthShell
      headline="Ningún mensaje sin responder."
      sub="Tu recepción por WhatsApp atiende, entiende los audios y agenda sola — mientras tú trabajas."
    >
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

      <form action={action} className="mt-8 space-y-5">
        <FormError message={state.error} />

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
    </AuthShell>
  );
}
