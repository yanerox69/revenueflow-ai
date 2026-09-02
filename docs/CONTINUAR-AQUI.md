# Continuar aquí

Estado al 31 de agosto de 2026.

---

## Funcionando y verificado en producción

| | |
|---|---|
| Producto | desplegado y público |
| **WhatsApp real** | notas de voz **y** mensajes escritos |
| **Memoria de conversación** | "mejor el viernes" reagenda la cita correcta |
| **Idioma del cliente** | responde en es / pt / en, no en el del país |
| **Panel** | citas, conversaciones, confirmaciones y cierre de citas |
| Repositorio | público, MIT, despliegue continuo |
| Tests | **169** |
| Video | `Desktop\Saas\video\RevenueFlow.mp4` · 3:40 |
| Slides | `Desktop\Saas\video\slides\RevenueFlow-slides.pdf` |
| Límites de uso | activos |
| Recordatorios | cron diario |

### Lo que hace el agente

```
nota de voz o texto por WhatsApp
  → transcripción (si es audio) → intención con historial
  → agendar · reagendar · confirmar · cancelar
  → respuesta al cliente en su idioma
                                              ~7 segundos
```

Y si no entiende, si es una queja o si es de dinero: **escala a una persona
y se detiene.**

### El idioma lo pone el cliente

Responde en **español, portugués o inglés**, según cómo le escriban — no
según el país del negocio. Probado con cinco idiomas contra el agente real:

| Cliente habla en | Responde en | Agenda | Probado con |
|---|---|---|---|
| portugués | portugués, fecha en portugués, 24 h | sí | **audio** (99,5 %) y texto |
| inglés | inglés | sí | **audio** (99,7 %) y texto |
| español | español venezolano | sí | audio y texto |
| **ruso** | español | **sí** | texto |
| **mandarín** | español | **sí** | texto |

Las notas de voz de prueba se generan con
`scripts/generar-nota-voz.ps1 -Idioma pt-BR -Texto "…"`. Usa WinRT y no
System.Speech, que solo ve un subconjunto de las voces instaladas.

Los dos últimos son el caso importante: entender no depende de saber
responder. Se transcribe y se agenda igual, y la respuesta sale en el idioma
del país porque **no se traducen las plantillas con el modelo** — llevan
fecha y hora exactas, y ahí una alucinación es una cita perdida.

> El modelo etiquetó un mensaje en chino como inglés. Por eso hay una
> comprobación de escritura que lo desmiente: si el texto está en otro
> alfabeto, no está en ninguno de los tres, diga lo que diga el modelo.

### Dos veces eligió mal el servicio

Pidiendo *limpeza dental* reservó **Blanqueamiento**; en otra corrida,
*Consulta de valoración*. El id era válido y existía en el catálogo — solo
estaba mal. Es el fallo más caro que puede tener esto: alguien pide una
limpieza y le reservan otra cosa.

El modelo devuelve ahora **también el nombre** del servicio, con las palabras
del cliente. Un UUID solo no se puede contrastar; dos respuestas sobre lo
mismo sí se contradicen:

```
id  a5832c80…  → catálogo dice "Blanqueamiento"
nombre         → "limpeza dental"
                        ↕ no concuerdan → gana el nombre
```

Gana el nombre porque está anclado en lo que dijo el cliente. Si el nombre no
distingue nada («una cita»), se conserva el id: cambiar un error por otro no
es mejorar.

```bash
npx tsx scripts/probar-idiomas.mts
```

---

## Los dos hackathons

| | **AssemblyAI** | **WeAreDevelopers** |
|---|---|---|
| Entrega | **~29-30 de septiembre** | 24 de septiembre, 5 p. m. PDT |
| Reto | conocido: agentes de voz | **sin anunciar hasta el 18 sept** |
| Premio | $10.000 · 5 ganadores | por confirmar |
| Encaje | perfecto | se sabrá el día 18 |

**El de AssemblyAI es la apuesta principal.** El otro, si el 18 de septiembre
el reto encaja, se presenta lo mismo con otro enfoque.

