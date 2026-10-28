-- ═══════════════════════════════════════════════════════════════════
--  TrenTurnos V5 · Tablón de cambios de vacaciones con compañeros
--  Supabase → SQL Editor → New query → pegar todo → Run.
--  Se puede ejecutar más de una vez sin problema.
--
--  · Cada uno publica qué parte de sus vacaciones da (días) y qué busca.
--  · Los compañeros de la misma base y año dicen «Me interesa» y ofrecen
--    sus días a cambio. Quien publicó acepta una oferta → «acordado».
--  · Cualquiera de los dos lo marca como aprobado por la empresa.
--  · Las tablas no se leen ni escriben directamente: solo con estas
--    funciones (RLS activado y sin permisos para anon/authenticated).
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

create table if not exists public.vac_cambios (
  id         uuid primary key default gen_random_uuid(),
  sede       text not null,
  anio       int  not null,
  mat        text not null,
  nombre     text not null,
  rot        text,
  da         jsonb not null,               -- ["2026-06-23", ...] días que da
  busca      text not null default 'cualquiera', -- cualquiera | mes:7 | texto libre
  nota       text,
  estado     text not null default 'activa',     -- activa | acordada | aprobada | retirada
  interes_ok uuid,                               -- oferta aceptada
  creado_en  timestamptz not null default now()
);
create index if not exists vac_cambios_sede on public.vac_cambios (sede, anio, estado);

create table if not exists public.vac_cambios_interes (
  id        uuid primary key default gen_random_uuid(),
  cambio_id uuid not null references public.vac_cambios(id) on delete cascade,
  mat       text not null,
  nombre    text not null,
  rot       text,
  ofrece    jsonb not null,                -- días que ofrece a cambio
  nota      text,
  estado    text not null default 'pendiente', -- pendiente | aceptada | rechazada | retirada
  creado_en timestamptz not null default now()
);
create index if not exists vac_cambios_interes_cambio on public.vac_cambios_interes (cambio_id);

alter table public.vac_cambios enable row level security;
alter table public.vac_cambios_interes enable row level security;
revoke all on public.vac_cambios from anon, authenticated;
revoke all on public.vac_cambios_interes from anon, authenticated;

-- Comprobaciones comunes
create or replace function public.vc_check(p_mat text, p_dias jsonb) returns void
language plpgsql immutable as $$
begin
  if coalesce(p_mat,'') !~ '^\d{4,10}$' then raise exception 'matrícula no válida'; end if;
  if p_dias is null or jsonb_typeof(p_dias) <> 'array' or jsonb_array_length(p_dias) < 1 or jsonb_array_length(p_dias) > 31 then
    raise exception 'días no válidos';
  end if;
end $$;

-- 1) Publicar lo que das
create or replace function public.vc_publicar(p_sede text, p_anio int, p_mat text, p_nombre text, p_rot text,
  p_da jsonb, p_busca text, p_nota text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform vc_check(p_mat, p_da);
  if (select count(*) from vac_cambios where mat = p_mat and estado = 'activa') >= 6 then
    raise exception 'ya tienes 6 cambios publicados';
  end if;
  insert into vac_cambios (sede, anio, mat, nombre, rot, da, busca, nota)
  values (lower(trim(p_sede)), p_anio, p_mat, left(p_nombre,80), left(p_rot,6), p_da, left(coalesce(p_busca,'cualquiera'),60), left(p_nota,300))
  returning id into v_id;
  return v_id;
end $$;

-- 2) Tablón: lo de tu base y año (activos, y todo lo tuyo)
create or replace function public.vc_listar(p_sede text, p_anio int, p_mat text)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'cambios', coalesce((
      select jsonb_agg(to_jsonb(c) || jsonb_build_object(
        'n_interes', (select count(*) from vac_cambios_interes i where i.cambio_id = c.id and i.estado = 'pendiente'),
        'intereses', case when c.mat = p_mat then coalesce((select jsonb_agg(to_jsonb(i) order by i.creado_en)
                     from vac_cambios_interes i where i.cambio_id = c.id and i.estado <> 'retirada'), '[]'::jsonb) else null end,
        'mi_interes', (select to_jsonb(i) from vac_cambios_interes i where i.cambio_id = c.id and i.mat = p_mat and i.estado <> 'retirada' order by i.creado_en desc limit 1),
        'acuerdo', case when c.interes_ok is not null and (c.mat = p_mat or exists (select 1 from vac_cambios_interes i where i.id = c.interes_ok and i.mat = p_mat))
                   then (select to_jsonb(i) from vac_cambios_interes i where i.id = c.interes_ok) else null end
      ) order by c.creado_en desc)
      from vac_cambios c
      where c.sede = lower(trim(p_sede)) and c.anio = p_anio
        and (c.estado = 'activa' or c.mat = p_mat
             or exists (select 1 from vac_cambios_interes i where i.cambio_id = c.id and i.mat = p_mat and i.estado <> 'retirada'))
    ), '[]'::jsonb));
