-- Correo opcional en las consultas públicas (Supabase).
--
-- El formulario de cotización pide WhatsApp como canal obligatorio y ahora
-- acepta además un correo opcional. Aplicar contra el proyecto de Supabase
-- ANTES de desplegar el código que lo envía; el resto de supabase/schema.sql ya
-- incluye estos cambios para instalaciones nuevas.
--
-- Es idempotente: se puede ejecutar más de una vez sin efecto adicional.

alter table public.contact_inquiries
  add column if not exists email text;

-- Las dos funciones cambian de firma y de tipo de retorno, así que hay que
-- soltarlas: `create or replace` no puede hacer ninguno de los dos cambios.
drop function if exists public.luenio_store_contact_inquiry(
  text, text, text, text, text, text, text, text, text, timestamptz, integer
);
drop function if exists public.luenio_claim_contact_deliveries(timestamptz, integer, integer, text);

-- Vuelve a crear ambas desde la definición vigente en supabase/schema.sql.
-- Ejecuta ese archivo a continuación, o copia de él los bloques
-- `luenio_store_contact_inquiry` y `luenio_claim_contact_deliveries` junto con
-- sus `revoke` y `grant`.
