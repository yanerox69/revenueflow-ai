'use client';

import { useActionState, useState } from 'react';
import { createBusiness, type AuthState } from '@/lib/actions/auth';
import { AuthShell, Field, Button, FormError } from '@/components/ui';
import { CountryPicker, COUNTRIES } from '@/components/country-picker';

/**
 * Último paso para quien entró con Google: ya tiene cuenta, le falta negocio.
 */
export default function NegocioPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    createBusiness,
    {},
  );
  const [country, setCountry] = useState(COUNTRIES[0].code);
  const selected = COUNTRIES.find((c) => c.code === country)!;

  return (
    <AuthShell
      headline="Un paso más y listo."
      sub="Con el país, el sistema ya sabe en qué moneda cobrar, qué documento pedir y en qué idioma hablarle a tus clientes."
    >
      <h1 className="text-2xl font-bold tracking-tight">Datos de tu negocio</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Tu cuenta ya está creada. Falta decirnos a qué se dedica.
      </p>

      <form action={action} className="mt-8 space-y-5">
        <FormError message={state.error} />

        <Field
          label="Nombre del negocio"
          name="businessName"
          autoFocus
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

        <Button type="submit" disabled={pending}>
          {pending ? 'Creando…' : 'Entrar a mi panel'}
        </Button>
      </form>
    </AuthShell>
  );
}
