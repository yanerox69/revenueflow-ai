'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { register, type AuthState } from '@/lib/actions/auth';
import { AuthShell, Field, Button, FormError } from '@/components/ui';
import { listCountryOptions } from '@/lib/country';

const COUNTRIES = listCountryOptions();

export default function RegistroPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    register,
    {},
  );
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

      <form action={action} className="mt-8 space-y-5">
        <FormError message={state.error} />

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

        {/* El selector no conoce países: los lee del registro de packs. */}
        <Field label="País" name="country" error={state.fieldErrors?.country}>
          <div className="grid grid-cols-2 gap-2.5">
            {COUNTRIES.map((c) => {
              const active = c.code === country;
              return (
                <label
                  key={c.code}
                  className={`flex cursor-pointer flex-col gap-0.5 rounded-lg border
                              px-3.5 py-3 transition-colors duration-150
                              ${
                                active
                                  ? 'border-primary bg-primary/8 ring-1 ring-primary'
                                  : 'border-border hover:border-primary/40'
                              }`}
                >
                  <input
                    type="radio"
                    name="country"
                    value={c.code}
                    checked={active}
                    onChange={() => setCountry(c.code)}
                    className="sr-only"
                  />
                  <span className="text-sm font-semibold">{c.displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {c.currency} · {c.taxIdKind}
                  </span>
                </label>
              );
            })}
          </div>
        </Field>

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
