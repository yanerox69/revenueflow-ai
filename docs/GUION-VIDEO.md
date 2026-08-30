# Guion del video — RevenueFlow
### AssemblyAI Voice Agent Hackathon · máximo 5 minutos

---

## Decisión de idioma

**Narración en inglés, demo en español.**

El jurado de lablab.ai es internacional. Pero no traduzcas el demo: que se
escuche la nota de voz en español y se vea la transcripción en español es
**la prueba viva de la capacidad multilingüe**. Narrar en inglés sobre un
producto que funciona en español demuestra el punto en vez de explicarlo.

Si prefieres narrar en español, ponle subtítulos en inglés. Lo que no funciona
es un demo en inglés: destruye la premisa del producto.

---

## Estructura

| Tramo | Duración | Qué pasa |
|---|---|---|
| Gancho | 0:00–0:25 | Se escucha una nota de voz real |
| El problema | 0:25–0:55 | Por qué LatAm es distinto |
| **Demo en vivo** | 0:55–2:40 | **Una sola toma, sin cortes** |
| Cómo funciona | 2:40–3:40 | La decisión de arquitectura |
| Valor de negocio | 3:40–4:30 | Números y mercado |
| Cierre | 4:30–5:00 | Qué sigue |

---

## GANCHO · 0:00–0:25

**En pantalla:** negro. Solo el audio.

**Suena:** la nota de voz real, en español, 6 segundos.
> *«Hola, buenos días. Necesito una cita para una limpieza dental. ¿Tienen
> disponibilidad el jueves en la tarde?»*

**Narración (empieza cuando termina el audio):**

> That's what a customer inquiry sounds like in Latin America.
>
> Not a form. Not an email. A voice note on WhatsApp — sent at eight in the
> evening, when the clinic is closed and nobody is going to hear it until
> tomorrow.

**En pantalla:** aparece el logo sobre negro.

> By then, that customer has already booked somewhere else.

---

## EL PROBLEMA · 0:25–0:55

**En pantalla:** capturas de WhatsApp con notas de voz sin abrir. Un teléfono
con notificaciones acumuladas.

**Narración:**

> In Latin America, WhatsApp isn't a channel. It's the phone.
>
> Over ninety percent of people use it, and small businesses run their entire
> operation inside it. Dental clinics, salons, workshops, vets.
>
> And here's what every tool built for them gets wrong: **their customers
> don't type. They talk.**
>
> The existing CRMs see a voice note and show a grey box that says
> "audio message". A human still has to listen to it, understand it, open a
> calendar and reply.
>
> So nothing happens until someone is free. And in this business, nobody is
> ever free.

---

## DEMO EN VIVO · 0:55–2:40

> ⚠️ **Una sola toma continua. Sin cortes, sin acelerar.**
> Un corte aquí es la señal universal de "esto está trucado". El valor entero
> del demo es que se vea que es real.

**En pantalla:** el panel de RevenueFlow en producción, ya con sesión iniciada.

**Narración:**

> This is RevenueFlow. I'm logged in as a dental clinic in Venezuela.
> Let me be the customer.

**Acción:** pulsar *Grabar nota de voz*. Hablar al micrófono **en español**,
con naturalidad, sin dicción de locutor:

> *«Hola, quiero una cita para una limpieza dental el jueves en la tarde.»*

**Acción:** pulsar *Detener*.

**Narración mientras corren las etapas** (no las describas, ya se ven —
usa el tiempo para explicar lo que importa):

> No form. No menu. No "press one for appointments". Just someone talking,
> the way they already do.

**Cuando aparece la transcripción (~7 s):**

> There's the transcription. Spanish, with punctuation, ninety-nine percent
> confidence — that's AssemblyAI's Universal-3.5 Pro.
>
> But transcription is the easy part. Watch what happens next.

**Cuando aparece la cita agendada:**

> It understood the customer wants a **dental cleaning**. It knew that's a real
> service in this clinic's catalog. It resolved "Thursday afternoon" into an
> actual date, in Caracas time. It checked the real calendar, found the next
> free slot, and **booked it**.
>
> And it wrote back to the customer — in their language.

**Acción:** señalar la burbuja de respuesta.

> Total: under ten seconds. Nobody touched anything.

**Acción (opcional, muy potente si el tiempo alcanza):** grabar una segunda
nota pidiendo lo mismo. Se agenda en el hueco siguiente.

