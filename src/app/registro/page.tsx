'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { register, signInWithGoogle, type AuthState } from '@/lib/actions/auth';
import {
  AuthShell,
  Field,
  Button,
  FormError,
  FormNotice,
  GoogleButton,
  Divider,
} from '@/components/ui';
import { CountryPicker, COUNTRIES } from '@/components/country-picker';

export default function RegistroPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(register, {});
  const [country, setCountry] = useState(COUNTRIES[0].code);
  const selected = COUNTRIES.find((c) => c.code === country)!;

  return (
    <AuthShell
      headline="Configura tu negocio en minutos."
      sub="Elige tu país y el sistema se adapta: tu moneda, tus documentos y la forma en que hablan tus clientes."
    >
      <h1 className="text-2xl font-bold tracking-tight">Crea tu cuenta</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        ¿Ya tienes una?{' '}
        <Link
          href="/login"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Entrar
        </Link>
      </p>

      <form action={signInWithGoogle} className="mt-8">
        <GoogleButton label="Registrarme con Google" />
      </form>

      <div className="my-5">
        <Divider label="o con tu correo" />
      </div>

      <form action={action} className="space-y-5">
        <FormError message={state.error} />
        <FormNotice message={state.notice} />

        <Field
          label="Tu nombre"
          name="fullName"
          autoComplete="name"
          required
          error={state.fieldErrors?.fullName}
        />
        <Field
          label="Nombre del negocio"
          name="businessName"
          required
          error={state.fieldErrors?.businessName}
        />

        <CountryPicker
          value={country}
          onChange={setCountry}
          error={state.fieldErrors?.country}
        />

        <Field
          label={`${selected.taxIdKind} del negocio`}
          name="taxId"
          hint="Opcional. Puedes agregarlo después."
          error={state.fieldErrors?.taxId}
        />

        <Field
          label="Correo"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={state.fieldErrors?.email}
        />
        <Field
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="new-password"
          hint="Mínimo 8 caracteres."
          required
          error={state.fieldErrors?.password}
        />

        <Button type="submit" disabled={pending}>
          {pending ? 'Creando…' : 'Crear negocio'}
        </Button>
      </form>
    </AuthShell>
  );
}
