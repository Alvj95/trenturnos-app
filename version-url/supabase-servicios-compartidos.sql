-- ═══════════════════════════════════════════════════════════════════
-- TrenTurnos · Servicios a bordo: COMPARTIR EL MOL CON UN COMPAÑERO
-- Ejecutar UNA vez en Supabase → SQL Editor → New query → Run.
-- Se puede volver a ejecutar sin problema (no borra nada que funcione).
--
-- Cómo protege los datos:
--  · La tabla NO se puede leer ni escribir directamente desde la app
--    (RLS activado y sin permisos): solo a través de las funciones de abajo.
--  · Para ABRIR un MOL compartido hace falta el código de 4 cifras que ve
--    quien lo comparte (5 intentos como máximo; luego se anula).
--  · Una vez abierto, cada móvil usa una clave larga aleatoria (token)
--    para sincronizar lo marcado.
--  · Todo se borra solo a las 24 h (o antes, con "Dejar de compartir").
--  · Los nombres de clientes solo se envían si quien comparte lo elige.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

create table if not exists public.servicios_compartidos (
  id            uuid primary key default gen_random_uuid(),
  de_matricula  text not null,
  para_matricula text not null,
  pin           text not null,                 -- código de 4 cifras para abrirlo
  intentos      int  not null default 0,
  token_emisor  text not null default encode(gen_random_bytes(24),'hex'),
  token_receptor text,
  tren          text,
  fecha         text,
  resumen       text,
  sincronizar   boolean not null default true,
  datos         jsonb not null,                -- servicios ya leídos del MOL (no el PDF)
  marcas        jsonb not null default '{}'::jsonb, -- {sid: {s:servido, u:'si'|'no'|null, t:fecha}}
  estado        text not null default 'pendiente', -- pendiente | aceptado | rechazado
  creado_en     timestamptz not null default now(),
  caduca_en     timestamptz not null default now() + interval '24 hours'
);
create index if not exists servicios_compartidos_para on public.servicios_compartidos (para_matricula);

alter table public.servicios_compartidos enable row level security;
revoke all on public.servicios_compartidos from anon, authenticated;

-- Limpieza: lo caducado se borra en cada uso.
create or replace function public.sv_limpiar() returns void
language sql security definer set search_path = public as $$
  delete from servicios_compartidos where caduca_en < now();
$$;

-- 1) Compartir (móvil de empresa). Devuelve id y token del emisor.
create or replace function public.sv_compartir(
  p_de text, p_para text, p_pin text, p_tren text, p_fecha text, p_resumen text,
  p_sincronizar boolean, p_datos jsonb)
returns table(id uuid, token text)
language plpgsql security definer set search_path = public as $$
begin
  perform sv_limpiar();
  if coalesce(p_de,'') !~ '^[0-9A-Za-z]{3,12}$' or coalesce(p_para,'') !~ '^[0-9A-Za-z]{3,12}$'
     or coalesce(p_pin,'') !~ '^[0-9]{4}$' or p_de = p_para then
    raise exception 'datos no válidos';
  end if;
  if pg_column_size(p_datos) > 400000 then raise exception 'MOL demasiado grande'; end if;
  return query
    insert into servicios_compartidos(de_matricula, para_matricula, pin, tren, fecha, resumen, sincronizar, datos)
    values (p_de, p_para, p_pin, left(p_tren,20), left(p_fecha,20), left(p_resumen,200), coalesce(p_sincronizar,true), p_datos)
    returning servicios_compartidos.id, servicios_compartidos.token_emisor;
end $$;

