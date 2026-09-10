# Paquete de entrega — AssemblyAI Voice Agent Hackathon

**https://lablab.ai/ai-hackathons/assemblyai-voice-agent-hackathon**

Del 1 al 30 de septiembre de 2026. $10.000 en premios ($5k efectivo + $5k en
créditos). El cierre es **a las 11 de la mañana del día 30**, no al final del
día: trabaja con el 29 como fecha real.

Todo lo de abajo está medido contra los límites reales del formulario. El
texto va en **inglés**; las notas en español son para ti y no se envían.

---

## Paso 1 de 3 — Basic Information

### Submission Title
*máx. 50 · esto usa 40*

```
RevenueFlow: WhatsApp voice receptionist
```

### Short Description
*máx. 255 · esto usa 238*

```
A WhatsApp voice-note receptionist for Latin American small businesses. A customer sends a voice message in their own language; seconds later the appointment is booked and confirmed. No forms, no menus, nobody waiting on hold.
```

### Long Description
*máx. 2000 · esto usa 1827*

```
In Latin America, WhatsApp is not a channel — it is the channel. Customers message small businesses there, usually with a voice note. But the person who would answer is the person doing the work: a dentist with their hands in someone's mouth is not replying to WhatsApp. Messages pile up, and the customer books somewhere else.

RevenueFlow answers instead. It transcribes the voice note with AssemblyAI Universal-3.5 Pro, extracts intent through the AssemblyAI LLM Gateway, resolves "el jueves en la tarde" into a real timestamp in the business's timezone, checks actual availability, books the appointment, and replies — in seconds, while the customer is still looking at their phone.

Language is detected, not assumed. Detection runs with expected_languages, a country fallback and code_switching for mixed voice notes, and on_low_language_confidence set to fallback, so a noisy note degrades to the country's language instead of failing outright. It answers in Spanish, Portuguese or English — and still books for someone writing in Russian or Mandarin.

One rule shapes everything: the model decides what the customer wants; the system decides what is allowed. The model cannot invent a service (catalog IDs only), a date (it returns a weekday symbol and the system computes the date), or availability. Replies are hand-written templates, because they carry exact dates and times, and a hallucination there is a lost appointment in real life.

It holds the conversation too. Four words — "mejor para el viernes" — reschedule the right appointment to Friday at the same hour, without repeating the service or the date. Complaints, money and medical questions stop and go to a human.

Running on a real WhatsApp number, in two countries, with row-level tenant isolation and money stored as integer minor units with its FX rate. 177 tests. Source public under MIT.
```

### Categories

Es un desplegable con opciones cerradas. Elige lo más cercano a, por orden:

```
Voice / Speech · AI Agents · Productivity · Business / SMB
```

### Technologies Used

Igual, desplegable. Prioriza que **AssemblyAI salga primero** — es su hackathon:

```
AssemblyAI · Next.js · TypeScript · Supabase · PostgreSQL · Vercel
WhatsApp API · Tailwind CSS
```

> Si alguna opción de las dos listas no existe en el desplegable, mándame una
> captura de las que sí hay y elijo.

---

## Paso 2 de 3 — Media

Los tres son **subida de archivo**, no enlaces.

```
Cover Image          Desktop\Saas\video\material\portada.png          2560x1440
Video Presentation   Desktop\Saas\video\RevenueFlow.mp4               4:18 · 10 MB
Slide Presentation   Desktop\Saas\video\slides\RevenueFlow-slides.pdf 1,7 MB
```

El vídeo también está en YouTube por si el paso 3 admite enlace:
`https://youtu.be/ti3kfZqFXo0`

> Comprobado sin sesión iniciada el 10 de septiembre: carga título, canal y
> descripción, así que un jurado puede verlo.

---

## Paso 3 de 3 — Application

### GitHub Repository

```
https://github.com/yanerox69/revenueflow-ai
```

### Demo Application Platform

Desplegable. Es una aplicación web: elige **Web** (o *Web App* / *Website*,
según cómo lo llamen).

### Demo Application URL

```
https://revenueflow-ai-yanero.vercel.app
```

### Additional Information
*máx. 2000*

```
HOW TO TRY IT — 30 seconds, no signup

1. Open https://revenueflow-ai-yanero.vercel.app
2. Log in with:  owner.ve@demo.local  /  demo-Passw0rd!
3. Press the microphone and speak, in Spanish or English:
     "Hola, necesito una cita para una limpieza dental. ¿Tienes algo el jueves en la tarde?"
     "Hi, I need a dental cleaning. Anything Thursday afternoon?"
4. Watch the stages — transcribing, understanding, checking the calendar — and the appointment appear in the panel below.

A Brazilian business is also seeded: owner.br@demo.local, same password. Same engine, different country: Portuguese, BRL, CNPJ, São Paulo timezone.

ON WHATSAPP — the number is a Meta test number and only delivers to pre-authorised recipients, so judges cannot message it directly. The web recorder above runs the identical pipeline: same transcription, same agent, same database. The video shows the real WhatsApp path end to end, including a four-word follow-up that reschedules the right appointment.

WORTH A LOOK IN THE CODE
- src/lib/voice/assemblyai.ts — automatic language detection with expected_languages, a country fallback and code_switching; on_low_language_confidence set to fallback so a noisy note degrades instead of failing.
- src/lib/agent/intent.ts — the schema as a barrier. The model returns a weekday symbol, never a date, and only catalog IDs.
- src/lib/agent/servicio.ts — the model also returns the service in the customer's own words, so its own ID can be contradicted and corrected.
- tests/ — 177 tests, including the failures found by running it for real.

DISCLOSURE: this project was built and deployed before the challenge window opened and has been developed further throughout September. The commit history is public and dated.
```

> **La última línea es opcional y es tu decisión.** Declararlo tú vale más
> que dejar que lo descubran, pero si lablab confirma en Discord que el
> trabajo previo se permite sin más, sobra. Si la quitas, el campo baja unos
> 200 caracteres y no pasa nada.

---

## Cómo probarlo

*Si hay un campo de instrucciones para el jurado, pega esto. Un jurado que no
consigue probarlo puntúa lo que ve en el vídeo y nada más.*

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
to pre-authorized recipients, so judges cannot message it directly. The web
recorder above runs the identical pipeline — same transcription, same agent,
same database. The video shows the real WhatsApp path.
```

---

## Antes de darle a Enviar

- [ ] **Equipo en «Closed»**. Está en *Open — accepting requests to join*.
      Vas solo; no tiene sentido dejar la puerta abierta a tres semanas del
      cierre.

- [ ] **¿Se permite trabajo previo al 1 de septiembre?** Pregúntalo a los
      **mentores de lablab en Discord** — es el punto 5 de su propia lista.
      Lablab organiza el hackathon y es dueño de las bases; por eso el
      soporte de AssemblyAI no pudo contestarlo. Si aun así no responden, una
      línea honesta en la entrega vale más que el silencio:

      > "The project was built and deployed before the challenge window and
      > has been developed further throughout September; the commit history
      > is public."

- [x] **El vídeo.** ✅ v2 montado y subido: WhatsApp real con el panel al
      lado, en una sola toma. 4:18, 1080p. `https://youtu.be/ti3kfZqFXo0`

- [ ] **La slide 3** lleva un dato de penetración de WhatsApp sin fuente. O
      se cita o se quita.

---

## Números, por si los piden

```
Tests                177
Commits              46, historial público
Licencia             MIT
Países               2 (Venezuela, Brasil)
Idiomas de respuesta 3 (español, portugués, inglés) + respaldo
De voz a cita        ~7 segundos
```
