---
target: Home pública de Luenio
total_score: 25
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 2
timestamp: 2026-08-26T20-14-20Z
slug: apps-web-pages-home-index-html
---
# Crítica de diseño — Home pública de Luenio

## Design Health Score

| # | Heurística | Puntuación | Hallazgo principal |
|---|---|---:|---|
| 1 | Visibilidad del estado del sistema | 3/4 | El selector de demos comunica la demo activa y el estado de carga; la página larga no muestra una orientación de progreso. |
| 2 | Correspondencia con el mundo real | 4/4 | Habla en términos comprensibles para un negocio: ventas, WhatsApp, cotización, seguimiento y acompañamiento. |
| 3 | Control y libertad del usuario | 3/4 | Hay navegación por anclas, menú escapable, cierre del diálogo y enlace para volver; falta más control sobre la experiencia de demo en móvil. |
| 4 | Consistencia y estándares | 3/4 | La identidad visual es coherente, aunque la cabecera duplica la acción de cotizar y algunos caminos usan etiquetas muy parecidas. |
| 5 | Prevención de errores | 3/4 | El flujo de contacto valida datos mínimos, conserva el formulario ante error y ofrece una alternativa por WhatsApp. |
| 6 | Reconocimiento antes que recuerdo | 3/4 | Navegación, sectores, estado de demo y acciones están etiquetados; “Explorar demos” y “Abrir demo” pueden parecer el mismo paso. |
| 7 | Flexibilidad y eficiencia | n/a | Es una landing Persuade; atajos y aceleradores de power user no son una expectativa central. |
| 8 | Diseño estético y minimalista | 3/4 | La escena inicial respira y tiene jerarquía; dos CTAs principales y una página extensa compiten un poco por atención. |
| 9 | Ayuda para reconocer y recuperarse de errores | 3/4 | Los mensajes de formulario son claros y accionables; no se ve una recuperación explícita si fallan todos los recursos de una demo. |
| 10 | Ayuda y documentación | n/a | La home tiene FAQ, pero no es una superficie de documentación o soporte autónomo. |
| **Total** |  | **25/32** | **Bueno: base sólida, con mejoras claras de conversión y diferenciación.** |

## Veredicto de especificidad

### Evaluación de diseño

La página sí tiene una personalidad reconocible: azul de acción, tinta naval, demos ficticias declaradas y el recorrido Web → WhatsApp → Automatización → Seguimiento. El selector de sectores y el tono de servicio acompañado son propios de Luenio.

El primer viewport, sin embargo, todavía puede confundirse con el de cualquier estudio web o landing SaaS: titular centrado, dos botones azules/blancos, mockup de navegador y selector de categorías. La decisión más valiosa —que Luenio conecta captación, conversación y continuidad comercial— aparece después del pliegue. La oportunidad no es añadir más decoración, sino adelantar esa prueba de sistema.

### Escaneo determinista

`detect.mjs --json apps/web/pages/home/index.html` terminó con código 0 y 0 hallazgos. No hubo reglas, ubicaciones ni falsos positivos que reportar. Es una señal positiva de calidad mecánica, pero no evalúa por sí solo la claridad comercial, el tamaño de la demo ni la fuerza de la diferenciación.

## Impresión general

Se ve cuidada, profesional y confiable. La primera escena tiene buen aire y el mockup hace que la oferta se sienta tangible. Mi mayor reserva es estratégica: hoy el visitante puede concluir “hacen páginas bonitas con automatizaciones”, cuando la propuesta más fuerte es “construyen un sistema comercial completo que no deja el contacto abandonado”.

## Qué está funcionando

- **La primera escena tiene foco.** El titular, la explicación, las dos acciones y una demo dominante se entienden sin una pared de tarjetas.
- **La demo se trata con honestidad.** “Demos ficticias” evita vender ejemplos como clientes reales y el selector permite explorar sectores sin inventar métricas ni testimonios.
- **La base de interacción es madura.** Hay navegación semántica, enlace para saltar al contenido, estados `aria-live`, menú móvil escapable, objetivos táctiles amplios y una variante de movimiento reducido visible en el código.

## Carga cognitiva

Resultado: **1 de 8 checks fallido; carga baja, con una decisión inicial algo dispersa.**

- Cumple foco único, agrupación, jerarquía visual, secuencia de decisión, memoria de trabajo y revelación progresiva.
- Falla **minimal choices** en el primer viewport: el visitante ve 5 enlaces de navegación, 1 CTA en la cabecera, 2 CTAs en el hero y 3 sectores seleccionables. No está roto, pero son demasiadas rutas visibles para una primera decisión.
- El selector de sectores está bien limitado a tres opciones en la escena inicial; el problema es la suma con las acciones y la navegación, no el selector aislado.

## Recorrido emocional

La entrada transmite control y profesionalismo. El pico emocional está en la ventana de demo y en poder cambiar de sector; el cierre con WhatsApp y el FAQ funcionan como reaseguro. El valle aparece después: la página pasa de una escena visual fuerte a varios bloques explicativos largos, y la diferencia entre “diseño web” y “sistema comercial conectado” pierde intensidad. El cierre vuelve a ser claro, pero llega después de bastante lectura.

## Problemas prioritarios