-- 2) Avisos pendientes para una matrícula (solo datos generales, sin el MOL).
create or replace function public.sv_pendientes(p_matricula text)
returns table(id uuid, de_matricula text, tren text, fecha text, resumen text, creado_en timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  perform sv_limpiar();
  return query select s.id, s.de_matricula, s.tren, s.fecha, s.resumen, s.creado_en
    from servicios_compartidos s
    where s.para_matricula = p_matricula and s.estado = 'pendiente'
    order by s.creado_en desc limit 5;
end $$;

-- 3) Abrir con el código de 4 cifras: devuelve el MOL, lo marcado y un token para sincronizar.
--    Código incorrecto: no devuelve nada (y suma un intento).
create or replace function public.sv_abrir(p_id uuid, p_matricula text, p_pin text)
returns table(datos jsonb, marcas jsonb, token text, de_matricula text, tren text, fecha text, sincronizar boolean)
language plpgsql security definer set search_path = public as $$
declare r servicios_compartidos;
begin
  perform sv_limpiar();
  select * into r from servicios_compartidos s where s.id = p_id and s.para_matricula = p_matricula for update;
  if not found then raise exception 'no existe o ha caducado'; end if;
  if r.intentos >= 5 then raise exception 'demasiados intentos'; end if;
  if r.pin <> p_pin then
    -- sin "raise": así el intento fallido queda contado. La app lo ve como "código incorrecto".
    update servicios_compartidos set intentos = intentos + 1 where servicios_compartidos.id = p_id;
    return;
  end if;
  if r.token_receptor is null then
    -- gen_random_uuid() viene de serie (gen_random_bytes, en Supabase, no se ve desde aquí)
    r.token_receptor := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
    update servicios_compartidos set token_receptor = r.token_receptor, estado = 'aceptado' where servicios_compartidos.id = p_id;
  end if;
  return query select r.datos, r.marcas, r.token_receptor, r.de_matricula, r.tren, r.fecha, r.sincronizar;
end $$;

-- 4) Rechazar un aviso.
create or replace function public.sv_rechazar(p_id uuid, p_matricula text) returns void
language sql security definer set search_path = public as $$
  update servicios_compartidos set estado = 'rechazado' where id = p_id and para_matricula = p_matricula and estado = 'pendiente';
$$;

-- 5) Estado y marcas (los dos móviles, cada uno con su token).
create or replace function public.sv_estado(p_id uuid, p_token text)
returns table(estado text, marcas jsonb, sincronizar boolean)
language plpgsql security definer set search_path = public as $$
begin
  perform sv_limpiar();
  return query select s.estado, s.marcas, s.sincronizar from servicios_compartidos s
    where s.id = p_id and (s.token_emisor = p_token or s.token_receptor = p_token);
end $$;

-- 6) Guardar marcas: para cada asiento gana el cambio más reciente.
create or replace function public.sv_marcar(p_id uuid, p_token text, p_cambios jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare m jsonb; k text; v jsonb;
begin
  select s.marcas into m from servicios_compartidos s
    where s.id = p_id and s.sincronizar and (s.token_emisor = p_token or s.token_receptor = p_token) for update;
  if not found then raise exception 'no existe o ha caducado'; end if;
  for k, v in select * from jsonb_each(coalesce(p_cambios,'{}'::jsonb)) loop
    if (m->k) is null or coalesce((v->>'t')::bigint,0) > coalesce((m->k->>'t')::bigint,0) then
      m := jsonb_set(m, array[k], v, true);
    end if;
  end loop;
  update servicios_compartidos set marcas = m where id = p_id;
  return m;
end $$;

-- 7) Dejar de compartir (solo quien lo compartió): se borra.
create or replace function public.sv_retirar(p_id uuid, p_token text) returns void
language sql security definer set search_path = public as $$
  delete from servicios_compartidos where id = p_id and token_emisor = p_token;
$$;

grant execute on function public.sv_compartir(text,text,text,text,text,text,boolean,jsonb) to anon, authenticated;
grant execute on function public.sv_pendientes(text) to anon, authenticated;
grant execute on function public.sv_abrir(uuid,text,text) to anon, authenticated;
grant execute on function public.sv_rechazar(uuid,text) to anon, authenticated;
grant execute on function public.sv_estado(uuid,text) to anon, authenticated;
grant execute on function public.sv_marcar(uuid,text,jsonb) to anon, authenticated;
grant execute on function public.sv_retirar(uuid,text) to anon, authenticated;
revoke execute on function public.sv_limpiar() from anon, authenticated;
