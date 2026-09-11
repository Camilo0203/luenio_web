# Impulso Digital — mesa de alcance

Esta demo tiene mundo visual propio dentro del ecosistema Luenio. Sale del stack compartido
`sector-v2` (`niche-showcase.css`, `industry-demos.css`, `sector-worlds.css`,
`sector-redesign.css`), que **no se borra**: restaurantes, inmobiliaria y ecommerce siguen encima.
Es distinto del caso de estéticas, donde la hoja compartida se quedó sin consumidores y desapareció.
No altera el sistema visual global de Luenio: el DESIGN.md global declara que los mundos sectoriales
viven en un sandbox, así que **ni esta paleta ni esta tipografía ascienden a tokens globales**. Viven
bajo `.agency-desk` y ahí se quedan.

## Dirección

El estándar del sector, ejecutado en serio, y tomado a propósito como salida permanente. La tirada
había asignado el contrato de encargo —semilla `9ec7d32c`— y se anuló deliberadamente. El listón de
oficio son Focus Lab y Work & Co, no el estudio con plantilla.

La página vende límite, no promesa. Lo que una agencia esconde —qué no entra, cuántas rondas hay— es
aquí el cuerpo del documento, en el primer viewport y con la misma tipografía que lo incluido. El
titular lo dice sin rodeos: el alcance se escribe antes de empezar.

Donde el estándar del sector pone una franja de logotipos de clientes, esta página pone **tipos de
encargo con su alcance**. Luenio no tiene clientes públicos y el producto prohíbe inventarlos, así
que la prueba no es la marca ajena: es el documento.

## Color y material

- Papel: `#faf8f3`, y `#f1ede3` para el papel hondo de las secciones alternas
- Hoja: `#ffffff`
- Tinta: `#16150f`, y `#55524a` para lo secundario
- Rojo de galerada: `#c0392b`, y `#9c2b20` al pasar por encima; su lavado es `#fbeceb`
- Filete: `#ddd7c9`, y `#b6ae9b` cuando tiene que verse

**Un solo acento en toda la página.** El rojo es el que este oficio usa para corregir galeradas, y
aquí marca exactamente una cosa: el límite del encargo. El verde de "incluido" se eliminó por ser la
insignia de éxito genérica de la categoría y no la marca de este oficio; la etiqueta de lo incluido
va en tinta sobre filete (`.ag-flag--in`) y solo lo excluido lleva el rojo. La acción primaria es
tinta sobre papel, no acento: el rojo se reserva para el paso por encima, la numeración de etapas, el
tipo de alcance y la cláusula de exclusiones.

El tema oscuro no invierte: baja a la misma mesa de noche. Papel `#14130f`, hoja `#1e1c17`, tinta
`#f5f1e6` y un rojo aclarado a `#ef6f5e` para sobrevivir al fondo. La franja de cierre, que en claro
es tinta plena, pasa a hoja para no convertirse en un bloque negro sobre negro.

**El fondo se declara con la misma especificidad que la regla global.** `style.css` pinta el `body`
con un degradado y una rejilla en `::before` desde `html[data-theme="light"] body`, que gana a
cualquier regla de una sola clase. La hoja responde con `html[data-theme="…"] .agency-desk`, nunca
con `!important`. Es la misma lección que recogen los documentos de veterinarias y estéticas.

La materia es papel de imprenta: esquina de 4 px —la más dura de las tres demos, frente a los 18 px
de estéticas— y un único relieve, una sombra baja y difusa (`0 12px 26px -20px`) que solo lleva el
documento de alcance. Todo lo demás se separa por filete de 1 px, y las secciones de lista abren con
un filete de 2 px en tinta que hace de cabecera de tabla.

**La única fotografía vive en la sección de entregables** y se difiere con `loading="lazy"`, porque
el primer viewport es el documento y no una imagen. El test de landings lo comprueba con un campo
propio.

## Tipografía

`Instrument Serif` sostiene titulares, marca y la cifra de presupuesto, en peso 400: la serif es la
que dice "documento" antes de que se lea una palabra, y es lo que separa esta mesa de la sala cian de
veterinarias y del salón ciruela de estéticas. `Hanken Grotesk` lleva cuerpo, navegación, controles y
etiquetas. La interlínea de display nunca baja de 1.05 —está en 1.07—: en español, con tildes y
descendentes, un titular más apretado hace que los glifos se toquen.

La escala es corta y el cuerpo manda: `clamp(2.6rem, 5.2vw, 4rem)` para el h1, `clamp(1.9rem, 3.2vw,
2.6rem)` para el h2, 1,2 rem para el h3, y 1,4 rem para el título del documento, que es un h2 que se
comporta como encabezado de hoja. El precio del alcance sube a `clamp(1.9rem, 3.4vw, 2.7rem)` en
display porque es el dato por el que se entra en esa sección. La frase de apoyo se corta en 38ch, la
nota en 46ch y las leyendas de sección en 54ch.

