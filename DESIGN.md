---
name: "Luenio — Claridad en Movimiento"
description: "Un sistema comercial claro: demostraciones visuales para decidir y herramientas sobrias para operar."
colors:
  marketing-ink: "#10213D"
  action: "#176BFF"
  action-deep: "#0B4FD8"
  action-soft: "#DCE9FF"
  marketing-canvas: "#F6F8FC"
  surface: "#FFFFFF"
  mist: "#EAF0F8"
  marketing-muted: "#61708A"
  marketing-line: "#D9E2EF"
  whatsapp: "#0F743F"
  night-section: "#0B1B33"
  night-footer: "#08162B"
  operate-canvas: "#F4F3F0"
  operate-surface-soft: "#FAF9F7"
  operate-surface-deep: "#F1EFEB"
  operate-text: "#1C1917"
  operate-text-soft: "#44403C"
  operate-muted: "#78716C"
  operate-accent: "#0F3D56"
  operate-accent-soft: "#E8F1F6"
  operate-line: "#E7E5E4"
  operate-line-strong: "#D6D3D1"
  operate-line-control: "#A8A29E"
  success: "#15803D"
  success-soft: "#F0FDF4"
  warning: "#B45309"
  warning-soft: "#FFFBEB"
  danger: "#B91C1C"
  danger-soft: "#FEF2F2"
  dark-canvas: "#080D16"
  dark-surface: "#0E1524"
  dark-surface-soft: "#131C2E"
  dark-surface-deep: "#0A101C"
  dark-text: "#F1F5F9"
  dark-text-soft: "#7C8AA0"
  dark-muted: "#8C99AD"
  dark-accent: "#D4A574"
typography:
  display:
    fontFamily: "Manrope, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3.25rem, 7vw, 6rem)"
    fontWeight: 650
    lineHeight: 0.98
    letterSpacing: "-0.055em"
  headline:
    fontFamily: "Manrope, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.4rem, 4.5vw, 4.8rem)"
    fontWeight: 650
    lineHeight: 1.02
    letterSpacing: "-0.045em"
  title:
    fontFamily: "Manrope, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.2rem, 2vw, 1.65rem)"
    fontWeight: 650
    lineHeight: 1.18
  body:
    fontFamily: "Manrope, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 430
    lineHeight: 1.65
  label:
    fontFamily: "Manrope, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
  control:
    fontFamily: "Manrope, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.2
  operate-title:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.2
  operate-body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  operate-label:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.4
  operate-control:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.2
  sector-agency:
    fontFamily: "Sora, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.5
  sector-ecommerce:
    fontFamily: "Chivo, Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.35
  sector-gym:
    fontFamily: "Oswald, Archivo Narrow, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.2
  sector-real-estate:
    fontFamily: "Source Serif 4, Hanken Grotesk, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.4
  sector-restaurant:
    fontFamily: "EB Garamond, Hanken Grotesk, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  micro: "5px"
  operate-control: "6px"
  operate-card: "8px"
  operate-panel: "10px"
  public-control: "12px"
  public-feature: "16px"
  public-card: "22px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  compact: "12px"
  md: "16px"
  body: "20px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  wide: "64px"
  3xl: "72px"
  4xl: "112px"
components:
  public-primary-button:
    backgroundColor: "{colors.action}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.public-control}"
    height: "52px"
    padding: "0 24px"
  public-whatsapp-button:
    backgroundColor: "{colors.whatsapp}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.public-control}"
    height: "52px"
    padding: "0 24px"
  public-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.marketing-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.public-control}"
    height: "52px"
    padding: "0 14px"
  public-demo-frame:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.marketing-ink}"
    rounded: "{rounded.public-feature}"
    padding: "10px"
  operate-primary-button:
    backgroundColor: "{colors.operate-accent}"
    textColor: "{colors.surface}"
    typography: "{typography.operate-control}"
    rounded: "{rounded.operate-card}"
    height: "31px"
    padding: "0 12px"
  operate-secondary-button:
    backgroundColor: "{colors.operate-surface-deep}"
    textColor: "{colors.operate-text}"
    typography: "{typography.operate-control}"
    rounded: "{rounded.operate-card}"
    height: "31px"
    padding: "0 12px"
  operate-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.operate-text}"
    typography: "{typography.operate-body}"
    rounded: "{rounded.operate-control}"
    height: "36px"
    padding: "0 12px"
  operate-status-badge:
    backgroundColor: "{colors.operate-surface-soft}"
    textColor: "{colors.operate-text-soft}"
    typography: "{typography.operate-label}"
    rounded: "{rounded.pill}"
    height: "20px"
    padding: "0 8px"
  operate-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.operate-text}"
    typography: "{typography.operate-body}"
    rounded: "{rounded.operate-panel}"
    padding: "16px"
