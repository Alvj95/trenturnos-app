-- TrenTurnos · «No quiero aparecer en TrenTurnos» (privacidad de datos)
-- Pegar en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez sin problema.
--
-- · privacidad_solicitudes: lo que envían los compañeros (salir de la app o pedir volver).
-- · privacidad_excluidos:   matrículas fuera de la app (las que tú has aceptado).
-- Las dos tablas quedan cerradas: solo se usan a través de las funciones de abajo.
-- Las de admin (priv_admin_*) comprueban que la sesión sea de un admin (tabla perfiles).

create table if not exists public.privacidad_solicitudes (
  id         bigserial primary key,
  tipo       text not null check (tipo in ('salida','reingreso')),
  matricula  text not null,
  nombre     text not null,
  apellidos  text not null,
  base       text not null,
  motivo     text,
  estado     text not null default 'pendiente' check (estado in ('pendiente','aceptada','rechazada')),
  creado     timestamptz not null default now(),
  resuelto   timestamptz
);
create index if not exists privacidad_solicitudes_mat on public.privacidad_solicitudes (matricula, tipo, estado);

create table if not exists public.privacidad_excluidos (
  matricula           text primary key,
  nombre              text,
  base                text,
  desde               timestamptz not null default now(),
  reingreso_denegado  timestamptz
);

alter table public.privacidad_solicitudes enable row level security;
alter table public.privacidad_excluidos  enable row level security;
revoke all on public.privacidad_solicitudes from anon, authenticated;
revoke all on public.privacidad_excluidos  from anon, authenticated;

create or replace function public.priv_es_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin');
$$;

-- Enviar una solicitud (cualquiera, sin sesión). Devuelve: 'ok', 'ya_pendiente', 'ya_fuera' o 'no_fuera'.
create or replace function public.priv_solicitar(p_tipo text, p_nombre text, p_apellidos text,
  p_matricula text, p_base text, p_motivo text default null) returns text
language plpgsql security definer set search_path = public as $$
declare m text := upper(trim(coalesce(p_matricula,'')));
begin
  if p_tipo not in ('salida','reingreso') then raise exception 'tipo no válido'; end if;
  if m !~ '^[0-9A-Z]{3,12}$' then raise exception 'matrícula no válida'; end if;
  if length(trim(coalesce(p_nombre,''))) not between 1 and 60
     or length(trim(coalesce(p_apellidos,''))) not between 1 and 80
     or length(trim(coalesce(p_base,''))) not between 1 and 60 then raise exception 'faltan datos'; end if;
  if p_tipo = 'reingreso' and length(trim(coalesce(p_motivo,''))) not between 3 and 500 then raise exception 'falta el motivo'; end if;
  if p_tipo = 'salida' and exists (select 1 from privacidad_excluidos where matricula = m) then return 'ya_fuera'; end if;
  if p_tipo = 'reingreso' and not exists (select 1 from privacidad_excluidos where matricula = m) then return 'no_fuera'; end if;
  if exists (select 1 from privacidad_solicitudes where matricula = m and tipo = p_tipo and estado = 'pendiente') then return 'ya_pendiente'; end if;
  insert into privacidad_solicitudes (tipo, matricula, nombre, apellidos, base, motivo)
  values (p_tipo, m, trim(p_nombre), trim(p_apellidos), trim(p_base), nullif(left(trim(coalesce(p_motivo,'')),500),''));
  return 'ok';
end $$;

-- Estado de una matrícula: 'normal', 'salida_pendiente', 'fuera', 'fuera_reingreso_pendiente' o 'fuera_reingreso_denegado'.
create or replace function public.priv_estado(p_matricula text) returns text
language plpgsql stable security definer set search_path = public as $$
declare m text := upper(trim(coalesce(p_matricula,''))); e privacidad_excluidos%rowtype;
begin
  select * into e from privacidad_excluidos where matricula = m;
  if found then
    if exists (select 1 from privacidad_solicitudes where matricula = m and tipo = 'reingreso' and estado = 'pendiente') then return 'fuera_reingreso_pendiente'; end if;
    if e.reingreso_denegado is not null then return 'fuera_reingreso_denegado'; end if;
    return 'fuera';
  end if;
  if exists (select 1 from privacidad_solicitudes where matricula = m and tipo = 'salida' and estado = 'pendiente') then return 'salida_pendiente'; end if;
  return 'normal';
end $$;

-- Matrículas fuera de la app (la app las quita del Horario General, compañeros y buscador).
create or replace function public.priv_excluidos() returns setof text
language sql stable security definer set search_path = public as $$
  select matricula from public.privacidad_excluidos;
$$;

-- ── Admin ──
create or replace function public.priv_admin_listar() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not priv_es_admin() then raise exception 'solo admin'; end if;
  return json_build_object(
    'solicitudes', coalesce((select json_agg(s order by s.creado) from privacidad_solicitudes s where s.estado = 'pendiente'), '[]'::json),
    'excluidos',  coalesce((select json_agg(e order by e.desde desc) from privacidad_excluidos e), '[]'::json));
end $$;

-- Aceptar o rechazar una solicitud. Salida aceptada → fuera de la app. Reingreso aceptado → vuelve.
create or replace function public.priv_admin_resolver(p_id bigint, p_aceptar boolean) returns text
language plpgsql security definer set search_path = public as $$
declare s privacidad_solicitudes%rowtype;
begin
  if not priv_es_admin() then raise exception 'solo admin'; end if;
  select * into s from privacidad_solicitudes where id = p_id and estado = 'pendiente';
  if not found then return 'no_existe'; end if;
  update privacidad_solicitudes set estado = case when p_aceptar then 'aceptada' else 'rechazada' end, resuelto = now()
   where matricula = s.matricula and tipo = s.tipo and estado = 'pendiente';
  if s.tipo = 'salida' and p_aceptar then
    insert into privacidad_excluidos (matricula, nombre, base) values (s.matricula, s.nombre||' '||s.apellidos, s.base)
    on conflict (matricula) do update set nombre = excluded.nombre, base = excluded.base, desde = now(), reingreso_denegado = null;
  elsif s.tipo = 'reingreso' and p_aceptar then
    delete from privacidad_excluidos where matricula = s.matricula;
  elsif s.tipo = 'reingreso' then
    update privacidad_excluidos set reingreso_denegado = now() where matricula = s.matricula;
  end if;
  return 'ok';
end $$;

-- Volver a dejar entrar a una matrícula sin que lo haya pedido.
create or replace function public.priv_admin_desbloquear(p_matricula text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not priv_es_admin() then raise exception 'solo admin'; end if;
  delete from privacidad_excluidos where matricula = upper(trim(p_matricula));
  update privacidad_solicitudes set estado = 'aceptada', resuelto = now()
   where matricula = upper(trim(p_matricula)) and tipo = 'reingreso' and estado = 'pendiente';
  return 'ok';
end $$;

revoke all on function public.priv_es_admin() from public;
grant execute on function public.priv_solicitar(text,text,text,text,text,text) to anon, authenticated;
grant execute on function public.priv_estado(text) to anon, authenticated;
grant execute on function public.priv_excluidos() to anon, authenticated;
grant execute on function public.priv_admin_listar() to authenticated;
grant execute on function public.priv_admin_resolver(bigint,boolean) to authenticated;
grant execute on function public.priv_admin_desbloquear(text) to authenticated;
