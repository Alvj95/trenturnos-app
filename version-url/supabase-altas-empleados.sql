-- TrenTurnos · Altas de empleados nuevos (acceso provisional)
-- Pegar en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez sin problema.
alter table public.solicitudes_acceso
  add column if not exists sede_provisional text,
  add column if not exists fecha_ingreso date,
  add column if not exists caducada_en timestamptz;
