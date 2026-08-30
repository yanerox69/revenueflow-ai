# RevenueFlow — instrucciones del proyecto

## AssemblyAI

Always fetch https://www.assemblyai.com/docs/llms.txt before writing AssemblyAI code.
The API has changed — do not rely on memorized parameter names.

Puntos que ya nos mordieron una vez:

- `speech_models` (pre-grabado) es un **array ordenado de respaldo** y es
  **opcional**: si se omite, la API cae a `universal-3-pro`. Hay que pasar
  `["universal-3-5-pro", "universal-2"]` explícitamente.
  En *realtime* el parámetro es singular (`speech_model`, string) y obligatorio.
- El header es `Authorization: <API_KEY>` **sin** `Bearer`.
  Única excepción: la Voice Agent API sí lleva `Bearer`.
- `prompt` es prosa que describe la escena. Las listas de términos exactos van
  en `keyterms_prompt`, nunca dentro del prompt.
- No usar `auto_chapters`, `summarization`, `summary_model`, `summary_type`
  (obsoletos) ni LeMUR (retirado). Para resúmenes: LLM Gateway.

## Las dos invariantes del código

**1. El núcleo no conoce países.**
Fuera de `src/lib/country/` no puede aparecer el literal `'VE'` ni `'BR'`.
Lo verifica `tests/no-country-literals.test.ts` en cada corrida. Agregar un país
debe ser escribir un pack, jamás tocar el motor. Esto incluye el SQL: usar un
trigger que consulte al tenant, no un `CHECK` con el código del país dentro.

**2. Un monto nunca es un número suelto.**
Se persiste con moneda, tasa, fuente, fecha y equivalente en USD congelado. En
un tenant de doble moneda, guardar el monto sin la tasa es un dato corrupto:
lo impide la validación en TypeScript y un trigger en Postgres.

## Reglas de trabajo

- `service_role` **jamás** en código que atienda una petición de usuario. Solo
  webhooks server-side, migraciones y alta de tenants.
- Cero botones decorativos. Si no hace algo, no existe.
- Nada de `float` para dinero. Enteros de centavos (`bigint`).
- Los webhooks verifican firma sobre el **cuerpo crudo**, antes de parsear.
- Toda ingesta externa es idempotente por `external_id`.

## Comandos

```bash
npm run dev        # servidor de desarrollo
npm test           # suite completa
npm run doctor     # revisa credenciales, migraciones y datos demo
npm run migrate    # aplica migraciones (necesita DATABASE_URL)
npm run seed       # datos demo: un tenant por país
npm run build:sql  # regenera supabase/APLICAR-TODO.sql
```
