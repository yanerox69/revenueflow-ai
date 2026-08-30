# Teleprónter — versión en español

Solo las líneas que dices. Lo que va entre `[ ]` es acción, no se lee.

Objetivo: **4:30**. Habla despacio.

> Si narras en español, **pon subtítulos en inglés**. El jurado de lablab.ai
> es internacional.

---

## 1 · GANCHO · 0:00

`[Pantalla en negro. Suena tu nota de voz de WhatsApp completa.]`

`[Cuando termina el audio:]`

Así suena un cliente en Latinoamérica.

No es un formulario. No es un correo. Es una nota de voz de WhatsApp, mandada
de noche, cuando la clínica ya cerró y nadie la va a escuchar hasta mañana.

`[Aparece el logo]`

Para entonces, ese cliente ya pidió cita en otro lado.

---

## 2 · EL PROBLEMA · 0:25

`[Capturas de WhatsApp con notas de voz sin abrir]`

En Latinoamérica, WhatsApp no es un canal. Es el teléfono.

Los negocios pequeños operan enteros ahí adentro. Clínicas dentales,
peluquerías, talleres, veterinarias.

Y esto es lo que todas las herramientas hechas para ellos no entienden: sus
clientes no escriben. Hablan.

Los CRM que existen ven una nota de voz y muestran un recuadro gris que dice
"mensaje de audio". Igual tiene que venir una persona a escucharlo, entenderlo,
abrir un calendario y responder.

Así que no pasa nada hasta que alguien se desocupe. Y en este negocio, nadie se
desocupa nunca.

---

## 3 · DEMO · 0:55

`[Panel abierto, sesión iniciada. UNA SOLA TOMA, SIN CORTES.]`

Esto es RevenueFlow. Estoy dentro como una clínica dental en Venezuela.

`[Pulsas "sube un audio de WhatsApp" → DEMO-jueves-tarde.ogg]`

Esta es una nota de voz real de WhatsApp. La grabé con mi teléfono, igual que
la mandaría cualquier cliente.

`[Corren las etapas. No las describas — se ven. Usa el tiempo:]`

Sin formulario. Sin menú. Sin "marque uno para citas". Simplemente alguien
hablando, como ya habla.

`[Aparece la transcripción, ~6 s:]`

Ahí está la transcripción. En español, con puntuación, noventa y nueve por
ciento de confianza. Eso es Universal-3.5 Pro, de AssemblyAI.

Pero transcribir es la parte fácil. Miren lo que pasa ahora.

`[Aparece la cita agendada:]`

Entendió que el cliente quiere una limpieza dental. Un servicio real, del
catálogo de esta clínica.

Resolvió "el jueves en la tarde" a una fecha concreta, en hora de Caracas.

Consultó el calendario real, encontró el próximo hueco libre, y la agendó.

`[Señalas la burbuja de respuesta]`

Y le respondió al cliente, en su idioma.

Menos de diez segundos. Nadie tocó nada.

---

## 4 · CÓMO FUNCIONA · 2:40

`[Diagrama del pipeline]`

Todo esto corre sobre AssemblyAI. Universal-3.5 Pro para la voz, y su LLM
Gateway para entender. Una sola llave.

Un detalle que cambió mucho las cosas: no mandamos solo el audio. Mandamos el
catálogo de servicios de la propia clínica como términos clave. El modelo
escucha sesgado hacia las palabras exactas que le importan a este negocio.

`[Resaltas la frase]`

Y aquí está la decisión sobre la que se apoya todo el producto:

El modelo decide qué quiere el cliente. El sistema decide qué se puede hacer.

No puede inventar un servicio: solo puede elegir del catálogo.

No puede inventar una fecha: devuelve un día de la semana, y nuestro código
calcula la fecha real en el huso del negocio.

No puede inventar disponibilidad: el hueco sale de la base de datos.

Y si no está seguro, o es una queja, o es un tema de dinero, escala a una
persona y se detiene.

Esa es la diferencia entre un chatbot y algo que un negocio real puede poner
frente a sus clientes.

---

## 5 · VALOR DE NEGOCIO · 3:40

`[Panel con métricas]`

¿Quién paga por esto? Clínicas dentales y de estética, peluquerías, talleres,
veterinarias. Negocios donde una cita perdida cuesta dinero de verdad, y donde
el dueño es el que contesta el teléfono.

Las herramientas que les ofrecen hoy están hechas para otro mundo. SMS en vez
de WhatsApp. Pasarelas de pago que no operan en su país. Precios en dólares que
localmente no tienen sentido.

RevenueFlow es multipaís desde la primera línea de código. Venezuela y Brasil
hoy.

`[Venezuela y Brasil lado a lado]`

El mismo motor. El negocio venezolano ve bolívares, con la tasa del día. El
brasileño ve reales. El agente le habla español a uno y portugués al otro.

Agregar un país es escribir un archivo. No reconstruir el producto.

---

## 6 · CIERRE · 4:30

`[La URL en grande]`

Todo lo que acaban de ver está en línea y es público. Código abierto, licencia
MIT.

Es multi-inquilino, con aislamiento a nivel de fila verificado por tests. Y
cada segundo de audio se mide, porque a treinta dólares al mes no hay margen
para quemar tokens.

Lo que sigue es conectar números de WhatsApp reales, y recordatorios que
recuperan las citas perdidas solos.

Latinoamérica funciona con notas de voz.

RevenueFlow es la primera recepción que de verdad escucha.

`[Pantalla final: URL + repositorio]`

---

## Antes de darle a grabar

- [ ] `npx tsx scripts/limpiar-agenda.mts` — libera los horarios
- [ ] Panel abierto en la pantalla del demo
- [ ] `DEMO-jueves-tarde.ogg` a mano en el diálogo de archivos
- [ ] Notificaciones silenciadas (Windows, WhatsApp, correo)
- [ ] Prueba de sonido: graba 10 segundos y escúchate

## Tres reglas

**Habla despacio.** 4:30 pausado se entiende; 5:00 atropellado, no.

**No repitas si el agente tarda más de lo normal.** Una espera real convence
más que una perfecta.

**Si algo falla, repite el video entero.** No pegues trozos: un corte en el
demo es la señal universal de que está trucado.
