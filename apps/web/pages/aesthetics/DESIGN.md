# Aura Estética — estudio de piel

Esta demo tiene mundo visual propio dentro del ecosistema Luenio. Reemplaza a la plantilla
`care-landings.css`, que compartía con la demo de veterinarias y que hacía que dos sectores
distintos salieran con la misma marca; esa hoja se quedó sin consumidores y se borró del
repositorio. No altera el sistema visual global de Luenio: el DESIGN.md global declara que los
mundos sectoriales viven en un sandbox, así que **ni esta paleta ni esta tipografía ascienden a
tokens globales**. Viven bajo `.skin-studio` y ahí se quedan.

## Dirección

El estándar del sector, ejecutado en serio, y tomado a propósito como salida permanente. La tirada
había asignado otra forma —la pirámide olfativa, semilla `3921b507`— y se anuló deliberadamente: en
estética la ventaja no es sorprender, es que la dueña del centro reconozca su oficio a la primera.
El listón de oficio son Heyday y Curology, no el salón con plantilla.

La página vende continuidad, no transformación. La honestidad sobre lo que un tratamiento **no**
hace es la prueba de criterio, y por eso el bloque "Lo que esta página no hace" va en el cuerpo del
método, con su propia tarjeta, y no escondido en letra pequeña al pie. Se rechazaron el beige zen
con serif espaciada y el frío de laboratorio óptico que la demo llevaba antes.

## Color y material

- Blanco de sala: `#ffffff`
- Reposo: `#faf6f7`, y `#f3eaed` para el reposo hondo
- Ciruela apagada: `#8e3b60`, y `#73304e` al pasar por encima; su lavado es `#f7ecf1`
- Tinta grafito: `#211a1e`, y `#5d5257` para lo secundario
- Filete: `#e8dfe2`, y `#cdbdc4` cuando tiene que verse
- Ritmo habitual: `#8e3b60` sobre `#f7ecf1`
- Ritmo prudente: `#6d5560` sobre `#f1ebee`

Un solo color manda: el ciruela cubre la acción primaria, la marca, la numeración de la pauta y el
estado activo. El resto es blanco, rosa mineral muy lavado y tinta. **Las píldoras de estado son del
propio mundo**: el verde y el ámbar que traía eran literalmente los tokens de veterinarias, y el
verde además rimaba con el de WhatsApp, que no es de esta marca. Se resolvieron dentro de la misma
familia ciruela-grafito, que es lo que distingue esta sala de la sala cian del otro sector.

El tema oscuro no invierte: baja a un ciruela de noche. Fondo `#171013`, reposo `#1e1519`, ciruela
claro `#e6a2be` y tinta `#f6eef1`. Cada superficie que pinta ciruela restablece la tinta a `#171013`
en lugar de heredarla.

**El fondo se declara con la misma especificidad que la regla global.** `style.css` pinta el `body`
con un degradado y una rejilla en `::before` desde `html[data-theme="light"] body`, que gana a
cualquier regla de una sola clase. La hoja de esta demo responde con
`html[data-theme="light"] .skin-studio`, nunca con `!important`. Es la misma lección que recoge el
documento de veterinarias.

La materia es plana con un único relieve: una sombra baja y difusa (`0 10px 22px -16px`) que solo
llevan el retrato del héroe y la tarjeta de la pauta. Todo lo demás se separa por filete de 1 px.
Esquina blanda: 18 px en las piezas grandes, 12 px en la fila de elección, cápsula en botones y
píldoras.

## Tipografía

`Red Hat Display` sostiene titulares, marca y la numeración del método. `Red Hat Text` lleva cuerpo,
navegación, controles y datos. La interlínea de display nunca baja de 1.05 —está en 1.08—: en
español, con tildes y descendentes, un titular más apretado hace que los glifos se toquen.

La escala es corta a propósito: `clamp(2.4rem, 4.8vw, 3.5rem)` para el h1, `clamp(1.75rem, 3vw,
2.4rem)` para el h2, y 1,12 rem para el h3, que es donde vive casi toda la página. La frase de
apoyo se corta en 36ch y las leyendas de sección en 52ch. Toda cifra que se pueda comparar en
vertical —fechas relativas, duraciones, totales— va en cifras tabulares.

