# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Luenio sirve a una combinación de pymes y equipos comerciales colombianos que necesitan captar, organizar y convertir oportunidades sin depender de un equipo técnico propio. La oferta contempla negocios de distintos sectores —incluidas agencias, inmobiliarias, gimnasios, restaurantes y ecommerce— sin establecer por ahora un único nicho prioritario.

Los visitantes públicos evalúan y solicitan soluciones de captación y automatización. Los clientes y operadores invitados gestionan leads, seguimientos y actividad comercial desde un espacio privado.

## Product Purpose

Luenio crea e implementa sistemas comerciales digitales hechos a medida que combinan landing pages, captación de leads, automatización con IA y seguimiento operativo. Existe para que los negocios puedan responder, organizar y dar continuidad a sus oportunidades con mayor rapidez y orden.

El éxito significa poner en funcionamiento una solución útil con rapidez, acompañar su adopción y ayudar al cliente a convertir el interés recibido en acciones comerciales concretas.

## Positioning

Luenio no entrega únicamente una página ni ofrece un CRM genérico de autoservicio. Su posición es la de un servicio integral hecho a medida: diseña la experiencia de captación, conecta la automatización comercial, implementa las herramientas necesarias y acompaña al cliente durante el proceso.

La combinación diferenciadora es personalización, automatización comercial, rapidez de implementación y acompañamiento.

## Operating Context

- El sitio público presenta servicios, casos demostrativos por nicho y una ruta de cotización.
- La venta comienza mediante una solicitud de cotización; no existe compra pública de autoservicio en la versión actual.
- Los formularios y canales como WhatsApp capturan solicitudes con contexto.
- El CRM privado permite trabajar con scoring por reglas, pipeline, cola de tareas, notas, etiquetas, responsables, próximos pasos, historial de contacto, importación y exportación.
- Los administradores incorporan usuarios mediante invitaciones privadas; no existe registro público.
- Las automatizaciones pueden conectar formularios, correo, WhatsApp, CRM y flujos de n8n.

## Capabilities and Constraints

- Sitio y aplicación web en español, con foco comercial inicial en Colombia.
- Landing pages y experiencias demostrativas para varios nichos.
- Captura segura de leads y persistencia antes de intentar su entrega a automatizaciones externas.
- Scoring de intención basado en reglas léxicas; no debe presentarse como evaluación realizada por un LLM.
- CRM privado con pipeline, asignación, seguimiento, reportes operativos y herramientas de contacto.
- Automatizaciones e integraciones configuradas según las necesidades de cada cliente.
- Acceso al CRM únicamente mediante invitación; MFA obligatorio para administradores en producción.
- Facturación pública de autoservicio desactivada en la versión actual.
- Las demos no escriben en los datos reales del CRM y no deben presentarse como implementaciones de clientes.
- Stack actual: HTML, CSS y JavaScript con Vite; Node.js; Supabase o almacenamiento local de desarrollo; n8n; Cloudflare, Caddy y Docker.
- Decisión abierta: no existe todavía un sector principal confirmado dentro de la combinación de audiencias.

## Brand Commitments

- Nombre del producto y servicio: Luenio.
- Comunicación principal en español, clara, directa y orientada a resultados comerciales comprensibles.
- La propuesta debe conservar el carácter de servicio personalizado y acompañado; no debe describirse como una plantilla genérica ni como una plataforma completamente autoservicio.
- Activos oficiales vigentes: `public/brand/isotipo.svg`, `public/brand/logotipo.svg`, `public/favicon.png`, `public/apple-touch-icon.png` y `public/og-luenio.png`.

## Evidence on Hand

- Producto funcional con sitio público, cotización, autenticación por invitación y CRM privado.
- Demos interactivas y landings demostrativas para agencias, ecommerce, gimnasios, inmobiliarias, restaurantes, veterinarias y centros de estética en `apps/web/pages/`.
- Documentación funcional y operativa en `README.md`, `docs/CRM.md`, `docs/ARCHITECTURE.md`, `docs/API.md` y `docs/RUNBOOK.md`.
- Suite automatizada con pruebas de seguridad, accesibilidad, arquitectura, API, almacenamiento, demos y flujos principales en `scripts/`.
- Recursos gráficos y fotografías demostrativas en `public/assets/` y `public/brand/`.
- No hay testimonios, clientes, métricas de resultados, casos comerciales verificados ni reconocimientos públicos confirmados. El trabajo futuro no debe fabricarlos ni presentar las demos como evidencia de clientes reales.

## Product Principles

1. Entregar una solución integral que conecte captación, automatización y seguimiento, no piezas aisladas.
2. Adaptar la implementación al negocio y su operación en lugar de imponer una plantilla genérica.
3. Reducir el tiempo entre la necesidad comercial y una solución funcionando.
4. Acompañar la adopción para que la tecnología se convierta en acciones comerciales sostenibles.
5. Comunicar con precisión qué es real, qué es demostrativo y qué está automatizado.

## Accessibility & Inclusion

Las superficies web deben mantener compatibilidad responsive y cumplir WCAG 2.0 nivel A/AA como mínimo. La suite de navegador debe continuar bloqueando violaciones de accesibilidad críticas o graves.