Toda cifra que se pueda comparar en vertical va en cifras tabulares: número de referencia del
alcance, numeración de cláusulas y etapas, rondas, precios y metadatos de fila. Las cláusulas y las
etapas numeran con `decimal-leading-zero` —`01`, `02`—, que es como se numera un anexo.

## Componentes

- Botón: una sola familia, esquina de 4 px, 48 px de alto (44 en la variante corta), con sus cinco
  estados. Cada estado que cambia el fondo restablece también la tinta. El reposo es tinta plena; el
  paso por encima es lo único que trae el acento.
- Documento de alcance: la pieza firma. Cabecera con título y número de referencia más semanas,
  bloque de elección, cláusulas numeradas y pie con las rondas y la acción. Las exclusiones van en el
  mismo cuerpo que las inclusiones, no en letra pequeña al pie.
- Elección de encargo: dos grupos —objetivo y punto de partida—, botones de 44 px con `aria-pressed`.
  El estado marcado cambia fondo, tinta y filete a la vez y revela una palomita dibujada: el color
  nunca comunica solo.
- Cláusula: rejilla de número y cuerpo. Los marcadores de viñeta son filetes de 1 px dibujados con
  `::before`; en la cláusula de exclusiones ese mismo filete se engrosa a 2 px, toma el rojo y gira
  −14°. **Es una tachadura de corrección, no una equis prestada a la tipografía.**
- Etiqueta de cláusula: cápsula de filete en `currentColor`. `--in` en tinta secundaria, `--out` en
  rojo. Dice si algo entra o no entra, nunca disponibilidad ni éxito.
- Lista con filete (`.ag-rows`): filas, no rejilla de tarjetas gemelas. Tres tarjetas iguales con
  icono arriba son la forma que delata la página de agencia perezosa.
- Secuencia de proceso: tres etapas encadenadas bajo un filete corrido de 2 px, con filete vertical
  entre ellas. Es una secuencia, no un listado de tarjetas.
- Fila de alcance: precio a escala de display a la izquierda, tipo de alcance debajo en rojo, detalle
  al lado. Tres formas distintas en la segunda mitad de la página para que no sea el mismo contenedor
  cuatro veces.
- Preguntas frecuentes: `<details>` nativo con el marcador del navegador retirado. La cruz y la raya
  se dibujan con dos degradados de 2 px de grosor, el mismo que el resto de las marcas de la página.
  Ni aquí ni en las cláusulas hay un glifo de la tipografía haciendo de icono.
- Aviso demostrativo: uno solo, inmediatamente debajo de la acción del héroe, con filete lateral.
  Nunca encima del titular.

## Movimiento

Un único momento autoral: el documento se reasienta al cambiar el encargo, con entrada corta de
440 ms y desaceleración exponencial, reproducida a la fuerza en cada cambio. La interacción propia de
este sector es esa —elegir objetivo y punto de partida reescribe un documento con qué entra, qué no
entra y cuántas rondas, no un titular—, así que el único movimiento de la página es el de esa
reescritura. Hay nueve alcances escritos, cada uno con su número de referencia, sus semanas, sus
rondas, tres inclusiones y tres exclusiones. El resto son transiciones de estado de 180 ms. Con
movimiento reducido, todo queda desactivado.

`industry-demos.js` sigue cargado porque maneja el formulario simulado que comparten otras tres
demos; `agency-landing.js` sustituye solo la parte del brief. No chocan porque aquella busca
`[data-agency-brief]` y esta página declara `[data-agency-scope]`, así que la vieja sale sola.

## Accesibilidad

Contrastes entre 4,74 y 17,23 en tema claro y entre 5,54 y 16,47 en oscuro. `axe` no reporta ninguna
violación crítica ni grave, en claro ni en oscuro.

Foco rojo de 3 px con desplazamiento, objetivos de 44 px como mínimo en todo lo que pertenece a esta
página, orden de encabezados sin saltos, `aria-live` en la lista de cláusulas que se reescribe y
datos ficticios rotulados junto a la interacción. El enlace de salto lleva tinta y fondo propios:
heredando los globales quedaba ilegible contra el papel de esta página.

**En teléfono no caben a la vez el documento completo y el aviso demostrativo, y manda el aviso.**
Adelantar el documento lo empujaba a 1237 px, fuera del primer viewport, así que el orden se queda
como en escritorio: el aviso queda en 406–484 px, dentro del pliegue y libre de la banda 778–830
donde se sienta el disparador flotante, y la cláusula de exclusiones pide un desplazamiento corto.
Lo que se aprieta es el espaciado, nunca el texto.

Dos defectos que la página carga pero que **no son de este mundo** y no se canonizan aquí: la firma
flotante "Demo de Luenio" cae sobre el contenido en ventanas altas, y el mecanismo de esquiva del
disparador de WhatsApp está roto. Ambos viven en `niche-landing.js` y `niche-widget.css`, afectan a
las siete demos y merecen su propia pasada. Añadir espaciado en esta hoja solo desplazaría el
problema a otro elemento y a otro alto de ventana.