---

# Design System: Luenio — Claridad en Movimiento

## Overview

**Creative North Star: "Claridad en Movimiento"**

Luenio se siente como una conversación comercial clara respaldada por muy buen diseño. El sistema tiene una sola personalidad —seria, cercana y precisa— con dos modos de expresión: **Persuade** ayuda al visitante a entender y actuar; **Operate** ayuda al equipo a escanear, decidir y completar trabajo comercial.

En Persuade, cada pantalla presenta una idea dominante, una frase breve y una demostración visual grande. Un recorrido azul luminoso conecta necesidad, página web, WhatsApp, automatización y seguimiento. En Operate, la expresión se vuelve más compacta: superficies cálidas y tranquilas, jerarquías densas pero legibles y color reservado para estado o acción.

Las demos sectoriales son evidencia visual y pueden construir mundos propios, pero sus paletas y tipografías no se convierten en tokens globales. Siempre deben declararse como demostrativas. La interfaz evita métricas inventadas, paneles repetidos y acumulación indiscriminada de tarjetas.

### Sector Worlds

Las siete landings sectoriales son productos demostrativos vendibles, no variaciones de una
plantilla. Comparten infraestructura de tema, analítica, cotización y WhatsApp, pero nunca
composición, navegación, ritmo o componente protagonista. Cada mundo alterna blanco y negro,
con un único acento propio reservado para acciones y estado.

- **Agencias — mesa de campaña:** negro de estudio, papel blanco y señal lima; una navegación lateral acompaña brief, pruebas y entregables físicos.
- **Ecommerce — lanzamiento de producto:** escenario blanco o negro y cobalto; el producto central, su configurador y la comparación técnica organizan la página.
- **Gimnasio — tablero de entrenamiento:** acero negro o marfil y esmeralda; constructor, ruta y clases funcionan como instrumentación real del club.
- **Inmobiliaria — atlas privado:** negro nocturno o papel blanco y cobre; la fotografía arquitectónica y un dossier de shortlist conducen la visita.
- **Restaurante — pase de cocina:** carbón o papel hueso y vino; carta, comandas y una franja de reserva dan forma al servicio.
- **Veterinaria — ruta de barrio:** blanco nítido, azul cobalto, verde hoja y señal amarilla; fotografía de llegada, señalética urbana y una ruta interactiva conectan observación, orientación y agenda sin simular un diagnóstico.
- **Estética — laboratorio óptico:** blanco mineral, azul ultramar y lila; una gran lente fotográfica, anotaciones de atlas y un protocolo visible conectan prioridad, contexto y valoración sin prometer resultados clínicos.

Las fotografías pertenecen al mundo sectorial y nunca se presentan como casos reales de Luenio. En móvil, el instrumento pasa debajo de la promesa sin comprimir el texto ni convertir la página en una sucesión de tarjetas.

Las familias sectoriales también están aisladas: Sora y Archivo Narrow en agencias; Chivo con
Segoe UI Variable Display como respaldo en ecommerce; Oswald y Archivo Narrow en gimnasio;
Source Serif 4 y Hanken Grotesk en inmobiliaria; EB Garamond y Hanken Grotesk en restaurante.
Veterinaria usa Bricolage Grotesque y Figtree; Estética usa Red Hat Display y Red Hat Text.
Son parte del sandbox de cada demo y nunca sustituyen Manrope e Inter en las superficies globales
de Luenio.

