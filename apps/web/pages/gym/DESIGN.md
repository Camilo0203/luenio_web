# Titan Fitness Club — Class Board

Esta demo tiene un mundo visual propio y ficticio dentro del ecosistema Luenio. Su propósito es
mostrar cómo una experiencia digital para gimnasio puede guiar, reservar y orientar; no altera el
sistema visual global de Luenio.

## Dirección

El sitio se comporta como el panel de operaciones del club. La forma principal es un tablero
mecánico split-flap: filas que cambian de estado, horarios que se leen de un vistazo, señalización
precisa y controles que parecen pertenecer al mismo objeto físico.

La primera vista no usa el hero habitual de atleta. El mecanismo aparece funcionando: el visitante
elige objetivo, nivel y horario, y la ruta recomendada se recompone frente a él.

## Color y material

- Negro flap: `#0d0f0f`
- Grafito: `#181b1e`
- Blanco señal: `#f2f2f2`
- Ámbar de acción: `#ffb400`
- Acero: `#7d838c`
- Verde WhatsApp: `#0d7a3f`, reservado exclusivamente para WhatsApp

El tema claro traduce el mismo objeto a aluminio claro y marfil; no elimina el contraste del tablero
ni convierte la experiencia en una plantilla blanca.

## Tipografía

`Oswald` se usa para titulares y caracteres de tablero. `Archivo Narrow` sostiene navegación,
controles y cuerpo. Las mayúsculas son funcionales en señalización y horarios, no decoración
indiscriminada.

## Componentes

- Panel: marco recto, acero fino, sombra con desplazamiento y división interna visible.
- Flap: celda rectangular con bisagra horizontal, estado seleccionado en ámbar.
- Acción primaria: ámbar con texto negro; WhatsApp conserva verde y texto blanco.
- Estado: lámpara pequeña más texto explícito. El color nunca comunica por sí solo.
- Fotografía: documental, monocroma o de baja saturación, integrada como una banda amplia.

## Movimiento

Las selecciones realizan un giro corto de split-flap y actualizan la ruta. Las secciones entran una
sola vez con recorte y desplazamiento. No hay movimiento continuo; con movimiento reducido todas
las transiciones quedan desactivadas.

## Accesibilidad

Contraste AA, foco ámbar visible, objetivos mínimos de 44px, estado `aria-pressed` o
`aria-selected`, orden DOM equivalente al orden visual y datos ficticios declarados junto a la
interacción.
