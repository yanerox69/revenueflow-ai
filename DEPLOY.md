# Despliegue en Vercel

El hackathon exige una **URL pública funcionando**. Estos son los pasos.

Repositorio: `yanerox69/revenueflow-ai` (privado — Vercel despliega repos
privados sin problema).

---

## 1. Importar el proyecto

1. Entra a [vercel.com/new](https://vercel.com/new)
2. Conecta tu cuenta de GitHub si no lo has hecho
3. Elige **revenueflow-ai** → *Import*
4. Framework: Next.js (lo detecta solo). **No cambies nada más.**

## 2. Variables de entorno

Antes de pulsar *Deploy*, abre **Environment Variables** y agrega estas cuatro.
Cópialas de tu `.env.local`:

| Variable | Dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la misma pantalla (`sb_publishable_…`) |
| `SUPABASE_SERVICE_ROLE_KEY` | la misma pantalla (`sb_secret_…`) |
| `ASSEMBLYAI_API_KEY` | assemblyai.com → API Keys |

**No pongas `DATABASE_URL`.** Solo la usan las migraciones desde tu máquina;
la aplicación habla con Supabase por la API REST. Cuanto menos secreto viaje,
mejor.

Opcionales:

| Variable | Para qué |
|---|---|
| `LLM_GATEWAY_MODEL` | Cambiar el modelo del agente sin tocar código |
| `WHATSAPP_VERIFY_TOKEN` · `WHATSAPP_APP_SECRET` · `WHATSAPP_ACCESS_TOKEN` | Solo si conectas WhatsApp de verdad |

## 3. Desplegar

Pulsa **Deploy**. Tarda un par de minutos.

Cada `git push` a `main` vuelve a desplegar automáticamente.

---

## Después del primer despliegue

**Agrega la URL a Supabase** para que el login funcione:

> Supabase → Authentication → URL Configuration
> - *Site URL*: `https://tu-proyecto.vercel.app`
> - *Redirect URLs*: `https://tu-proyecto.vercel.app/**`

Sin esto el inicio de sesión falla en producción aunque funcione en local.

**Comprueba que el demo corre:**

1. Entra a `https://tu-proyecto.vercel.app/login`
2. `owner.ve@demo.local` / `demo-Passw0rd!`
3. Graba una nota de voz

> El micrófono del navegador **exige HTTPS**. Vercel lo da por defecto, así que
> en producción funciona; si alguna vez pruebas por `http://` en otra máquina,
> el grabador no pedirá permiso y parecerá roto.

---

## Si algo falla

**El grabador no pide permiso de micrófono** → no estás en HTTPS, o el
navegador tiene el permiso bloqueado para ese sitio.

**La transcripción se corta a los pocos segundos** → límite de duración de la
función. `/api/voice` declara `maxDuration = 60`; el flujo completo tarda unos
13 s, así que hay margen. Si aun así se corta, revísalo en el plan de Vercel.

**Login falla solo en producción** → falta el paso de *Site URL* de arriba.

**"Your account does not have access to this LLM Gateway model"** → el modelo
de `LLM_GATEWAY_MODEL` no está habilitado en tu cuenta de AssemblyAI. Comprueba
cuáles tienes con `npx tsx scripts/probe-models.mts` y usa uno de esos.
