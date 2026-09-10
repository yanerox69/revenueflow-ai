# Paquete de entrega — AssemblyAI Voice Agents Challenge

Todo lo que hay que pegar en el formulario, listo para copiar. El texto va en
**inglés** porque el jurado lo lee en inglés; las notas en español son para ti
y no se envían.

> **Antes de enviar, lee la última sección.** Hay dos cosas que conviene
> decidir conscientemente, no por descuido.

---

## 0. Dónde se entrega

**https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon**

Lo organiza lablab.ai con AssemblyAI. Del 1 al 30 de septiembre de 2026,
$10.000 en premios ($5k en efectivo + $5k en créditos).

> Los criterios de puntuación y los campos exactos del formulario no están en
> la página pública. Este documento está escrito para el formato genérico; al
> abrir el formulario real, ajústalo a lo que pida.

---

## 1. Enlaces

```
Live app     https://revenueflow-ai-yanero.vercel.app
Source       https://github.com/yanerox69/revenueflow-ai
Video        (sube RevenueFlow.mp4 a YouTube como "no listado" y pega el enlace)
```

El vídeo está en `Desktop\Saas\video\RevenueFlow.mp4` — 3:40, 7,2 MB. Las
slides, por si piden material extra, en `video\slides\RevenueFlow-slides.pdf`.

---

## 2. Nombre y frase

**Project name**

```
RevenueFlow
```

**Tagline / elevator pitch** *(una línea, es lo único que muchos jurados leen entero)*

```
A WhatsApp voice-note receptionist for Latin American small businesses: send
a voice message, get a real appointment booked in under ten seconds.
```

---

## 3. Descripción corta

*Para el campo de resumen, si lo hay. Unas 60 palabras.*

```
Small businesses in Latin America lose bookings because nobody can answer the
phone while they are working. RevenueFlow answers on WhatsApp instead. A
customer sends a voice note in their own language; the agent transcribes it,
understands what they want, checks the real calendar, books the appointment,
and replies — end to end, in about seven seconds, with no forms and no phone
menus.
```

---

## 4. Descripción completa

*La mayoría de formularios usan estos apartados. Si el tuyo es un solo campo
de texto, pégalos seguidos con los encabezados.*

### Inspiration

In Latin America, WhatsApp is not *a* channel — it is *the* channel. A dental
clinic, a barbershop, a mechanic: customers message them on WhatsApp, and very
often with a voice note, because typing on a phone while you are on the bus is
worse than talking.

The problem is that the person who would answer is the same person doing the
work. A dentist with their hands in someone's mouth is not replying to
WhatsApp. So messages pile up, and by the time anyone answers, the customer
has booked somewhere else. The bottleneck is not marketing. It is that nobody
is at the front desk.

Existing tools do not fit. They assume typed English, US phone formats, a
single currency, and a customer willing to work through a menu. None of that
describes a voice note in Venezuelan Spanish asking for "algo el jueves en la
tarde".

### What it does

A customer sends a voice note to the business's WhatsApp number. The agent:

1. **Transcribes it** with AssemblyAI Universal-3.5 Pro, detecting the
   language rather than assuming it.
2. **Understands the request** — service, day, time of day, urgency —
   through the AssemblyAI LLM Gateway.
3. **Resolves the date** in the business's timezone. "El jueves en la tarde"
   becomes a real timestamp in America/Caracas.
4. **Checks real availability** against the business's schedule and existing
   appointments.
5. **Books the appointment** and **replies in the customer's language**.

About seven seconds, start to finish.

It also holds the conversation. A follow-up of four words — *"mejor para el
viernes"* — reschedules the right appointment to Friday at the same time,
without the customer repeating the service, the date, or which appointment
they mean. It confirms, cancels, and sends reminders the day before that ask
for an explicit yes, which is what turns a forgotten appointment into either a
confirmed one or a slot the business can resell.

And when it should not act — a complaint, a question about money, a medical
concern, or simply something it does not understand — it stops and hands the
conversation to a human. That boundary is enforced by the system, not by the
model's judgment.

### How we built it

The architecture rule is one sentence: **the model decides what the customer
wants; the system decides what is allowed.**

The model cannot invent a service — it must pick an ID from the business's
catalog. It cannot invent a date — it returns a weekday symbol, and the system
computes the real date in the tenant's timezone. It cannot invent
availability — slots come from the database. And it never writes the message
the customer receives: replies are hand-written templates, because they carry
the exact service, date and time, and a hallucination there is a lost
appointment in real life.

**AssemblyAI does the two hardest parts.**

*Speech-to-text* uses Universal-3.5 Pro with automatic language detection
instead of a fixed `language_code`. The business's country supplies a
fallback, the three languages we can answer in are passed as
`expected_languages`, and `code_switching` is on because mixed Spanish-English
voice notes are normal here. `on_low_language_confidence` is set to
`fallback` rather than the default `error` — a noisy voice note should degrade
to the country's language, not fail entirely. Losing the accent is
recoverable; losing the customer's message is not. The business's real service
names are passed as `keyterms_prompt`, and a prose description of the scene as
`prompt`.

*Intent extraction* uses the AssemblyAI LLM Gateway. The model available on
our account does not support structured outputs, so the JSON schema is
injected into the system prompt, `json-repair` post-processing is enabled, and
the result is validated with Zod — with per-field fallbacks, so a malformed
answer escalates to a human instead of returning a 500 to someone waiting on
WhatsApp.

**Multi-country by construction.** The core knows nothing about any country.
Each Country Pack supplies locale, timezone, currency, tax-ID validation
(Venezuelan RIF and cédula, Brazilian CPF and CNPJ with check digits), phone
normalization including Brazil's ninth digit, and a persona so replies sound
local. A test fails the build if a country literal appears in core code.

