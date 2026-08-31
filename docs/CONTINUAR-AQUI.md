# Continuar aquí

Estado al 31 de agosto de 2026.

---

## Hecho

| | |
|---|---|
| Producto | desplegado y funcionando |
| Repositorio | público, MIT, despliegue continuo |
| Tests | 100, en verde |
| Video | `Desktop\Saas\video\RevenueFlow.mp4` · 3:40 |
| Slides | `Desktop\Saas\video\slides\RevenueFlow-slides.pdf` |
| Límites de uso | activos (protegen los créditos de AssemblyAI) |
| Recordatorios | cron diario configurado |
| WhatsApp — credenciales | **las cuatro cargadas en Vercel y desplegadas** |

## Lo que falta: un solo paso

**Configurar el webhook en Meta.** Sin esto, los mensajes llegan al número de
prueba pero Meta no se los reenvía a la aplicación.

### Dónde

developers.facebook.com → app **RevenueFlow** → **WhatsApp** → **Configuración**
→ sección *Webhook* → **Editar**

### Qué poner

| Campo | Valor |
|---|---|
| **URL de devolución de llamada** | `https://revenueflow-ai-yanero.vercel.app/api/webhooks/whatsapp` |
| **Token de verificación** | `TnW90ZGUlI4Qyo5smFZcKalhr4eOIz` |

Pulsa **Verificar y guardar**. Debe quedar en verde.

### Y el paso que se olvida

En **Campos del webhook**, suscríbete a **`messages`**.

> Sin esa suscripción el webhook queda verde pero Meta no manda nada. Es el
> error más común de toda la configuración.

---

## Probar que funciona

Manda una **nota de voz** desde tu teléfono (`+58 426-2402281`, ya autorizado)
al número de prueba **+1 555-200-2639**.

Después:

```bash
cd "C:\Users\Yanero\Desktop\Saas\revenueflow"
npx tsx scripts/agenda.mts
```

Si la cita aparece, WhatsApp está operativo de punta a punta.

Si no aparece, revisa los registros del despliegue en el panel de Vercel:
busca `[whatsapp]`.

---

## Datos que vas a necesitar

```
App ID                  1557851768653741
Phone number ID         1274501842413975
Número de prueba        +1 555-200-2639
Tu número autorizado    +58 426-2402281
Negocio asociado        Clínica Dental Sonrisa (VE)
```

El token de acceso es **permanente**: no caduca, no hay que regenerarlo.

---

## Pendientes menores

- [ ] Citar la fuente del dato de penetración de WhatsApp en la slide 3,
      o quitar el número.
- [ ] Preguntar a los mentores de lablab si hay problema con que la base
      estuviera construida antes del 1 de septiembre.
- [ ] Vigilar el consumo de créditos de AssemblyAI de vez en cuando.

## Ideas para el mes

- Vertical de restaurantes (WOOKFOOD) — pedidos en vez de citas.
  Es un producto distinto sobre el mismo motor, no un ajuste.
- Panel con las próximas citas y su estado de recordatorio.
