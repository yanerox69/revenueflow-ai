# Continuar aquí

Estado al 31 de agosto de 2026.

---

## Funcionando y verificado en producción

| | |
|---|---|
| Producto | desplegado y público |
| **WhatsApp real** | notas de voz **y** mensajes escritos |
| **Memoria de conversación** | "mejor el viernes" reagenda la cita correcta |
| **Panel** | citas, conversaciones, confirmaciones y cierre de citas |
| Repositorio | público, MIT, despliegue continuo |
| Tests | **130** |
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

## Pendientes

- [ ] **Hablar con los mentores** en el Discord general de lablab (el canal de
      equipo necesita 2 miembros, así que no se puede crear yendo solo).
      Preguntar si hay problema con que la base estuviera construida antes del
      1 de septiembre. **Es lo único que puede invalidar la entrega.**
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

## Scripts

```bash
npx tsx scripts/diagnostico-whatsapp.mts   # rastrea los últimos mensajes
npx tsx scripts/agenda.mts                 # citas próximas por negocio
npx tsx scripts/limpiar-agenda.mts         # libera horarios sin perder sesión
npx tsx scripts/probar-intencion.mts "…"   # depura el agente sin mandar audio
npx tsx scripts/vercel-deploy.mts          # despliega desde GitHub
npx tsx scripts/vercel-status.mts          # estado de despliegues
```

> Los tests que salen a la red reintentan dos veces: la conexión de esta red
> corta de vez en cuando y un rojo intermitente no es un fallo real.
