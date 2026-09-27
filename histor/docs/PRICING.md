# Precios y modelo de negocio

## Modelo

**Freemium.** Todas las noticias verificadas son gratuitas: la verdad no va
detrás de un muro de pago. Premium se paga por la comodidad y la profundidad:

| Gratis | Premium |
|---|---|
| Todas las noticias verificadas | Sin publicidad |
| Newsletter diaria de tu edición | Alertas de última hora a tu medida |
| Publicidad no invasiva (solo con consentimiento) | Newsletters locales y temáticas premium (p. ej. *Berlin Daily*, *Markets Brief*) |
| | Seguimiento de temas, empresas, equipos y ciudades |
| | Archivo completo y análisis · Personalización avanzada |

## Precios iniciales por mercado

Referencia de mercado consultada: El País Premium (15 €/mes, 144 €/año), The
New York Times Basic (16 $/mes) y All Access (25 $/mes). Histor se sitúa por
debajo porque no restringe las noticias, y ajusta por poder adquisitivo.

| Mercado | Países | Mensual | Anual | Prueba |
|---|---|---|---|---|
| ES | España | 5,99 € | 54 € | 14 días |
| PT | Portugal | 4,99 € | 45 € | 14 días |
| EUROZONE | resto de la eurozona | 6,99 € | 63 € | 14 días |
| GB | Reino Unido | £5.99 | £54 | 14 días |
| CH | Suiza, Liechtenstein | CHF 8.90 | CHF 80 | 14 días |
| US | Estados Unidos | $7.99 | $72 | 14 días |
| CA | Canadá | C$8.99 | C$81 | 14 días |
| MX | México | MXN 79 | MXN 710 | 7 días |
| BR | Brasil | R$ 19,90 | R$ 179 | 7 días |
| CO | Colombia | COP 14.900 | COP 134.000 | 7 días |
| CL | Chile | CLP 3.990 | CLP 35.900 | 7 días |
| AR | Argentina, Venezuela (en USD por la inflación) | US$2.99 | US$27 | 7 días |
| JP | Japón | ¥980 | ¥8,800 | 14 días |
| WORLD | resto del mundo (por defecto) | US$5.99 | US$54 | 7 días |

El plan anual ahorra en torno a un 25 %. La prueba gratuita solo se ofrece a
quien no ha tenido suscripción antes.

## Cómo se cambian

Panel → **Precios**: importes (en la unidad mínima × 100; ¥980 = 98000), días de
prueba, activar/desactivar y, opcionalmente, los *Price ID* de Stripe. Cada
cambio queda en la auditoría con el valor anterior. Sin *Price ID*, Checkout crea
el precio al vuelo (`price_data`); con él, se usa el de Stripe (recomendado para
informes y cupones).

El mercado se elige por la edición del lector (cookie o cuenta) o, si no, por el
país que indica la CDN. Los impuestos se calculan con Stripe Tax
(`STRIPE_AUTOMATIC_TAX=1`) y los precios se muestran con impuestos incluidos
(`tax_behavior: inclusive`).

## Cobro

- Stripe Checkout y Customer Portal: Histor nunca ve ni guarda datos de tarjeta.
- Webhooks idempotentes: `checkout.session.completed`,
  `customer.subscription.created|updated|deleted`, `invoice.paid`,
  `invoice.payment_failed`.
- Pago fallido: Stripe reintenta; el lector conserva el acceso 7 días en
  `past_due` y recibe los avisos de Stripe; después pierde Premium.
- Cancelación en cualquier momento desde «Mi cuenta → Gestionar suscripción».
- Borrar la cuenta cancela antes las suscripciones activas.

## Otras fuentes de ingresos (preparadas, no activas)

- Publicidad no invasiva solo para usuarios gratuitos y con consentimiento de
  publicidad (categoría «marketing» del banner, desactivada por defecto).
- Newsletters patrocinadas, claramente rotuladas.
- Licencias de la API de noticias verificadas para empresas.

Los experimentos de precio solo pueden probar valores aprobados en el panel.