### [P1] La diferenciación principal está debajo del pliegue

**Por qué importa:** un visitante que solo ve el primer viewport puede clasificar a Luenio como una agencia web más. La automatización y el seguimiento son la razón para elegir el servicio integral.

**Arreglo:** ajustar el párrafo del hero para nombrar explícitamente el circuito completo y añadir una señal breve, no otro panel: “Web → WhatsApp → automatización → seguimiento”. La demo puede seguir siendo protagonista, pero debe explicar qué sistema está demostrando.

**Comando sugerido:** `$impeccable clarify`.

### [P1] Hay dos acciones primarias compitiendo

**Por qué importa:** “Explorar demos” y “Solicitar cotización” tienen un peso muy parecido en el hero, y la cabecera vuelve a mostrar “Solicitar cotización”. El usuario no recibe una prioridad tan nítida como podría.

**Arreglo:** elegir una acción dominante según el objetivo comercial. Si la prioridad sigue siendo explorar demos, mantener esa como el único botón sólido y convertir la cotización de cabecera en enlace/outline. Si la prioridad real es captar conversaciones, cambiar el CTA principal a WhatsApp/cotización y dejar la exploración como secundaria.

**Comando sugerido:** `$impeccable distill`.

### [P2] La demo pierde legibilidad en móvil

**Por qué importa:** en la captura móvil la demo se ve completa y atractiva, pero el texto interno es pequeño; la prueba visual funciona más como imagen que como evidencia que se pueda inspeccionar. Además, el enlace “Abrir demo” queda debajo del preview y del selector.

**Arreglo:** preparar un recorte móvil con una sola zona legible, o añadir una acción visible de “Ver demo completa” junto al estado. Mantener el mockup como teaser y delegar el detalle a la landing sectorial.

**Comando sugerido:** `$impeccable adapt`.

### [P2] El recorrido Web → WhatsApp queda sin título en escritorio

**Por qué importa:** `.hc-flow__intro` está oculto en escritorio, así que la primera banda posterior al hero muestra cuatro conceptos (“Web”, “WhatsApp”, “Automatización”, “Seguimiento”) sin la frase que explica su relación. En móvil sí aparece el contexto.

**Arreglo:** mostrar en escritorio una versión compacta del encabezado o integrar esa frase en el pie de la demo; los cuatro pasos deben leerse como un sistema, no como cuatro servicios separados.

**Comando sugerido:** `$impeccable layout`.

### [P2] La honestidad está, pero falta evidencia concreta de trabajo

**Por qué importa:** declarar que las demos son ficticias es correcto, pero también elimina la prueba social. El visitante necesita otra forma de confiar antes de cotizar.

**Arreglo:** sumar ejemplos verificables de entregables, alcance y decisiones de implementación: qué recibe un cliente, cómo se conecta un formulario, qué se define en la primera conversación y qué queda funcionando. No hace falta inventar clientes, métricas o testimonios.

**Comando sugerido:** `$impeccable clarify`.

## Señales por persona

### Jordan — primerizo confundido

La primera acción es clara, pero “Demos”, “Explorar demos” y “Abrir demo” nombran tres entradas parecidas. Jordan puede no saber si primero debe elegir un sector, abrir una demo o solicitar una cotización. Conviene explicar el resultado de cada paso con una microfrase consistente.

### Riley — usuario que fuerza casos límite

La carga diferida tiene fallback AVIF/WebP y el código evita que una selección rápida deje una demo vieja activa. El punto débil es que, si fallan ambos recursos, no hay un mensaje visible de recuperación en la escena; el usuario puede quedarse con un marco vacío. También puede perder los datos del diálogo de WhatsApp si recarga o abandona la página durante una interrupción.

### Casey — usuario móvil distraído

Los botones ocupan todo el ancho y son fáciles de tocar. El riesgo está en la demo: exige más desplazamiento para llegar a “Abrir demo” y el contenido interno no se lee bien en una pantalla pequeña. No hay una señal de guardado de borrador para una conversación iniciada y luego interrumpida.

## Observaciones menores

- La cabecera se ve muy bien en escritorio; en móvil el botón de menú y el selector de tema son correctos, pero el CTA comercial desaparece del primer nivel y queda dentro del menú.
- La clase `.hc-flow__intro` tiene una intención editorial clara, pero su ocultamiento desktop rompe la continuidad de la narrativa.
- `home-clarity.css` conserva una familia paralela de clases `.hc-header`, `.hc-nav` y `.hc-brand` que no coincide con la cabecera activa `.site-header`; conviene limpiarla en una pasada de mantenimiento para reducir ambigüedad futura.
- La nota “No representan clientes reales” es una fortaleza de confianza; debe conservarse también en las landings sectoriales y cerca de cualquier resultado visual destacado.

## Preguntas para decidir la siguiente pasada

1. En la cabecera, ¿qué debe ganar ahora: **más cotizaciones**, **más exploración de demos** o **un equilibrio explícito entre ambas**?
2. Para hacer visible la diferenciación, ¿prefieres un tono **más directo y comercial**, **más técnico/automatizado** o **más humano y cercano**?
3. ¿Quieres corregir solo los **3 problemas principales** o hacer una pasada sobre **los 5**?
