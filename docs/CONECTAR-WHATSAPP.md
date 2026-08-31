# Conectar WhatsApp Business

> **Para el hackathon no necesitas verificación de negocio.**
> Meta da un número de prueba gratis que envía y recibe con hasta 5 teléfonos
> que tú verifiques. Funciona el mismo día. La verificación —que tarda
> semanas— solo hace falta para escribirle a clientes reales.

Al terminar necesitas traer cuatro valores. Anótalos según los encuentres.

---

## 1 · Crear la app en Meta

1. [developers.facebook.com](https://developers.facebook.com) → inicia sesión
   con tu cuenta (usa **yanerox69@gmail.com**)
2. **My Apps** → **Create App**
3. Tipo: **Business**
4. Nombre: `RevenueFlow`
5. En el panel de la app: **Add Product** → **WhatsApp** → *Set up*

Meta crea automáticamente una cuenta de WhatsApp Business de prueba con un
número gratis.

---

## 2 · Los dos primeros valores

**App Secret** — App Settings → **Basic** → campo *App secret* → *Show*

```
WHATSAPP_APP_SECRET = ●●●●●●●●
```

**Phone number ID** — WhatsApp → **API Setup** → sección *Send and receive messages*

```
WHATSAPP_PHONE_NUMBER_ID = 1234567890123456
```

> ⚠️ Es el **Phone number ID**, una cadena larga de dígitos.
> **No** es el número de teléfono (+1 555…). Confundirlos es el error más común.

---

## 3 · El token permanente

En *API Setup* hay un **token temporal que caduca en 24 horas**. No sirve: el
hackathon dura un mes y el demo dejaría de funcionar al día siguiente.

Necesitas uno de usuario del sistema:

1. [business.facebook.com](https://business.facebook.com) → **Business Settings**
2. **Users → System Users** → *Add* → nombre `revenueflow-bot`, rol **Admin**
3. Con el usuario creado: **Add Assets** → *Apps* → elige `RevenueFlow` →
   activa **Full control** → *Save*
4. **Generate new token**:
   - App: `RevenueFlow`
   - Expiración: **Never**
   - Permisos: `whatsapp_business_messaging` y `whatsapp_business_management`
5. Cópialo **en ese momento**: Meta no vuelve a mostrarlo

```
WHATSAPP_ACCESS_TOKEN = EAA...
```

---

## 4 · Configurar el webhook

WhatsApp → **Configuration** → sección *Webhook* → *Edit*

| Campo | Valor |
|---|---|
| **Callback URL** | `https://revenueflow-ai-yanero.vercel.app/api/webhooks/whatsapp` |
| **Verify token** | el `WHATSAPP_VERIFY_TOKEN` de tu `.env.local` |

Pulsa **Verify and save**. Meta llama al endpoint y espera el desafío de vuelta;
si el token coincide, queda verde.

Después, en **Webhook fields**, suscríbete a **`messages`**. Sin eso Meta
verifica la URL pero no te manda nada.

---

## 5 · Autorizar tu teléfono

Con el número de prueba solo puedes escribirle a teléfonos verificados.

WhatsApp → **API Setup** → *To* → **Manage phone number list** → añade tu
número → te llega un código por WhatsApp → confírmalo.

Puedes registrar hasta 5.

---

## 6 · Enchufarlo

Con los tres valores en la mano, ejecuta:

```bash
npx tsx scripts/whatsapp-setup.mts
```

Carga las variables en Vercel, redespliega y asocia el número al negocio.

---

## Comprobar que funciona

Manda una **nota de voz** desde tu teléfono al número de prueba de Meta.
En unos segundos deberías ver la cita en el panel:

```bash
npx tsx scripts/agenda.mts
```

Si no aparece, mira los registros del webhook:

```bash
npx tsx scripts/vercel-logs.mts
```

---

## Errores frecuentes

**"The callback URL or verify token couldn't be validated"**
El `WHATSAPP_VERIFY_TOKEN` de Vercel no coincide con el que escribiste en Meta,
o no habías redesplegado después de cargarlo.

**El webhook queda verde pero no llega nada**
Falta suscribirse al campo **`messages`** en *Webhook fields*.

**Llegan mensajes pero no se crea la cita**
El `phone_number_id` no está asociado a ningún negocio. Corre
`scripts/conectar-whatsapp.mts` con el ID correcto.

**Funciona un día y deja de funcionar**
Usaste el token temporal de 24 horas. Vuelve al paso 3.

**"Firma inválida" en los registros**
El `WHATSAPP_APP_SECRET` está mal, o le sobra un espacio.