**The Five Instruments Rule.** Si dos landings pueden intercambiar su primer viewport sin
reconstruirlo, al menos una de ellas no está terminada.

**The Black, White, Signal Rule.** Cada mundo usa blanco y negro como campos dominantes y un solo
acento cromático; WhatsApp conserva su verde semántico como una capa externa de Luenio.

**Key Characteristics:**

- Clara antes que técnica.
- Visual y amplia al persuadir; compacta y escaneable al operar.
- Seria y confiable sin volverse fría.
- Movimiento suave con propósito y salida accesible.
- Demos ficticias declaradas con honestidad.

## Colors

La marca pública usa tinta naval, lienzos azulados y un solo azul dominante. El CRM traduce esa confianza a neutrales cálidos y acento petróleo. Los temas oscuros reducen sombras y usan capas tonales.

### Primary

- **Azul de acción** (`action`): decisiones públicas principales, recorrido guiado y foco de marca.
- **Petróleo operativo** (`operate-accent`): acciones primarias, enlaces y selección dentro del CRM.

### Secondary

- **Azul suave** (`action-soft`): fondos de énfasis y conexiones sin competir con la acción.
- **Petróleo suave** (`operate-accent-soft`): selección y énfasis operativo de baja intensidad.

### Tertiary

- **Verde WhatsApp** (`whatsapp`): exclusivamente para abrir o continuar una conversación por WhatsApp.
- **Ámbar nocturno** (`dark-accent`): acento del CRM oscuro; no reemplaza el azul en el sitio público.

### Neutral

- **Tinta naval** (`marketing-ink`) y **texto operativo** (`operate-text`): texto principal según el modo.
- **Lienzo luminoso** (`marketing-canvas`) y **lienzo operativo** (`operate-canvas`): fondos base.
- **Superficie blanca** (`surface`): formularios, marcos, tarjetas y paneles claros.
- **Niebla** (`mist`) y **superficie operativa suave** (`operate-surface-soft`): separación tonal.
- **Líneas frías** (`marketing-line`) y **líneas cálidas** (`operate-line`): límites discretos.
- **Noche naval** (`night-section`, `night-footer`) y **capas oscuras** (`dark-canvas`, `dark-surface`): contraste de cierre y modo oscuro.

### Semantic

- **Éxito** (`success`), **advertencia** (`warning`) y **peligro** (`danger`): comunicar estado real; nunca decorar.

**The One Voice Rule.** En cada superficie manda un solo acento. No se mezclan azul de acción y petróleo operativo como acciones equivalentes.

**The Sector Sandbox Rule.** Las paletas de agencias, ecommerce, gimnasios, inmobiliarias, restaurantes, veterinarias y estética pertenecen a sus demos; no se promueven al sistema global.

## Typography

**Display Font:** Manrope, con Inter y `system-ui` como respaldo.  
**Body Font:** Manrope en Persuade; Inter en Operate.  
**Label Font:** la familia del modo activo, con peso alto y uso breve.

**Character:** Manrope aporta una voz contemporánea y humana para promesas comerciales. Inter reduce ruido en tablas, formularios y herramientas densas. Las demos sectoriales pueden usar parejas tipográficas propias dentro de su mundo aislado.

### Hierarchy

- **Display** (650, escala fluida, 0.98): una sola promesa principal por primer viewport.
- **Headline** (650, escala fluida, 1.02): aperturas de secciones públicas.
- **Title** (650, escala fluida, 1.18): demos, soluciones y pasos.
- **Body** (430, 1rem, 1.65): explicación comercial de medida cómoda, idealmente hasta 65ch.
- **Label** (700, 0.75rem, 0.08em): contexto breve; no se repite sobre cada bloque.
- **Operate Title** (700, 1.25rem, 1.2): encabezados de vistas y paneles.
- **Operate Body** (400, 0.875rem, 1.5): información funcional y lectura rápida.
- **Operate Label** (600, 0.75rem, 1.4): metadatos, controles y estados.

