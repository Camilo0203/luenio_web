---
target: portada final de Luenio
total_score: 25
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 2
timestamp: 2026-08-10T03-39-15Z
slug: apps-web-pages-home-index-html
---
# Auditoría final de la portada Luenio

## Salud de diseño

| # | Heurística | Puntaje | Hallazgo principal |
|---|---|---:|---|
| 1 | Visibilidad del estado | 3 | Los selectores muestran estado, pero el cambio de demo no tiene confirmación textual persistente. |
| 2 | Relación con el mundo real | 3 | El lenguaje es directo, aunque “solución digital” y parte de la automatización siguen siendo abstractos. |
| 3 | Control y libertad | 3 | Menú y diálogo se cierran correctamente; en móvil no existe una acción contextual para abrir la demo seleccionada. |
| 4 | Consistencia y estándares | 4 | Tipografía, espaciado, color, botones y temas son coherentes. |
| 5 | Prevención de errores | 3 | La validación es sólida; el texto del CTA no anticipa el formulario previo a WhatsApp. |
| 6 | Reconocer antes que recordar | 3 | Las acciones están etiquetadas, pero el contexto de la demo seleccionada se pierde en móvil. |
| 7 | Flexibilidad y eficiencia | n/a | No aplica a una landing persuasiva. |
| 8 | Diseño estético y minimalista | 3 | La composición es limpia, pero el primer viewport contiene demasiadas rutas simultáneas. |
| 9 | Recuperación de errores | 3 | El formulario explica el error y enfoca el primer campo; el mensaje agrupado podría ser más específico. |
| 10 | Ayuda y documentación | n/a | No aplica a una landing persuasiva. |
| **Total** |  | **25/32** | **Base fuerte; el recorrido de conversión requiere alineación.** |

## Veredicto de especificidad

La portada se siente diseñada para Luenio gracias al marco protagonista de demo, la declaración honesta de que las demos son ficticias y la narrativa Web → WhatsApp → Automatización → Seguimiento. Sin embargo, todavía no es inconfundiblemente Luenio: titulares como “Tu próxima solución digital” y “Diseño que se ve” podrían pertenecer a muchas agencias. La mayor oportunidad no es añadir decoración, sino reemplazar promesas genéricas por evidencia operativa verdadera.

El detector determinista encontró 0 infracciones en `apps/web/pages/home/index.html`. No hubo falsos positivos. La inspección funcional confirmó cambio de tema, selector de demos, estados `aria-pressed`, validación local del formulario y navegación principal. No se pudo producir un overlay fiable porque la superficie de evaluación del navegador es de solo lectura.

## Impresión general

Visualmente está madura y técnicamente bien construida. La oportunidad principal es alinear lo que la página promete con lo que realmente ocurre al tocar los CTA, especialmente en móvil. La calidad percibida ya es alta; la confianza y la continuidad del recorrido todavía pueden subir claramente.

## Lo que funciona

- El hero muestra trabajo visual real sin parecer un dashboard SaaS genérico.
- La adaptación móvil mantiene legibilidad, acciones táctiles amplias y jerarquía.
- La transparencia sobre demos ficticias, los focos visibles, `prefers-reduced-motion`, elementos semánticos y estados de formulario son buenas decisiones.

## Problemas prioritarios

### [P1] El recorrido persuasivo se invierte y se rompe parcialmente en móvil

La exploración de demos es la prueba principal, pero “Solicitar cotización” recibe la máxima prominencia antes de que el visitante obtenga confianza. En móvil se oculta “Abrir demo”; los botones de sector cambian la captura, pero no ofrecen una acción contextual para abrir la selección.

**Corrección:** mantener visible “Abrir demo de [sector]” debajo del selector móvil o convertir la previsualización en un enlace claramente etiquetado. Definir una única acción dominante según el objetivo comercial elegido.

### [P1] La honestidad sobre demos ficticias no se acompaña de prueba operativa

Después del aviso honesto, la página vuelve a afirmaciones generales. Faltan artefactos verificables que reduzcan el riesgo sin inventar testimonios ni métricas.

**Corrección:** mostrar un recorrido anotado demo → lead → seguimiento, entregables de ejemplo, resultado exacto de la primera conversación, límites de implementación o términos reales de soporte y propiedad.

### [P2] “Escribir por WhatsApp” oculta un paso de calificación

El botón abre un formulario interno obligatorio antes de WhatsApp. El diálogo está bien resuelto, pero la etiqueta promete inmediatez.

**Corrección:** renombrar a “Preparar mensaje para WhatsApp” y anticipar “3 datos, menos de un minuto”, o reducir el formulario.

### [P2] El feedback del selector de demos es principalmente visual

Los estados accesibles existen, pero no hay una leyenda visible/viva que anuncie “Mostrando demo ficticia de Ecommerce”, ni un destino móvil actualizado.

**Corrección:** añadir una leyenda de estado y una acción vinculada a la demo seleccionada.

### [P2] Demasiadas rutas compiten en el primer viewport

Navegación, tema, dos CTA, abrir demo, tres sectores y catálogo completo aparecen antes de que el visitante decida si Luenio es relevante.

**Corrección:** conservar una decisión dominante, reducir el peso visual del acceso/tema y presentar el catálogo completo después de la primera interacción.

## Alertas por persona

- **Jordan, visitante nuevo:** entiende la oferta, pero recibe una solicitud de cotización antes de suficiente prueba; el botón de WhatsApp abre un paso inesperado.
- **Riley, comprador desconfiado:** valora la transparencia de las demos, pero no encuentra una segunda evidencia concreta sobre entregables, tiempos de respuesta o resultado del primer contacto.
- **Casey, usuario móvil distraído:** puede cambiar de sector, pero no abrir directamente la demo elegida. En una página larga, los puntos de conversión quedan separados.

## Observaciones menores

- Los temas claro y oscuro están bien diseñados.
- El efecto de escritura puede mostrar palabras incompletas durante una lectura rápida, aunque el H1 accesible permanece completo.
- Conviene comprobar que el menú móvil realmente inertiza el fondo además de ocultarlo visualmente.
- El enlace “Acceso clientes” tiene una discrepancia entre el atributo `hidden` aplicado por JavaScript y una regla CSS que fuerza `display:flex`.

## Preguntas de producto

- Si explorar demos es el éxito principal, ¿por qué cotizar domina antes de que el visitante explore?
- ¿Qué artefacto verdadero demuestra “hecho a medida” mejor que otra promesa?
- ¿WhatsApp debe significar conversación inmediata o la calificación previa es realmente el primer paso?
