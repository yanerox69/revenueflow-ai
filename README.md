# RevenueFlow

### The reception desk that actually listens.

Voice-first WhatsApp reception for Latin American small businesses.
A customer sends a voice note; the agent transcribes it, understands it, checks
the real calendar and **books the appointment** — in under ten seconds.

**Live:** [revenueflow-ai-yanero.vercel.app](https://revenueflow-ai-yanero.vercel.app)
· demo login `owner.ve@demo.local` / `demo-Passw0rd!`

> Built for the **AssemblyAI Voice Agent Hackathon**.
> Speech: Universal-3.5 Pro. Understanding: LLM Gateway. One API key.

---

## Why this exists

In Latin America WhatsApp isn't a channel — it's the phone. Small businesses
run entirely inside it, and **their customers don't type, they talk.** Every
CRM on the market renders a voice note as a grey box saying "audio message",
and a human still has to listen, understand, open a calendar and reply.

So nothing happens until someone is free. And nobody is ever free.

## The decision the product rests on

> **The model decides what the customer wants.
> The system decides what's allowed to happen.**

- It **cannot invent a service** — it only picks from the tenant's catalog.
- It **cannot invent a date** — it returns a weekday; the system computes the
  real date in the business's timezone.
- It **cannot invent availability** — the slot comes from the database.
- Complaint, payment or doubt → **escalates to a human and stops.**

Países activos: **Venezuela** y **Brasil**.

---

---

## Qué hay aquí

| Pieza | Ubicación |
|---|---|
| Country packs | `src/lib/country/` |
| Esquema + RLS | `supabase/migrations/` |
| Pantallas | `src/app/{login,registro,panel}` |
| Seed | `scripts/seed.ts` |
| Tests | `tests/` |

---

## Puesta en marcha

**1. Crea un proyecto en [supabase.com](https://supabase.com)** (plan gratuito sirve).

**2. Copia las credenciales** desde *Project Settings → API*:

```bash
cp .env.example .env.local
```

Rellena `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y
`SUPABASE_SERVICE_ROLE_KEY`.

> La `service_role` atraviesa la RLS. Solo en servidor, nunca en el repositorio.

**3. Aplica las migraciones:**

```bash
npm run migrate
```

Necesita `DATABASE_URL` en `.env.local` — *Supabase → Connect → Session pooler*.
Cada archivo corre en su propia transacción, se registra en `_migrations` (así
que es idempotente) y al terminar recarga el caché de esquema de PostgREST.

> **Si tu red bloquea el puerto 5432**, usa el **6543** en la URI. Es el caso en
> algunas redes residenciales y da un `ECONNRESET` o timeout poco descriptivo.
> Diagnostícalo con `npx tsx scripts/probe-db.mts`, que prueba varias variantes.

Alternativa manual: pega `supabase/APLICAR-TODO.sql` en el *SQL Editor*.
Regenéralo con `npm run build:sql` si tocas alguna migración.

**4. Carga los datos demo:**

```bash
npm run seed
```

Crea dos tenants — *Clínica Dental Sonrisa* (Venezuela) y *Studio Bella Estética*
(Brasil). Ambos entran con `demo-Passw0rd!`.

**5. Arranca:**

```bash
npm run dev
```

---

## Tests

```bash
npm test
```

| # | Verifica | Requiere Supabase |
|---|---|---|
| 1 | El usuario solo ve los leads de su tenant | Sí |
| 2 | Pedir un lead ajeno por id devuelve 0 filas | Sí |
| 3 | Insertar con `tenant_id` ajeno es rechazado | Sí |
| 4 | El registro es atómico, sin tenants huérfanos | Sí |
| 5 | Ninguna tabla quedó sin RLS | Sí |
| 6 | CPF, CNPJ, RIF y cédula con dígito verificador | No |
| 7 | Un monto de doble moneda sin tasa es inválido | No |
| 8 | Ningún archivo del núcleo codifica un país a mano | No |

Los tests 1–5 se marcan como **skip** sin credenciales, en vez de dar un falso
verde. Configura `.env.local`, corre el seed y vuelve a ejecutar.

`npm run doctor` revisa credenciales, migraciones y datos demo antes de los
tests, sin imprimir ningún secreto.

---

## Las dos reglas que sostienen todo

**1. El núcleo no conoce países.**
Fuera de `src/lib/country/` no puede aparecer un literal de país. El test 8 lo
verifica en cada corrida. Agregar Colombia debe ser escribir un pack, no tocar
el motor.

**2. Un monto nunca es un número suelto.**
Se persiste con moneda, tasa, fuente, fecha y equivalente en USD congelado. En
un país con doble moneda, guardar el monto sin la tasa produce un dato que a los
tres días no significa nada. El test 7 lo impide.

---

## Pendiente antes de producción

- [ ] **Validar el dígito verificador del RIF** contra una muestra de RIF reales.
      El algoritmo implementado es el documentado públicamente; no está
      verificado contra el registro del SENIAT.
- [ ] Middleware de refresco de sesión (`middleware.ts`).
- [ ] Confirmación de correo en el alta (hoy el seed la salta con `email_confirm`).
- [ ] Política de retención de datos para LGPD antes de operar en Brasil.

---

## Notas de voz

El canal real en LatAm no es el texto: el cliente manda un audio de 40 segundos.
El pipeline vive en `src/lib/ingest/voice-note.ts` y tiene **dos entradas**:

| Entrada | Ruta | Para qué |
|---|---|---|
| Grabador del navegador | `POST /api/voice` | Demo — nunca depende de Meta |
| Webhook de WhatsApp | `POST /api/webhooks/whatsapp` | Producción |

Ambas llegan al mismo `ingestVoiceNote()`. La transcripción es AssemblyAI, y
**el idioma lo dicta el country pack**: un tenant venezolano transcribe en `es`,
uno brasileño en `pt`.

Necesitas `ASSEMBLYAI_API_KEY` en `.env.local` para que funcione.

Garantías:

- **Idempotencia** por `external_id`. WhatsApp reintenta sus webhooks; sin esto
  el mismo audio se transcribiría —y se cobraría— dos veces.
- **El mensaje se guarda antes de transcribir.** Si el proveedor falla, el audio
  del cliente no se pierde y queda en estado `FAILED` con el error.
- **Firma HMAC-SHA256** verificada sobre el cuerpo crudo del webhook.
- Cada segundo de audio se registra en `usage_events`.

## El agente

No conversa: **actúa**. `src/lib/agent/`

```
audio → transcripción → intención → disponibilidad real → cita agendada
```

Corre sobre el **LLM Gateway de AssemblyAI** — misma llave que la
transcripción, un solo proveedor.

La regla que lo hace confiable:

> El modelo decide **qué quiere** el cliente.
> El sistema decide **qué se puede hacer**.

En concreto, el modelo **no puede**:

- **Inventar un servicio.** Solo elige ids del catálogo del tenant, y aunque
  devuelva uno inexistente se descarta y se escala a un humano.
- **Inventar una fecha.** Devuelve día de la semana y franja; la fecha real la
  calcula el sistema en el huso del negocio (`src/lib/agent/scheduling.ts`).
- **Inventar disponibilidad.** El hueco sale de `availability_rules` menos las
  citas ya tomadas, y un índice único en Postgres impide la doble reserva.

Escala a una persona ante una queja, un tema de pagos, un asunto médico
delicado, o cuando simplemente no entiende.

Si la respuesta del modelo no cumple el esquema, **no lanza un error**: devuelve
una intención que escala a un humano. Un cliente esperando en WhatsApp merece
que alguien lo atienda, no un 500.

### Modelo

`LLM_GATEWAY_MODEL` (por defecto `qwen3.5-4b-32k-fast`, el propio de
AssemblyAI). Los modelos que aceptan `response_format: json_schema` lo usan
automáticamente; el resto reciben el esquema en el prompt y se validan con Zod
al volver. Comprueba a qué modelos tiene acceso tu cuenta:

```bash
npx tsx scripts/probe-models.mts
```

### Probarlo de punta a punta

```bash
node --conditions=react-server --import tsx scripts/try-agent.mts audio.wav VE
```

> La condición `react-server` hace falta porque el pipeline usa `server-only`.
