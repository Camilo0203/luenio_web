---
target: proyecto Luenio, con foco en apps/web/pages/home/index.html
total_score: 24
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 3
timestamp: 2026-08-09T23-16-58Z
slug: apps-web-pages-home-index-html
---
Method note: assessment B completed independently; assessment A sub-agent failed to return after repeated waits, so the design review was completed in the parent context using source, baseline, screenshot and DOM evidence.

## Design Health Score

| # | Heurística | Puntaje | Hallazgo principal |
|---|---|---:|---|
| 1 | Visibilidad del estado | 3 | El selector de demos comunica selección y carga; faltan señales de progreso fuera de interacciones puntuales. |
| 2 | Relación con el mundo real | 3 | El lenguaje es claro, pero “automatización” y “seguimiento” aún dependen de promesas más que de evidencia real. |
| 3 | Control y libertad | 3 | Navegación por anclas, FAQ y salidas claras; el movimiento automático del titular no aporta control. |
| 4 | Consistencia | 3 | La portada es coherente; la amplitud de mundos sectoriales y dos CRM aumenta el costo de consistencia global. |
| 5 | Prevención de errores | 3 | Los flujos públicos tienen guardas y seguridad; el homepage deriva la conversión a WhatsApp sin una ruta alternativa igual de clara. |
| 6 | Reconocimiento sobre memoria | 3 | Las opciones son visibles, pero siete sectores simultáneos exceden el umbral de cuatro decisiones. |
| 7 | Flexibilidad y eficiencia | n/a | No es una necesidad central en una landing de persuasión. |
| 8 | Diseño estético y minimalista | 3 | Composición limpia y profesional; la repetición de selector más galería de siete demos diluye el foco. |
| 9 | Recuperación de errores | 3 | El código preserva mensajes y estados; la portada casi no contiene tareas con recuperación compleja. |
| 10 | Ayuda y documentación | n/a | No es una necesidad central en una landing de persuasión. |
| **Total** |  | **24/32** | **Bueno: base sólida, foco estratégico pendiente.** |

## Veredicto de especificidad

La portada sí se siente diseñada para Luenio: tinta naval, azul de acción, demo protagonista y recorrido Web → WhatsApp → Automatización → Seguimiento forman una idea coherente. No parece una plantilla genérica. El detector automatizado devolvió 0 hallazgos para `apps/web/pages/home/index.html`.

La especificidad pierde fuerza por amplitud: siete sectores, siete demos interactivas, un CRM de leads y un CRM premium de agencia compiten por definir qué es Luenio. El visitante ve capacidad, pero no una elección estratégica ni evidencia comercial verificable.

## Impresión general

El proyecto está por encima de un prototipo: compila, pasa lint, tiene diseño documentado, pruebas, accesibilidad y una operación pensada. Su mayor oportunidad no es añadir funciones, sino publicar un recorrido principal, conseguir evidencia real y archivar lo que no apoye esa ruta.

## Qué funciona

- El primer viewport comunica servicio, no un SaaS genérico, y muestra el trabajo visual de inmediato.
- La jerarquía, contraste, etiquetas y semántica del homepage están bien resueltos; el detector no encontró infracciones.
- La documentación, límites de seguridad y suite de producción muestran disciplina técnica poco común para esta etapa.

## Problemas prioritarios

### [P1] Demasiadas apuestas antes de producción

**Por qué importa:** existen siete landings sectoriales, siete simulaciones y dos CRM con datos distintos. Esto duplica diseño, QA, documentación y operación antes de validar una propuesta principal.

**Arreglo:** elegir durante 4–6 semanas un sector o una oferta horizontal concreta; mantener 2–3 demos fuertes y congelar el resto. Decidir si `/dashboard` o `/crm` es el producto operativo actual; el otro debe quedar como laboratorio no desplegado.

**Comando sugerido:** `$impeccable distill`.

### [P1] Falta el último tramo para producción real

