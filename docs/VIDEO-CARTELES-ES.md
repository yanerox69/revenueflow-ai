# Carteles del video — en español

Video **sin narración**. Nadie habla: el único audio hablado es la nota de voz
del cliente. Todo lo demás son estos carteles sobre las grabaciones.

> **Opción bilingüe:** cartel en español grande, y debajo pequeña y en gris la
> línea en inglés. El jurado de lablab.ai es internacional. Tú decides.

**Duración objetivo: 3:15.**

---

## Reglas

- Máximo **8 palabras** por cartel. Si no cabe, son dos.
- **2,5 s** por línea corta · **4 s** si son dos líneas.
- Fuente **Plus Jakarta Sans**. Bold solo en lo importante.
- Fondo `#0B1220` · texto `#E2E8F0` · resaltados `#EA580C`
- Fundido de 0,3 s. Sin animaciones llamativas.

---

## GANCHO · 0:00 → 0:28
*(se monta, no se graba)*

Pantalla negra. Suena `DEMO-jueves-tarde.ogg` completo (14 s) con subtítulo de
lo que dice. Luego, sobre negro:

```
Eso era un cliente.

Mandado a las 8 de la noche. Nadie lo oyó.

Para la mañana, ya pidió cita en otro lado.
```

`[Logo RevenueFlow]`

---

## EL PROBLEMA · 0:28 → 0:52
*(sobre la PIEZA 2 — WhatsApp con audios sin abrir)*

```
En Latinoamérica, WhatsApp no es un canal.

Es el teléfono.

Los clientes no escriben. Hablan.

Todo CRM muestra esto como un recuadro gris.

Alguien tiene que escucharlo, entenderlo y responder.

Y nadie se desocupa nunca.
```

---

## DEMO · 0:52 → 1:55
*(sobre la PIEZA 1 — toma continua de pantalla)*

| Momento | Cartel |
|---|---|
| Al empezar | `Una clínica dental en Venezuela.` |
| Al pulsar subir | `Una nota de voz real de WhatsApp.` |
| Procesando | *(sin cartel)* |
| Transcripción | `AssemblyAI · Universal-3.5 Pro` |
| | `99% de confianza. En español. Con puntuación.` |
| Antes de la cita | `Transcribir es la parte fácil.` |
| **La cita** | **`Agendó la cita.`** |
| Servicio | `Un servicio real del catálogo de la clínica` |
| Fecha | `"El jueves en la tarde" → fecha real, hora de Caracas` |
| Hora | `El próximo hueco libre del calendario` |
| Respuesta | `Y le respondió al cliente, en su idioma.` |
| Final | **`Menos de 10 segundos. Nadie tocó nada.`** |
| | *(3 s en silencio — no lo recortes)* |

---

## CÓMO FUNCIONA · 1:55 → 2:35
*(sobre la PIEZA 5 — diagrama)*

```
voz  →  AssemblyAI  →  LLM Gateway  →  reglas del negocio  →  ✅ cita
```

```
Una sola llave. Un solo proveedor.

Mandamos el catálogo de la clínica como términos clave.

El modelo escucha sesgado hacia lo que importa aquí.
```

Pantalla completa, fondo oscuro:

```
El modelo decide qué quiere el cliente.
El sistema decide qué se puede hacer.
```

Tres líneas, una a una:

```
No puede inventar un servicio.
No puede inventar una fecha.
No puede inventar disponibilidad.

Si es una queja o un pago → escala a una persona.
```

---

## DOS PAÍSES · 2:35 → 2:58
*(PIEZAS 3 y 4 en pantalla partida)*

```
El mismo motor. Dos países.

Venezuela: bolívares, con la tasa del día

Brasil: reales

Español a uno. Portugués al otro.

Agregar un país es escribir un archivo.
```

---

## CIERRE · 2:58 → 3:15

```
En línea. Público. Código abierto, MIT.

84 tests · aislamiento entre negocios verificado

Cada segundo de audio se mide.
```

`[Logo + URL grandes]`

```
revenueflow-ai-yanero.vercel.app

La primera recepción que de verdad escucha.
```

---

## Las cinco grabaciones

| # | Qué | Tipo |
|---|---|---|
| 1 | Demo del panel, toma continua sin audio | video ~40 s |
| 2 | WhatsApp con notas de voz sin abrir | captura |
| 3 | Panel de Venezuela (`owner.ve@demo.local`) | captura |
| 4 | Panel de Brasil (`owner.br@demo.local`) | captura |
| 5 | Diagrama del pipeline | se hace en el editor |

Antes de grabar la pieza 1:

```bash
npx tsx scripts/limpiar-agenda.mts
```

---

## Errores que hunden un video sin narración

- **Cartel que dura poco.** Si tú lo lees justo, el jurado no llega.
  Súmale medio segundo a cada uno.
- **Dos ideas en un cartel.** Una y solo una.
- **Música alta.** Compite con el único audio que importa.
- **Cortes en el demo.** Se lee como truco.
