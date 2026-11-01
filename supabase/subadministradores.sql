-- TrenTurnos · Subadministradores (solo pueden usar «Con quién viaja» de todas las bases).
-- Supabase → SQL Editor → New query → pegar todo → Run. Se puede ejecutar más de una vez.
-- Necesita priv_es_admin() (de supabase-privacidad.sql, ya instalado).

create table if not exists public.sub_admins (
  matricula  text primary key,
  nombre     text,
  base       text,
  desde      timestamptz not null default now()
);
alter table public.sub_admins enable row level security;
revoke all on public.sub_admins from anon, authenticated;

-- ¿Esta matrícula es subadministrador? (la app lo mira al abrirse)
create or replace function public.sub_es(p_matricula text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sub_admins where matricula = upper(trim(coalesce(p_matricula,''))));
$$;

-- Solo el administrador
create or replace function public.sub_listar() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not priv_es_admin() then raise exception 'solo admin'; end if;
  return coalesce((select json_agg(s order by s.nombre) from sub_admins s), '[]'::json);
end $$;

create or replace function public.sub_agregar(p_matricula text, p_nombre text default null, p_base text default null) returns text
language plpgsql security definer set search_path = public as $$
declare m text := upper(trim(coalesce(p_matricula,'')));
begin
  if not priv_es_admin() then raise exception 'solo admin'; end if;
  if m !~ '^[0-9A-Z]{3,12}$' then raise exception 'matrícula no válida'; end if;
  insert into sub_admins (matricula, nombre, base) values (m, nullif(left(trim(coalesce(p_nombre,'')),120),''), nullif(left(trim(coalesce(p_base,'')),60),''))
  on conflict (matricula) do update set nombre = excluded.nombre, base = excluded.base;
  return 'ok';
end $$;

create or replace function public.sub_quitar(p_matricula text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not priv_es_admin() then raise exception 'solo admin'; end if;
  delete from sub_admins where matricula = upper(trim(coalesce(p_matricula,'')));
  return 'ok';
end $$;

grant execute on function public.sub_es(text) to anon, authenticated;
grant execute on function public.sub_listar() to authenticated;
grant execute on function public.sub_agregar(text,text,text) to authenticated;
grant execute on function public.sub_quitar(text) to authenticated;