**Por qué importa:** el reporte de readiness marca incompletos `NODE_ENV`, URL pública, assets estáticos, cookies seguras, proxy confiable, MFA, Turnstile, entrega persistente, identidad legal, analítica y observabilidad. El código está listo antes que la operación.

**Arreglo:** cerrar P0 operativo antes de ampliar P2; desplegar un flujo completo lead → persistencia → entrega → seguimiento y verificarlo con secretos reales.

**Comando sugerido:** `$impeccable harden`.

### [P1] Las demos reemplazan evidencia, pero no construyen confianza suficiente

**Por qué importa:** las demos prueban oficio visual, no resultados. Sin clientes, testimonios ni métricas verificadas, la conversión depende casi por completo de confianza estética.

**Arreglo:** añadir evidencia honesta del proceso: alcance de una implementación, entregables, tiempos condicionados, demo guiada y, en cuanto exista, el primer caso real con consentimiento. Nunca presentar demos como clientes.

**Comando sugerido:** `$impeccable clarify`.

### [P2] El primer recorrido ofrece demasiadas opciones

**Por qué importa:** el primer viewport combina cinco enlaces, dos CTA, tema y siete sectores. El selector supera el límite de cuatro opciones y compite con la acción de cotizar.

**Arreglo:** mostrar tres sectores prioritarios y agrupar el resto en “Ver todas”; elegir una CTA primaria estable y dejar WhatsApp como alternativa contextual.

**Comando sugerido:** `$impeccable layout`.

### [P2] Hay peso y duplicación verificables

**Por qué importa:** `public/options-landings` añade 11.73 MB sin referencias internas y termina dentro del build. También hay una copia pública anidada idéntica de `theme-boot.js`, dos JPG inmobiliarios idénticos y un probable entrypoint histórico `apps/web/src/main.js`.

**Arreglo:** mover propuestas fuera de `public`; consolidar duplicados por hash; retirar `main.js` solo después de ajustar la prueba de arquitectura. Mantener las familias CSS sectoriales mientras sigan existiendo las páginas que las usan.

**Comando sugerido:** `$impeccable optimize`.

## Alertas por persona

- **Jordan, primera visita:** entiende qué hace Luenio, pero debe elegir entre siete sectores y no encuentra prueba de clientes o resultados que reduzca el riesgo.
- **Riley, comprador cuidadoso:** distingue que las demos son ficticias, pero encontrará una brecha entre la amplitud prometida y la ausencia de una implementación pública verificable.
- **Casey, móvil y distraído:** el recorrido largo y la repetición de siete demos hacen probable que llegue a WhatsApp sin haber retenido la diferencia entre servicio, automatización y CRM.
- **Dueño de pyme colombiano:** necesita saber qué recibe primero, cuánto acompañamiento incluye y qué resultado operativo puede esperar; hoy ve posibilidades, pero no un paquete inicial inequívoco.

## Observaciones menores

- El efecto de escritura del H1 aporta movimiento, pero “funcionando / vendiendo / creciendo” rota entre tres promesas amplias y puede percibirse como lenguaje publicitario genérico.
- La suite `npm test` encadena 29 pasos y excedió 184 segundos en esta revisión; conviene conservarla como gate predeploy y ofrecer un gate diario rápido explícito.
- `source-assets` (14.08 MB) y `design-proposals` (12.6 MB) parecen archivos de trabajo: deben archivarse fuera del despliegue, no eliminarse a ciegas.
- `tmp`, `test-results` y `dist` son generados e ignorados; pueden limpiarse localmente cuando ya no sean necesarios.

## Preguntas para decidir

1. ¿La prioridad comercial inmediata será un sector principal, una oferta horizontal para pymes o la venta del CRM premium a agencias?
2. ¿Quieres que el producto operativo actual sea `/dashboard` (leads/Supabase) o `/crm` (agencia/Neon)?
3. ¿Prefieres reducir ahora a las tres demos más vendibles o conservar las siete fuera de la navegación principal?
