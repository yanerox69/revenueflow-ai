# Teleprónter — lee esto en voz alta

Solo las líneas que dices. Lo que va entre `[ ]` es acción, no se lee.

Objetivo: **4:30**. Habla despacio.

> **Hay dos versiones**: la narración en inglés (abajo) y la misma en español
> ([VERSIÓN-ES](#versión-en-español), al final del archivo).
>
> Si narras en español, **pon subtítulos en inglés**. El jurado de lablab es
> internacional y no quieres que se pierdan el argumento.

Narración en **inglés**, demo en **español**.

> Habla despacio. La tentación es correr. Un video de 4:30 pausado se entiende;
> uno de 5:00 atropellado, no.

---

## 1 · GANCHO

`[Pantalla en negro. Suena tu nota de voz de WhatsApp, 6 segundos.]`

`[Cuando termine el audio, empiezas:]`

That's what a customer inquiry sounds like in Latin America.

Not a form. Not an email. A voice note on WhatsApp — sent in the evening,
when the clinic is closed, and nobody is going to hear it until tomorrow.

`[Aparece el logo]`

By then, that customer has already booked somewhere else.

---

## 2 · EL PROBLEMA

`[Capturas de WhatsApp con notas de voz sin abrir]`

In Latin America, WhatsApp isn't a channel. It's the phone.

Small businesses run their entire operation inside it. Dental clinics,
salons, workshops, vets.

And here's what every tool built for them gets wrong. Their customers
don't type. They talk.

Existing CRMs see a voice note and show a grey box that says "audio message".
A human still has to listen to it, understand it, open a calendar, and reply.

So nothing happens until someone is free. And in this business, nobody is
ever free.

---

## 3 · DEMO

`[Panel de RevenueFlow, sesión ya iniciada. UNA SOLA TOMA, SIN CORTES.]`

This is RevenueFlow. I'm logged in as a dental clinic in Venezuela.

`[Pulsas "sube un audio de WhatsApp" y eliges tu .ogg]`

This is a real WhatsApp voice note. I recorded it on my phone, the way any
customer would.

`[Empiezan a correr las etapas. No las describas — se ven. Usa el tiempo:]`

No form. No menu. No "press one for appointments". Just someone talking, the
way they already do.

`[Cuando aparece la transcripción, ~6 segundos:]`

There's the transcription. Spanish, punctuated, ninety-nine percent
confidence. That's AssemblyAI's Universal-3.5 Pro.

But transcription is the easy part. Watch what happens next.

`[Cuando aparece la cita agendada:]`

It understood the customer wants a dental cleaning — a real service in this
clinic's catalog.

It resolved "Thursday" into an actual date, in Caracas time.

It checked the real calendar, found the next free slot, and booked it.

`[Señalas la burbuja de respuesta]`

And it wrote back to the customer, in their language.

Under ten seconds. Nobody touched anything.

---

## 4 · CÓMO FUNCIONA

`[Diagrama del pipeline]`

The whole thing runs on AssemblyAI. Universal-3.5 Pro for speech, their LLM
Gateway for understanding. One API key.

One detail that made a real difference. We don't just send the audio. We send
the clinic's own service catalog as key terms. The model listens biased toward
the exact words that matter to this business.

`[Resaltas la frase]`

And here's the decision the whole product rests on.

The model decides what the customer wants. The system decides what's allowed
to happen.

It cannot invent a service. It can only pick from the catalog.

It cannot invent a date. It returns a weekday, and our code computes the real
date in the business's timezone.

It cannot invent availability. The slot comes from the database.

If it's unsure, or it's a complaint, or it's about money — it escalates to a
human and stops.

That's the difference between a chatbot and something a real business can put
in front of its customers.

---

## 5 · VALOR DE NEGOCIO

`[Panel con métricas, después Venezuela y Brasil lado a lado]`

Who pays for this? Dental and aesthetic clinics, salons, workshops, vets.
Businesses where a missed appointment costs real money, and the owner is the
one answering the phone.

The tools they're offered today were built for a different world. SMS instead
of WhatsApp. Payment providers that don't operate in their country. Prices in
dollars that make no sense locally.

RevenueFlow is multi-country from the first line of code. Venezuela and Brazil
today.

`[Las dos capturas]`

Same engine. The Venezuelan business sees bolívares, with the day's exchange
rate. The Brazilian one sees reais. The agent speaks Spanish to one, Portuguese
to the other.

Adding a country is writing one file. Not rebuilding the product.

---

## 6 · CIERRE

`[La URL en grande]`

Everything you just saw is live and public. Open source, MIT.

Multi-tenant, with row-level isolation verified by tests. Every second of audio
is metered, because at thirty dollars a month there's no room to burn tokens.

Next is connecting real WhatsApp numbers, and reminders that recover no-shows
automatically.

Latin America runs on voice notes.

RevenueFlow is the first reception desk that actually listens.

`[Pantalla final: URL + repositorio]`

---

## Antes de darle a grabar

- [ ] `npx tsx scripts/limpiar-agenda.mts` — libera los horarios
- [ ] Entra al panel y déjalo abierto en la pantalla del demo
- [ ] Ten el `.ogg` a mano, en una carpeta fácil de encontrar en el diálogo
- [ ] Silencia notificaciones de Windows, WhatsApp y correo
- [ ] Prueba de sonido: graba 10 segundos y escúchate

## Si algo sale mal a mitad

**Repite la toma entera.** No pegues trozos. Un corte en el demo es la señal
universal de que está trucado, y ahí se te cae la credibilidad del video
completo.