**The Two-Family Rule.** Manrope e Inter son las únicas familias globales. Las fuentes de una demo no atraviesan su contenedor ni se cargan para la aplicación completa.

**The Short Promise Rule.** Los titulares grandes son cortos. La formalidad no se fabrica con mayúsculas extensas ni con párrafos centrados largos.

## Layout

El modo Persuade usa un contenedor global de hasta 1200px, escenas amplias y 88–128px entre bloques principales. El hero concentra un mensaje comercial sobre una gran demo visible en el primer viewport; después, el recorrido Web → WhatsApp → Automatización → Seguimiento conduce a las demos por sector. Los mundos sectoriales pueden ajustar su marco dentro de su sandbox, sin redefinir el contenedor global.

El modo Operate usa una cuadrícula más compacta basada en pasos de 4px, paneles de 8–10px de radio y densidad suficiente para comparar información sin reducir objetivos táctiles. Las páginas separan navegación, contexto de la vista, acciones y contenido; el color no sustituye etiquetas ni estructura.

En móvil ambos modos pasan a una columna, conservan objetivos táctiles de al menos 44px y hacen coincidir el orden visual con el DOM. Persuade mantiene aire y reduce profundidad; Operate convierte tablas o grupos densos en patrones navegables sin ocultar acciones esenciales.

**The One Scene Rule.** En Persuade, cada viewport tiene una idea y una demostración visual dominante.

**The Fast First Scene Rule.** La primera escena debe funcionar con la fuente de sistema mientras carga la familia de marca. Su recurso LCP usa formato moderno, dimensiones explícitas y prioridad alta; HTML, CSS, JavaScript y SVG viajan comprimidos.

**The Four-Pixel Rhythm Rule.** Los espacios funcionales parten de 4px; se favorecen 8, 12, 16, 20, 24 y 32px antes de introducir medidas nuevas.

## Elevation & Depth

El sistema es tonal por defecto. Persuade permite sombras azules amplias y tenues para elevar una única demo protagonista o un formulario clave. Operate usa sombras mínimas en claro y bordes o capas tonales en oscuro. La elevación nunca convierte cada bloque en una tarjeta flotante.

### Shadow Vocabulary

- **Demo stage** (`0 42px 90px -44px rgba(28, 68, 128, 0.55)`): una sola demo dominante.
- **Public low** (`0 18px 50px rgba(7, 26, 51, 0.08)`): separación ambiental de controles o paneles públicos secundarios.
- **Public panel** (`0 30px 80px -38px rgba(31, 71, 133, 0.42)`): formulario o panel público principal.
- **Operate low** (`0 1px 2px rgba(28, 25, 23, 0.05)`): separación casi imperceptible.
- **Operate medium** (`0 4px 12px rgba(28, 25, 23, 0.06)`): menús o superficies temporales.

El movimiento sigue `cubic-bezier(0.16, 1, 0.3, 1)`. Entradas y cambios de profundidad duran normalmente 140–900ms según distancia; el recorrido guiado puede llegar a 1400ms. Con `prefers-reduced-motion`, el contenido permanece completo y el movimiento se elimina o se vuelve instantáneo.

**The Flat-by-Default Rule.** Las superficies descansan en el lienzo; sombra y elevación se reservan para jerarquía o respuesta de interacción.

## Shapes

Persuade usa controles suavemente redondeados de 12px, marcos de demo de 16–22px y píldoras solo para estados breves. Operate usa radios más compactos: 5–6px en controles y 8–10px en tarjetas o paneles. Los bordes son finos, discretos y coherentes con el modo.

Las formas de marca pueden usar curvas y líneas guiadas, pero no deben cruzar texto, controles ni zonas de lectura. Las demos sectoriales pueden tener geometría propia siempre que permanezca aislada.

**The Radius Has a Job Rule.** Una píldora identifica estado o acción compacta; no es el radio por defecto de tarjetas, entradas ni botones.

## Components

### Buttons

