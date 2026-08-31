# Continuar aquí

Estado al 31 de agosto de 2026.

---

## Funcionando

| | |
|---|---|
| Producto | desplegado y público |
| **WhatsApp real** | **✅ de punta a punta, verificado en el teléfono** |
| Repositorio | público, MIT, despliegue continuo |
| Tests | 100, en verde |
| Video | `Desktop\Saas\video\RevenueFlow.mp4` · 3:40 |
| Slides | `Desktop\Saas\video\slides\RevenueFlow-slides.pdf` |
| Límites de uso | activos |
| Recordatorios | cron diario |
| Token de Vercel | renovado, sin caducidad |

### El circuito completo

```
nota de voz por WhatsApp → Meta → webhook → AssemblyAI
  → intención → calendario real → cita agendada
  → confirmación de vuelta al WhatsApp del cliente
```

**7 segundos.** Sin intervención humana.

---

## ⚠️ Fecha límite: ~24 de septiembre

El contador de lablab pasó de 25 a 24 días entre el 30 y el 31 de agosto.
La entrega **no es el 30 de septiembre**: es alrededor del **24**.

---

## Pendientes

- [ ] **Preguntar a los mentores** si hay problema con que la base estuviera
      construida antes del 1 de septiembre. Es la única incógnita que puede
      invalidar la entrega. Lleva dos días sin resolverse.
- [ ] Crear el canal del equipo en Discord (paso 3 del checklist).
- [ ] Citar la fuente del dato de penetración de WhatsApp en la slide 3,
      o quitar el número.
- [ ] Vigilar el consumo de créditos de AssemblyAI.

## Lo que más sumaría ahora

**Rehacer el video con WhatsApp real.** Grabar la pantalla del teléfono
mandando la nota de voz y el panel actualizándose al lado. Deja de ser "subo
un archivo" y pasa a ser el producto funcionando como lo usaría un cliente.
Los seis audios de narración sirven tal cual.

## Ideas para el resto del mes

- Vertical de restaurantes (WOOKFOOD): pedidos en vez de citas. Es un producto
  distinto sobre el mismo motor, no un ajuste.
- Panel con las próximas citas y su estado de recordatorio.

---

## Datos de referencia

```
App ID                  1557851768653741
Phone number ID         1274501842413975
WABA ID                 1079056921727722
Número de prueba        +1 555-200-2639
Número autorizado       +58 426-2402281
Negocio asociado        Clínica Dental Sonrisa (VE)
PIN de 2FA              en .env.local (WHATSAPP_2FA_PIN)
```

El token de acceso de Meta es permanente.

## Scripts útiles

```bash
npx tsx scripts/diagnostico-whatsapp.mts   # rastrea los últimos mensajes
npx tsx scripts/agenda.mts                 # citas próximas por negocio
npx tsx scripts/limpiar-agenda.mts         # libera horarios sin perder sesión
npx tsx scripts/vercel-status.mts          # estado de despliegues
```
