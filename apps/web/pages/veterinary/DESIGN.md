# Huella Veterinaria — sala clara

Esta demo tiene mundo visual propio dentro del ecosistema Luenio. Reemplaza a la plantilla
`care-landings.css`, que compartía con la demo de estéticas y que hacía que dos sectores distintos
salieran con la misma marca. No altera el sistema visual global de Luenio.

## Dirección

El estándar del sector, ejecutado en serio. Se eligió a propósito sobre las direcciones de autor que
ofrecía la ronda: aquí la ventaja es que el dueño de la clínica no tiene que aprender nada nuevo
para confiar. El listón de oficio son Chewy y Rover, no la clínica de la esquina con plantilla.

La página se comporta como una sala limpia y bien iluminada: blanco de fondo, un solo color que
manda, y fotografía real de un animal y su dueño llegando a la puerta. Nada de ironía, nada de
rarezas metidas de contrabando.

## Color y material

- Blanco de sala: `#ffffff`
- Reposo: `#f6fbfb`
- Cian clínico: `#0e7490`, y `#155e75` al pasar por encima
- Tinta: `#0f172a`, y `#475569` para lo secundario
- Disponible: `#15803d` sobre `#dcfce7`
- Último cupo: `#9a5b00` sobre `#fdf0d5`

Un solo color manda: el cian cubre la acción primaria, la marca y la franja de cierre. El resto es
blanco y tinta.

El tema oscuro se deriva del mismo cian y no del azul corporativo heredado: fondo `#0b1417`, cian
`#2bb3c7` y tinta `#e9f3f3`. Es la sala de noche, no un panel de banco.

**El fondo se declara con la misma especificidad que la regla global.** `style.css` pinta el `body`
con un degradado azul y una rejilla en `::before` desde `html[data-theme="light"] body`, que gana a
cualquier regla de una sola clase. La hoja de esta demo responde con
`html[data-theme="light"] .vet-clinic`, nunca con `!important`.

## Tipografía

`Bricolage Grotesque` sostiene titulares, marca y horas. `Figtree` lleva cuerpo, navegación y
controles. La interlínea de display nunca baja de 1.06: en español, con tildes y descendentes, un
titular más apretado hace que los glifos se toquen.

## Componentes

- Botón: una sola familia, cápsula, con sus cinco estados. Cada estado que cambia el fondo
  restablece también la tinta, en vez de dejar que se herede de otra regla.
- Tarjeta de servicio: icono y título **en la misma fila**, descripción, y la duración anclada
  abajo. Cuatro fichas de icono apiladas sobre el título son la forma que delata la tarjeta
  perezosa.
- Elección de motivo: fila completa, mínimo 64 px de alto, con `aria-pressed` y el estado marcado
  por borde, fondo y tinta del icono a la vez. El color nunca comunica solo.
- Horario: hora en cifras tabulares, servicio, y etiqueta de estado con su propio par de color.
- Aviso demostrativo: uno solo, inmediatamente debajo de la acción del héroe. Nunca encima del
  titular, y nunca duplicado en dos líneas distintas.

## Movimiento

Un único momento autoral: la respuesta de la ruta se reasienta al cambiar el motivo, con una
entrada corta y desaceleración exponencial. El resto son transiciones de estado de 0,18 s. Con
movimiento reducido, todo queda desactivado.

## Accesibilidad

Contraste AA, foco cian visible con desplazamiento, objetivos de 44 px como mínimo en todo lo que
pertenece a esta página, orden de encabezados sin saltos y datos ficticios rotulados junto a la
interacción. El enlace de salto lleva tinta y fondo propios: antes aparecía al enfocar pero su texto
quedaba a 1,02:1 contra el fondo global, es decir, inservible.

Los cuatro objetivos por debajo de 44 px que quedan en la página pertenecen a la capa compartida de
Luenio (la píldora de demo, el botón flotante y la barra legal), no a este mundo.