- **Public Primary:** 52px de alto, radio de 12px, azul de acción y texto blanco.
- **WhatsApp:** misma geometría pública; verde reservado y etiqueta explícita.
- **Operate Primary:** 31px de alto, padding horizontal de 12px, radio de 8px, petróleo operativo y texto del lienzo activo.
- **Operate Secondary / Ghost:** conservan la misma geometría; cambian superficie y contraste, no el tamaño ni la jerarquía tipográfica.
- **Hover / Active:** elevación máxima de 2px, cambio de tono y retorno físico al activar.
- **Focus:** anillo visible con al menos 3px de grosor y separación exterior.

### Demo Frames

- **Shape:** marco público de 16–22px con barra mínima y viewport recortado.
- **Background:** superficie blanca o capa oscura equivalente.
- **Depth:** una sola sombra `demo-stage`.
- **Labeling:** debe indicar que la demo es ficticia y nombrar el sector.

### Cards / Containers

- **Public:** excepcionales; fondo blanco, línea fría y poco texto.
- **Operate:** radio de 8–10px, línea cálida y separación tonal antes que sombra.
- **Internal Padding:** 16–24px según densidad y modo.
- **Implementation:** controles, badges y superficies compartidas de Operate viven en `styles/ui-primitives.css`.

### Inputs / Fields

- **Public:** altura mínima de 52px, radio de 12px y etiquetas visibles.
- **Operate:** controles de 6px de radio y densidad compacta, sin bajar de 44px cuando son táctiles.
- **Focus:** borde de acento más anillo suave; nunca solo cambio de color.
- **Error / Disabled:** mensaje asociado, semántica ARIA y contraste AA.

### Navigation

La navegación pública es ligera, puede volverse translúcida al desplazarse y usa menú explícito en móvil. La navegación operativa es estable y escaneable; distingue ubicación, selección y acciones sin depender de iconos solos.

### Status Badges

Los estados operativos usan cápsulas de 20px de alto con texto breve, peso semibold y color semántico. La forma de píldora pertenece al estado; no se reutiliza como radio de tarjetas o campos.

### Shared Implementation

Los tokens globales viven en `styles/design-tokens.css` y su espejo programático en `styles/design-tokens.ts`. Las semánticas de tema Operate se resuelven en `styles/globals.css`; botones, campos, badges y superficies atómicas viven en `styles/ui-primitives.css`. Los módulos deben importar componentes desde `components/index.js`, sin depender de carpetas internas. La infraestructura compartida no exporta componentes visuales de las demos sectoriales.

### Guided Flow

Una línea azul o partícula luminosa conecta momentos comerciales sin convertirse en diagrama permanente. Se dibuja al entrar en el viewport, se detiene después de orientar y nunca cruza texto o controles.

## Do's and Don'ts

### Do:

- **Do** abrir con el resultado para el negocio y mostrar después cómo funciona.
- **Do** dar protagonismo a las demos reales del proyecto y declararlas ficticias.
- **Do** usar una sola escena dominante en superficies Persuade.
- **Do** reservar color semántico para estado real y acompañarlo con texto o iconografía.
- **Do** mantener contraste WCAG AA, foco visible y objetivos táctiles de al menos 44px.
- **Do** respetar `prefers-reduced-motion` sin perder información.
- **Do** mantener las fuentes remotas fuera de la ruta de renderizado y conservar un fallback tipográfico intencional.
- **Do** usar los tokens del modo activo antes de introducir un valor nuevo.
- **Do** importar primitivas Operate desde el entry point compartido y mantener las demos sectoriales dentro de su sandbox.

### Don't:

- **Don't** llenar una pantalla de tarjetas, etiquetas o decoraciones equivalentes.
- **Don't** convertir el hero público en un dashboard.
- **Don't** mezclar paletas o fuentes sectoriales con la identidad global.
- **Don't** inventar clientes, testimonios, métricas o resultados.
- **Don't** usar varias animaciones compitiendo entre sí.
- **Don't** ocultar la oferta detrás de metáforas ni describir Luenio como autoservicio genérico.
- **Don't** usar color, sombra o radio como decoración sin una función de jerarquía o estado.