> Same request again — and it books the next slot. It never double-books.

---

## CÓMO FUNCIONA · 2:40–3:40

**En pantalla:** el diagrama del pipeline. Simple, cuatro cajas.

```
  voz  →  AssemblyAI  →  LLM Gateway  →  reglas del negocio  →  cita
```

**Narración:**

> The whole pipeline runs on AssemblyAI. Universal-3.5 Pro for speech, and
> their LLM Gateway for understanding. One API key, one vendor.
>
> One detail that made a real difference: we don't just send the audio. We
> send the clinic's **own service catalog** as key terms. The model is
> listening biased toward "limpieza dental" and "blanqueamiento" — the exact
> words that matter to *this* business.

**En pantalla:** resaltar la frase.

> And here's the design decision the whole product rests on:
>
> **The model decides what the customer wants. The system decides what's
> allowed to happen.**
>
> The model cannot invent a service — it can only pick from the catalog.
> It cannot invent a date — it returns a weekday, and our code computes the
> real date in the business's timezone.
> It cannot invent availability — the slot comes from the database.
>
> If it's unsure, or it's a complaint, or it's about money, it escalates to a
> human and stops.
>
> That's the difference between a chatbot and something a real business can
> put in front of its customers.

---

## VALOR DE NEGOCIO · 3:40–4:30

**En pantalla:** el panel con las métricas. Después, un mapa de LatAm.

**Narración:**

> Who pays for this? Dental and aesthetic clinics, salons, workshops, vets.
> Businesses where a no-show costs real money and the owner is the one
> answering the phone.
>
> The tools they're offered today are built for a different world: SMS instead
> of WhatsApp, Stripe in countries where Stripe doesn't operate, and prices in
> dollars that make no sense locally.
>
> RevenueFlow is multi-country from the first line of code. Venezuela and
> Brazil today — different currencies, different tax IDs, different languages,
> different ways of speaking.

**En pantalla:** el panel venezolano y el brasileño lado a lado.

> Same engine. The Venezuelan business sees bolívares with the day's exchange
> rate. The Brazilian one sees reais. The agent speaks Spanish to one and
> Portuguese to the other.
>
> Adding a country is writing one file. Not rebuilding the product.

---

## CIERRE · 4:30–5:00

**En pantalla:** la URL en grande.

**Narración:**

> Everything you just saw is live and public. Open source, MIT.
>
> It's multi-tenant with row-level isolation, verified by tests. Every second
> of audio is metered, because at thirty dollars a month there's no room to
> burn tokens.
>
> Next is connecting real WhatsApp numbers, and reminders that recover
> no-shows automatically.
>
> Latin America runs on voice notes. RevenueFlow is the first reception desk
> that actually listens.

**En pantalla:** `revenueflow-ai-yanero.vercel.app` + el enlace del repo.

---

## Notas de producción

**Antes de grabar:**

1. **Calienta la función.** Haz una petición de prueba justo antes de grabar.
   La primera después de un despliegue puede tardar el doble.
2. **Vacía las citas del jueves** para que agende en un horario limpio:
   `npm run seed` reinicia los datos demo.
3. **Prueba tu micrófono** con una grabación de prueba. El audio del demo es
   el corazón del video: si se escucha mal, no hay nada que salvar.
4. **Cierra notificaciones** de Windows, WhatsApp y correo.
5. Navegador **en modo claro o oscuro, pero decidido** — no cambies a mitad.

**Al grabar el demo:**

- Habla como hablarías por WhatsApp, no como un locutor. Si suena leído,
  parece guionizado y pierde fuerza.
- **No repitas la toma si el agente tarda 20 segundos.** Déjalo. El avance por
  etapas se ve trabajando, y una espera real es más creíble que una perfecta.
- Si algo falla, **grábalo de nuevo entero**. No pegues trozos.

**Duración:** apunta a **4:30**, no a 5:00. Pasarse del límite es descalificación
en muchos hackathons, y un video que respira se ve mejor que uno atropellado.

**Lo que NO hay que hacer:**

- Enseñar código. El jurado técnico lo mira en el repo; en el video aburre.
- Enseñar la consola de tests. Ya está en el repo y en las slides.
- Explicar la arquitectura antes del demo. Primero el "wow", después el cómo.
- Prometer funciones que no existen. Si no está en pantalla, no se menciona.
