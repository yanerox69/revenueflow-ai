# Video v2 — con WhatsApp real

El único cambio respecto al video actual es **el demo**. Los audios 1, 2, 4, 5
y 6 sirven tal cual; solo se regraba el 3.

---

## La idea

**WhatsApp Web y el panel en la misma pantalla.** Nada de filmar el teléfono
con otra cámara: todo cabe en una sola grabación de pantalla.

```
┌───────────────────────────┬───────────────────────────┐
│      WhatsApp Web         │     Panel RevenueFlow     │
│      (mitad izquierda)    │     (mitad derecha)       │
└───────────────────────────┴───────────────────────────┘
```

Tú grabas la nota de voz **desde el teléfono**, fuera de cámara. Así:

- no hace falta el micrófono del portátil (que no funciona),
- se ve llegar el audio y la respuesta en tiempo real,
- el panel se actualiza al lado.

---

## Preparación

### La noche antes

- [ ] **WhatsApp Web vinculado** en `web.whatsapp.com`, chat con el
      `+1 555-200-2639` abierto y **con la conversación borrada** (menú del
      chat → Vaciar chat). Un historial con veinte pruebas se ve mal.
- [ ] **Panel abierto** en otra ventana, con sesión iniciada
      (`owner.ve@demo.local` / `demo-Passw0rd!`)
- [ ] Las dos ventanas **lado a lado**, mitad y mitad
- [ ] Zoom del navegador al **110–125 %** en el panel: en video, el texto
      pequeño no se lee
- [ ] Notificaciones silenciadas (Windows, WhatsApp, correo)
- [ ] Modo claro u oscuro, **pero decidido** — no cambies a mitad

### Justo antes de grabar

```bash
cd "C:\Users\Yanero\Desktop\Saas\revenueflow"
npx tsx scripts/limpiar-agenda.mts
```

Y **una pasada de calentamiento**: manda una nota de voz cualquiera, deja que
responda, y vuelve a limpiar la agenda. La primera petición tras un rato
inactivo tarda el doble, y no quieres que sea la del video.

---

## Coreografía del demo

Una sola toma. Sin cortes. Unos 70 segundos.

| Momento | Qué pasa |
|---|---|
| 0:00 | Pantalla quieta: WhatsApp vacío a la izquierda, panel sin citas a la derecha |
| 0:03 | **Mandas la nota de voz #1** desde el teléfono |
| 0:05 | Aparece el audio en WhatsApp Web |
| 0:12 | Llega la respuesta: *"¡Listo! Te agendé Limpieza dental para el jueves…"* |
| 0:15 | **Refrescas el panel** — aparece la cita en «Próximas citas» |
| 0:22 | Pausa de 3 segundos. Que se vea. |
| 0:25 | **Mandas la nota de voz #2**: *«Mejor para el viernes»* |
| 0:32 | Llega: *"¡Listo! Cambié tu Limpieza dental para el viernes…"* |
| 0:35 | **Refrescas el panel** — la cita ahora dice viernes, y sigue habiendo **una sola** |
| 0:42 | Pausa final de 4 segundos |

> **El detalle que hay que dejar ver:** después del reagendado hay **una** cita,
> no dos. Que se aprecie que el horario viejo se liberó.

### Las dos notas de voz

**#1** — *«Hola, buenas tardes. Necesito una cita para una limpieza dental.
¿Tienes algo para el jueves en la tarde?»*

**#2** — *«Mejor para el viernes.»*

La segunda tiene que ser **corta y seca**. Ahí está la gracia: cuatro palabras,
sin repetir el servicio ni la fecha, y el agente sabe de qué hablas.

---

## Audio 3 nuevo

Lo único que hay que regrabar. Unos 55 segundos.

> Esto es RevenueFlow. A la izquierda, WhatsApp. A la derecha, el panel de una
> clínica dental en Venezuela.
>
> Voy a escribirle como lo haría un cliente: con una nota de voz, desde mi
> teléfono.
>
> *(pausa — llega el audio)*
>
> Sin formulario. Sin menú. Sin "marque uno para citas".
>
> *(pausa — llega la respuesta)*
>
> Lo transcribió, entendió que quiere una limpieza dental, resolvió "el jueves
> en la tarde" a una fecha real en hora de Caracas, consultó el calendario, y
> agendó la cita. Menos de diez segundos.
>
> *(pausa — refrescas el panel)*
>
> Ahí está, en el panel del negocio.
>
> Pero lo interesante es lo siguiente.
>
> *(pausa — mandas la segunda nota)*
>
> Cuatro palabras. No repito el servicio, ni la fecha, ni de qué cita hablo.
>
> *(pausa — llega la respuesta)*
>
> Y la movió. Al viernes, a la misma hora que tenía. Porque el agente lee la
> conversación: sabe qué cita es tuya y qué le pediste antes.
>
> Una sola cita en el panel. El horario anterior quedó libre.

---

## Montaje

Igual que el anterior, sustituyendo el tramo del demo:

| Tramo | Audio | Video |
|---|---|---|
| Gancho | Audio 1 | negro + nota de voz sonando |
| Problema | Audio 2 | capturas de WhatsApp |
| **Demo** | **Audio 3 nuevo** | **la toma de WhatsApp Web + panel** |
| Cómo funciona | Audio 4 | diagrama del pipeline |
| Dos países | Audio 5 | los dos paneles |
| Cierre | Audio 6 | URL |

El montaje está en `scripts/montar-video.mts`. Cambiando el fichero de audio y
el del demo, se regenera con un comando.

---

## Tres reglas

**Una sola toma para el demo.** Un corte ahí es la señal universal de truco.

**No repitas si tarda más de lo normal.** El avance por etapas se ve trabajando,
y una espera real convence más que una perfecta.

**Habla despacio.** Cuatro minutos y medio pausados se entienden; cinco
atropellados, no.