## Componentes

- Botón: una sola familia, cápsula, 48 px de alto (44 en la variante corta), con sus cinco estados.
  Cada estado que cambia el fondo restablece también la tinta. La variante silenciosa tuvo que
  responder a la regla oscura de `.skin-btn` a su misma especificidad: esa regla pinta la tinta del
  color del fondo para que se lea sobre el ciruela claro y, con una clase más, ganaba a `--quiet` y
  dejaba el botón secundario sin texto visible.
- Lista de tratamientos: filas con filete, no rejilla de tarjetas iguales. El precio del sector es
  que todo termine pareciendo el mismo catálogo; tres tarjetas gemelas con icono arriba son la
  forma que lo delata. Cada fila lleva nombre, descripción y la duración anclada a la derecha.
- Elección de motivo: fila completa, mínimo 68 px de alto, con `aria-pressed` y el estado marcado
  por borde, fondo, ficha de icono y una palomita dibujada a la vez. El color nunca comunica solo.
- Tarjeta de pauta: la pieza firma. Cabecera con título y total, secuencia numerada donde cada paso
  dice cuándo, qué y por qué, y pie con píldora de estado más la acción.
- Píldora de estado: par de color propio y punto de color delante. **Dice el ritmo de la pauta,
  nunca la disponibilidad.** Una demo que anuncia cupos afirma algo sobre una agenda que no existe,
  y mete presión de escasez en una página cuya tesis es que aquí no te venden de más.
- Bloque de límites: tarjeta con filete dentro de la sección de método, a la misma altura visual que
  los pasos. Es lo que sostiene todo lo demás, así que no se esconde al final.
- Aviso demostrativo: uno solo, inmediatamente debajo de la acción del héroe, con filete lateral.
  Nunca encima del titular.

## Movimiento

Un único momento autoral: la tarjeta de la pauta se reasienta al cambiar el motivo, con entrada
corta de 460 ms y desaceleración exponencial. La interacción propia de este sector es esa —elegir un
motivo reescribe un calendario completo, con intervalos y punto de revisión, no un párrafo—, así que
el único movimiento de la página es el de esa reescritura. El resto son transiciones de estado de
0,18 s. Con movimiento reducido, todo queda desactivado.

## Accesibilidad

Contraste AA con margen: el botón secundario da 17,06 en claro y 16,45 en oscuro después de arreglar
la cascada descrita arriba, y la píldora de estado da 6,19 en claro y 8,10 en oscuro. `axe` no
reporta ninguna violación crítica ni grave, en claro ni en oscuro.

Foco ciruela de 3 px con desplazamiento, objetivos de 44 px como mínimo en todo lo que pertenece a
esta página, orden de encabezados sin saltos, `aria-live` en la tarjeta que se reescribe y datos
ficticios rotulados junto a la interacción. El enlace de salto lleva tinta y fondo propios: heredando
los globales quedaba a 1,02:1 contra el lienzo de esta página, es decir, inservible.

En móvil el aviso demostrativo termina en 760 px sobre una ventana de 844 px de alto. **Caber en el
pliegue no bastaba**: el disparador flotante de WhatsApp ocupa la banda 778–830 y se comía la última
línea del aviso, así que la condición real es terminar por encima del botón flotante, no dentro del
viewport. Se paga con espaciado del héroe y con un encuadre panorámico del retrato; el aviso no cede
palabras.

Dos defectos que la página carga pero que **no son de este mundo** y no se canonizan aquí: la firma
flotante "Demo de Luenio" cae sobre la leyenda de la sección de la pauta en ventanas de 900 px de
alto, y el mecanismo de esquiva del disparador de WhatsApp está roto —no se mueve para ningún valor
de `--luenio-trigger-lift` ni para un `bottom` inline—. Ambos viven en `niche-landing.js` y
`niche-widget.css`, afectan a las siete demos y merecen su propia pasada. Añadir espaciado en esta
hoja solo desplazaría el problema a otro elemento y a otro alto de ventana.
