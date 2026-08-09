---
target: cinco landings por industria en escritorio y móvil
total_score: 20
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 2
timestamp: 2026-07-27T04-24-02Z
slug: apps-web-src-industry-demos-css
---
# Revisión de las cinco landings por industria

## Design Health Score

| # | Heurística | Puntaje | Hallazgo principal |
|---|---|---:|---|
| 1 | Visibilidad del estado | 3 | Los ejercicios y formularios tienen infraestructura de estado, aunque no toda se probó manualmente. |
| 2 | Relación con el mundo real | 3 | El lenguaje y las imágenes conectan bien con cada sector; parte del copy de agencias sigue siendo abstracto. |
| 3 | Control y libertad | 2 | Hay navegación, FAQ y menús claros, pero WhatsApp y algunos ejercicios compiten con la salida principal. |
| 4 | Consistencia y estándares | 3 | Buen sistema compartido; la estructura se repite más de lo deseable entre industrias. |
| 5 | Prevención de errores | 2 | Los controles nativos ayudan, pero la recuperación de formularios no se recorrió por completo. |
| 6 | Reconocimiento sobre memoria | 3 | Acciones y opciones están etiquetadas y visibles. |
| 7 | Flexibilidad y eficiencia | n/a | No es determinante en una landing de persuasión. |
| 8 | Diseño estético y minimalista | 2 | Dirección visual fuerte, pero páginas demasiado largas y con colisiones en móvil. |
| 9 | Reconocer y recuperarse de errores | 2 | Existe UI de estado, pero la recuperación completa no fue ejercitada. |
| 10 | Ayuda y documentación | n/a | No es necesaria para este tipo de superficie; el FAQ cubre objeciones comerciales. |
| **Total** |  | **20/32** | **Aceptable; buena base visual con problemas de conversión y responsive.** |

## Veredicto de especificidad

Las cinco landings se sienten diseñadas y no generadas desde una plantilla visual genérica. Gym es la más específica: lenguaje de tablero operativo, composición, tipografía e interacción pertenecen al contexto fitness. Agencias, ecommerce, inmobiliarias y restaurantes también tienen mundos visuales reconocibles.

La debilidad está en la arquitectura repetida: encabezado, hero con selector, tarjetas, métricas, proceso, planes/prueba, FAQ, formulario y footer. El resultado es **visualmente específico pero estructuralmente compartido**.

El detector produjo 8 warnings: cinco fuentes fuera de `DESIGN.md`, dos usos de fuentes sobreutilizadas y un aviso de tipografía única en ecommerce. Las fuentes distintas son mayormente adiciones intencionales para cada marca; el aviso de ecommerce sí coincide parcialmente con una jerarquía menos distintiva.

## Impresión general

El primer impacto es fuerte y profesional. El mayor salto de calidad no está en agregar más diseño, sino en eliminar colisiones móviles, reducir longitud y convertir la promesa de cada industria en un recorrido comercial más propio.

## Qué funciona

- Cada landing tiene una identidad visual clara; Gym destaca como la más memorable y coherente.
- Los heroes comunican rápidamente categoría, tono y propuesta.
- La base responsive no presenta overflow horizontal y mantiene controles, menús y tipografía legibles.

## Problemas prioritarios

### [P1] Colisiones y recortes visibles en móvil

En ecommerce el titular “Potencia extraordinaria” se recorta en el borde derecho. En restaurantes el selector cubre parcialmente la CTA y compite con el cierre del titular. En inmobiliarias aparece una CTA secundaria sin texto legible. El botón flotante de WhatsApp invade componentes interactivos en agencias, gym, inmobiliarias y restaurantes.

**Corrección:** ajustar wrapping y ancho máximo del hero de ecommerce; reservar espacio real entre copy, CTA y selector; corregir contraste/estado de la CTA inmobiliaria; crear una regla de colisión para retrasar o desplazar WhatsApp cerca de ejercicios y formularios.

### [P1] La prueba ficticia debilita la confianza

Agencias concentra casos, métricas, equipo y testimonios explícitamente ficticios. La transparencia es correcta, pero la acumulación de prueba simulada resta credibilidad justo antes de convertir.

**Corrección:** sustituir parte de la prueba social por artefactos verificables: entregables de muestra, metodología anotada, comparación antes/después y un único caso conceptual profundo.

### [P2] Longitud y repetición producen fatiga

Las alturas móviles observadas fueron aproximadamente: agencias 13.4k px, ecommerce 11.5k, gym 6.8k, inmobiliarias 17.4k y restaurantes 10k. Inmobiliarias y agencias exigen demasiado recorrido antes de completar la evaluación.

**Corrección:** reducir inventarios de tarjetas, fusionar secciones repetidas y construir una cadena más corta: promesa, prueba, método, oferta, objeciones, CTA.

### [P2] La estructura comercial aún se parece demasiado entre sectores

Los mundos gráficos cambian mucho, pero cuatro landings comparten casi la misma secuencia y patrón de selector superpuesto.

**Corrección:** mantener el sistema visual, pero diferenciar el viaje: reserva por ocasión en restaurantes; fit por ubicación/presupuesto en inmobiliarias; comparación/compra en ecommerce; objetivo/horario/prueba en gym; diagnóstico/propuesta en agencias.

## Alertas por persona

**Jordan, visitante nuevo:** encuentra dos o tres acciones compitiendo en los heroes; en agencias debe interpretar lenguaje abstracto y prueba ficticia; en ecommerce el recorte móvil afecta el mensaje principal.

**Riley, usuario crítico:** detectará de inmediato que gran parte de la evidencia de agencias es demostrativa y cuestionará las afirmaciones; también notará que los recorridos de sectores distintos reutilizan la misma lógica.

**Casey, usuario móvil distraído:** encuentra páginas muy largas, CTAs desplazadas o cubiertas y el botón de WhatsApp sobre contenido interactivo. La landing de gym es la más directa; inmobiliarias es la más exigente.

## Observaciones menores

- Unificar “Solicitar propuesta” e “Iniciar proyecto” en agencias.
- Explicar por qué un plan es “más solicitado”.
- El hero de Gym es el más compacto y auténtico, aunque su panel es denso en móvil.
- Las cinco páginas no presentan overflow horizontal del documento.
- El menú móvil está presente y correctamente etiquetado.

## Preguntas

- ¿Queremos que todas conviertan a WhatsApp o que cada industria tenga una acción nativa diferente?
- ¿Preferimos arreglar primero los cuatro defectos visibles de móvil o recortar la narrativa completa?
- Si cada landing tuviera solo cuatro secciones, ¿qué prueba conservaríamos para convencer?
