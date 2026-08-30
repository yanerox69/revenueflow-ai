# Presentación — RevenueFlow
### Máximo 10 slides · se entregan junto al video

> Regla: **una idea por slide**. Si una slide necesita explicación, va sobrando.
> El jurado las hojea en dos minutos.

---

## 1 · Portada

**RevenueFlow**
*The reception desk that listens.*

Voice-first WhatsApp reception for Latin American small businesses.
Built on AssemblyAI.

`revenueflow-ai-yanero.vercel.app` · `github.com/yanerox69/revenueflow-ai`

---

## 2 · El problema

> **In Latin America, customers don't type. They talk.**

Una captura de WhatsApp con tres notas de voz sin abrir, a las 8:47 p. m.

Pie: *Every CRM shows this as "audio message". A human has to listen.*

---

## 3 · Por qué ahora

Tres datos, grandes, sin párrafos:

- **+90%** de penetración de WhatsApp en LatAm
- **0** herramientas del mercado que procesen notas de voz de verdad
- **1** persona atendiendo el teléfono en el negocio típico

> Cita la fuente del 90% en letra pequeña. Un dato sin fuente resta.

---

## 4 · La solución

El pipeline en una línea, visual:

```
🎙 voz  →  transcripción  →  intención  →  disponibilidad real  →  ✅ cita
                                                              < 10 s
```

Pie: *No forms. No menus. No "press one for appointments".*

---

## 5 · Demo

Una captura del panel con la cita agendada, la transcripción y la respuesta
al cliente visibles.

> **Jueves, 3 de septiembre, 1:00 p. m. — Limpieza dental**
> Agendada sin intervención humana.

---

## 6 · Cómo usamos AssemblyAI

| Pieza | Para qué |
|---|---|
| **Universal-3.5 Pro** | Español y portugués, 99% de confianza |
| **`keyterms_prompt`** | Sesgado con el catálogo real del negocio |
| **`prompt`** | Describe la escena: cliente, vertical, país |
| **LLM Gateway** | Extracción de intención con esquema |

Una llave, un proveedor, todo el pipeline.

---

## 7 · La decisión de arquitectura

> ### El modelo decide **qué quiere** el cliente.
> ### El sistema decide **qué se puede hacer**.

No puede inventar un servicio → solo elige del catálogo
No puede inventar una fecha → devuelve el día, el sistema calcula
No puede inventar disponibilidad → el hueco sale de la base

Ante una queja, un pago o una duda: **escala a un humano y se detiene.**

---

## 8 · Multipaís desde la primera línea

Dos capturas lado a lado, mismo código:

| Venezuela | Brasil |
|---|---|
| `Bs. 1.845,00 ≈ $37,50 · BCV 49,20` | `R$ 349,90` |
| es-VE · RIF · Caracas | pt-BR · CNPJ · São Paulo |

> Agregar un país es **escribir un archivo**, no reconstruir el producto.
> Un test falla si algún archivo del núcleo codifica un país a mano.

---

## 9 · Listo para producción, no un prototipo

- **84 tests**, incluido aislamiento entre inquilinos verificado contra la base
- **RLS** en todas las tablas — auditado automáticamente
- **Idempotencia** en la ingesta: WhatsApp reintenta, no se cobra dos veces
- **Medición de audio por segundo** — a $30/mes el margen se decide ahí
- Desplegado, público y con despliegue continuo

---

## 10 · Qué sigue

**Ahora:** números de WhatsApp reales conectados
**Después:** recordatorios que recuperan no-shows automáticamente
**Luego:** Colombia, México y Perú — un archivo cada uno

> *Latin America runs on voice notes.
> RevenueFlow is the first reception desk that actually listens.*

---

## Notas de diseño

- **Fondo oscuro**, igual que el producto. Coherencia visual.
- Tipografía **Plus Jakarta Sans** (la misma de la app).
- Azul `#2563EB` para lo estructural, naranja `#EA580C` **solo** para lo que
  quieres que miren. Si todo destaca, nada destaca.
- **Capturas reales del producto**, nunca mockups. Se nota, y resta.
- Nada de texto a menos de 18 pt: se juzga en pantallas pequeñas.