---

## ⏰ Fechas exactas (hora de Venezuela)

```
Sep  1, 11:00 a. m.   Kick-off AssemblyAI
Sep  1, 12:00 p. m.   Q&A en Discord   ← preguntar aquí lo del trabajo previo
Sep 18, 11:00 a. m.   Se revela el reto de WeAreDevelopers
Sep 24,  8:00 p. m.   Cierre WeAreDevelopers
Sep 30, 11:00 a. m.   CIERRE AssemblyAI  ← POR LA MAÑANA, no fin del día
```

> El cierre de AssemblyAI es a las **11 de la mañana** del 30. Planificar
> "entrego el 30" deja fuera. Trabajar con el **29** como fecha real.

## Pendientes

- [ ] **¿Se permite trabajo previo al 1 de septiembre?** Es lo único que puede
      invalidar la entrega. Preguntado por dos vías:

      - ✅ **Correo a support de AssemblyAI**, 1 sep 17:10, desde
        `yanerox69@gmail.com`, respondiendo al correo de Zack Klebanoff
        (Applied AI Lead). *Sin respuesta todavía.*
      - [ ] **Q&A en Discord** — es el canal que de verdad decide. Support
        conoce la API, no necesariamente las bases del concurso.

      > "My project was already built and deployed before Sept 1. I'll keep
      > developing it during the month. Is prior work allowed, or does
      > everything have to be built inside the window?"
- [ ] Rehacer el video con WhatsApp real: teléfono mandando notas y el panel
      actualizándose, incluida la conversación con el reagendado.
- [ ] Citar la fuente del dato de WhatsApp en la slide 3, o quitarlo.
- [ ] Vigilar el consumo de créditos de AssemblyAI.

## Ideas si sobra tiempo

- Tasa de asistencia en el panel, ahora que las citas se cierran.
- Vertical de restaurantes (WOOKFOOD): pedidos en vez de citas. Producto
  distinto sobre el mismo motor, no un ajuste.
- Tomar el control de una conversación desde el panel (el modo IA/humano ya
  está en la base, falta el botón).

---

## Datos de referencia

```
App ID (Meta)           1557851768653741
Phone number ID         1274501842413975
WABA ID                 1079056921727722
Número de prueba        +1 555-200-2639
Número autorizado       +58 426-2402281
Negocio asociado        Clínica Dental Sonrisa (VE)
```

Tokens de Meta y Vercel: permanentes, no caducan.

> **La clave de AssemblyAI cambió el 1 de septiembre.** La anterior era de
> una cuenta vieja que quedó deshabilitada, y devolvía `409 Your account is
> disabled` en transcripción y `401` en el Gateway — mientras el panel de la
> cuenta buena se veía perfectamente. La pista era el crédito: $49.97 de $50
> sin tocar, con decenas de transcripciones hechas. **El consumo no salía de
> esa cuenta.** Si vuelve a pasar, `probar-assemblyai.mts` lo dice en cinco
> segundos, y hay que mirar de qué cuenta es la clave, no si la cuenta va.

## Scripts

```bash
npx tsx scripts/probar-assemblyai.mts      # ¿va la clave? transcripción y Gateway
npx tsx scripts/probar-idiomas.mts         # los cinco idiomas contra el agente real
npx tsx scripts/exportar-conversacion.mts  # vuelca la conversación a Markdown
npx tsx scripts/diagnostico-whatsapp.mts   # rastrea los últimos mensajes
npx tsx scripts/agenda.mts                 # citas próximas por negocio
npx tsx scripts/limpiar-agenda.mts         # libera horarios sin perder sesión
npx tsx scripts/probar-intencion.mts "…"   # depura el agente sin mandar audio
npx tsx scripts/vercel-deploy.mts          # despliega desde GitHub
npx tsx scripts/vercel-status.mts          # estado de despliegues
```

> Los tests que salen a la red reintentan dos veces: la conexión de esta red
> corta de vez en cuando y un rojo intermitente no es un fallo real.