$$;

-- 3) «Me interesa»: ofreces tus días a cambio
create or replace function public.vc_interes(p_cambio uuid, p_mat text, p_nombre text, p_rot text, p_ofrece jsonb, p_nota text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_c vac_cambios;
begin
  perform vc_check(p_mat, p_ofrece);
  select * into v_c from vac_cambios where id = p_cambio;
  if v_c.id is null or v_c.estado <> 'activa' then raise exception 'este cambio ya no está disponible'; end if;
  if v_c.mat = p_mat then raise exception 'es tu propio cambio'; end if;
  update vac_cambios_interes set estado = 'retirada' where cambio_id = p_cambio and mat = p_mat and estado = 'pendiente';
  insert into vac_cambios_interes (cambio_id, mat, nombre, rot, ofrece, nota)
  values (p_cambio, p_mat, left(p_nombre,80), left(p_rot,6), p_ofrece, left(p_nota,300))
  returning id into v_id;
  return v_id;
end $$;

-- 4) Quien publicó acepta una oferta → acordado
create or replace function public.vc_aceptar(p_interes uuid, p_mat text)
returns void language plpgsql security definer set search_path = public as $$
declare v_i vac_cambios_interes;
begin
  select * into v_i from vac_cambios_interes where id = p_interes;
  if v_i.id is null or v_i.estado <> 'pendiente' then raise exception 'oferta no disponible'; end if;
  if not exists (select 1 from vac_cambios where id = v_i.cambio_id and mat = p_mat and estado = 'activa') then
    raise exception 'no puedes aceptar esta oferta';
  end if;
  update vac_cambios_interes set estado = 'aceptada' where id = p_interes;
  update vac_cambios_interes set estado = 'rechazada' where cambio_id = v_i.cambio_id and id <> p_interes and estado = 'pendiente';
  update vac_cambios set estado = 'acordada', interes_ok = p_interes where id = v_i.cambio_id;
end $$;

-- 5) Aprobado por la empresa (cualquiera de los dos)
create or replace function public.vc_aprobar(p_cambio uuid, p_mat text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update vac_cambios c set estado = 'aprobada'
  where c.id = p_cambio and c.estado = 'acordada'
    and (c.mat = p_mat or exists (select 1 from vac_cambios_interes i where i.id = c.interes_ok and i.mat = p_mat));
  if not found then raise exception 'no se pudo marcar como aprobado'; end if;
end $$;

-- 6) Retirar tu publicación o tu oferta (o deshacer un acuerdo antes de aprobarlo)
create or replace function public.vc_retirar(p_cambio uuid, p_mat text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update vac_cambios set estado = 'retirada' where id = p_cambio and mat = p_mat and estado in ('activa','acordada');
  if not found then raise exception 'no se pudo retirar'; end if;
end $$;
create or replace function public.vc_retirar_interes(p_interes uuid, p_mat text)
returns void language plpgsql security definer set search_path = public as $$
declare v_i vac_cambios_interes;
begin
  select * into v_i from vac_cambios_interes where id = p_interes and mat = p_mat;
  if v_i.id is null then raise exception 'oferta no encontrada'; end if;
  update vac_cambios_interes set estado = 'retirada' where id = p_interes;
  -- si ya estaba acordado (sin aprobar), el cambio vuelve a estar disponible
  update vac_cambios set estado = 'activa', interes_ok = null where id = v_i.cambio_id and interes_ok = p_interes and estado = 'acordada';
end $$;

grant execute on function public.vc_publicar(text,int,text,text,text,jsonb,text,text) to anon, authenticated;
grant execute on function public.vc_listar(text,int,text) to anon, authenticated;
grant execute on function public.vc_interes(uuid,text,text,text,jsonb,text) to anon, authenticated;
grant execute on function public.vc_aceptar(uuid,text) to anon, authenticated;
grant execute on function public.vc_aprobar(uuid,text) to anon, authenticated;
grant execute on function public.vc_retirar(uuid,text) to anon, authenticated;
grant execute on function public.vc_retirar_interes(uuid,text) to anon, authenticated;
