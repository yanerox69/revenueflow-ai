'use client';

import { Field } from '@/components/ui';
import { listCountryOptions, type CountryCode } from '@/lib/country';

export const COUNTRIES = listCountryOptions();

/** El selector no conoce países: los lee del registro de packs. */
export function CountryPicker({
  value,
  onChange,
  error,
}: {
  value: CountryCode;
  onChange: (code: CountryCode) => void;
  error?: string;
}) {
  return (
    <Field label="País" name="country" error={error}>
      <div className="grid grid-cols-2 gap-2.5">
        {COUNTRIES.map((c) => {
          const active = c.code === value;
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
                onChange={() => onChange(c.code)}
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
  );
}