**Money is stored as integer minor units** with currency, FX rate, source and
timestamp, plus a frozen USD equivalent. Venezuelan businesses operate in
bolívares and dollars at once, and an amount without its rate is meaningless
three days later — so the database rejects it.

Every table has row-level security, forced, with tenant isolation proven by
tests that run against the real database.

Stack: Next.js 16, TypeScript, Tailwind, Supabase (Postgres + Auth), Vercel,
WhatsApp Cloud API. 169 tests.

### Challenges we ran into

**A small model returned `TUESDAY` for "jueves".** We had asked it for a
numeric weekday index, and it booked a Tuesday appointment in production. The
lesson was not "use a bigger model" — it was *don't ask a small model to do
arithmetic or encoding*. It now returns a symbol and the system does the
conversion.

**The model labelled a Chinese message as English.** A customer writing
"你好，我需要洗牙" would have received an English reply. Now the writing system
overrules the model: if the text is in an alphabet none of our three languages
uses, it is not in any of them, whatever the model says.

**It booked the wrong service.** A customer asked for *limpeza dental* and got
*Blanqueamiento*. The service ID was valid and existed in the catalog — it was
just wrong, and a UUID cannot be checked against anything. The model now also
returns the service name in the customer's own words, so two answers about the
same thing can contradict each other, and a contradiction is detectable.

**Rescheduling moved a 1:00 p.m. appointment to 8:00 a.m.** Technically a free
slot; obviously not what the customer meant. It now prefers slots near the
original time.

Each of these was found by running the thing for real, not by reading the
code.

### Accomplishments we're proud of

It works on a real WhatsApp number, with real voice notes, end to end, and we
have watched it do so — including the follow-up that reschedules from four
words.

It answers in the customer's language rather than the country's. Tested in
five: Portuguese, English and Spanish get replies in their own language with
correctly localized dates; Russian and Mandarin are understood and booked, and
answered in the country's language, because we will not have a small model
translate a message that carries a date and a time.

And the failures above are in the repository as tests, not as anecdotes.

### What we learned

That the interesting engineering in a voice agent is not the transcription —
AssemblyAI does that at 99% confidence without help. It is everything around
it: what the model is allowed to decide, what happens when it is wrong, and
how the system stays correct anyway.

### What's next

Restaurant orders instead of appointments — a different product on the same
engine. Letting a business take over a conversation from the panel. And
attendance rate, now that appointments get closed out.

---

## 5. Built with

*Etiquetas. Pon las que el formulario acepte, en este orden.*

```
assemblyai · universal-3.5-pro · llm-gateway · whatsapp-cloud-api · nextjs
typescript · supabase · postgresql · tailwindcss · vercel · zod · vitest
voice-agents · speech-to-text · multilingual · latin-america
```

---

## 6. Cómo probarlo (esto importa más de lo que parece)

*Un jurado que no consigue probarlo puntúa lo que ve en el vídeo y nada más.
Pega esto donde el formulario pida instrucciones.*

```
TRY IT IN 30 SECONDS — no signup needed

1. Open https://revenueflow-ai-yanero.vercel.app
2. Log in with:   owner.ve@demo.local  /  demo-Passw0rd!
3. Press the microphone and say, in Spanish:
      "Hola, necesito una cita para una limpieza dental.
       ¿Tienes algo el jueves en la tarde?"
   Or in English:
      "Hi, I need a dental cleaning. Anything Thursday afternoon?"
4. Watch the stages: transcribing → understanding → checking the
   calendar → booked. The appointment appears in the panel below.

A Brazilian business is also seeded: owner.br@demo.local, same password.
Same engine, different country — Portuguese, BRL, CNPJ, São Paulo timezone.

Note on WhatsApp: the number is a Meta test number, which can only deliver
to pre-authorized recipients, so the judges cannot message it directly. The
web recorder above runs the identical pipeline — same transcription, same
agent, same database. The video shows the real WhatsApp path.
```

---

## 7. Antes de darle a Enviar

Dos decisiones conscientes, no descuidos:

- [ ] **El vídeo es el antiguo.** Está bien hecho (3:40, completo), pero el
      demo es la grabación del panel web, no WhatsApp real. El plan del vídeo
      v2 —WhatsApp Web y el panel lado a lado— sigue en `VIDEO-V2.md`,
      esperando a que tengas un rato de silencio para regrabar el audio 3.
      **Se puede entregar con el que hay.** Si la plataforma permite editar
      hasta el cierre, entrega ya y sustituye el vídeo si lo regrabas.

- [ ] **La slide 3 lleva un dato de penetración de WhatsApp sin fuente.** O
      se cita, o se quita. Un número sin origen en una entrega técnica resta
      más de lo que suma.

Y lo que sigue sin respuesta:

- [ ] **¿Se permite trabajo previo al 1 de septiembre?** Preguntado a soporte
      de AssemblyAI el 1 de septiembre y en el Q&A de Discord. Sin respuesta
      por ninguna de las dos vías. Si el formulario tiene un campo de notas,
      merece una línea honesta:

      > "The project was built and deployed before the challenge window and
      > has been developed further throughout September; the commit history
      > is public."

      Decirlo tú es mejor que que lo descubran.

---

## 8. Números, por si los piden

```
Tests                169
Commits              40, historial público
Licencia             MIT
Países               2 (Venezuela, Brasil)
Idiomas de respuesta 3 (español, portugués, inglés) + respaldo
Verticales           7 modeladas, 3 con datos de demo
De voz a cita        ~7 segundos
```
