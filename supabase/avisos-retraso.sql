-- ═══════════════════════════════════════════════════════════════════
--  TrenTurnos V5 · Avisos de retraso automáticos
--  Supabase → SQL Editor → New query → pegar todo → Run.
--  Se puede ejecutar más de una vez sin problema.
--
--  · La app sube los trenes de cada uno (hoy y los próximos días), ya con
--    los cambios de turno aplicados, y si quiere avisos.
--  · La función «vigila-retrasos» (Edge Function) se ejecuta sola cada
--    5 minutos: mira Renfe en directo, avisa cada 20 min si el tren va con
--    retraso y, al llegar, guarda el retraso de llegada y avisa.
--  · Si Renfe no da datos de un tren, no se avisa ni se guarda nada.
--  · Al abrir la app, sale el pop-up para añadir el retraso al turno.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.vig_viajes (
  id          bigint generated always as identity primary key,
  mat         text not null,
  fecha       date not null,
  tramo       int  not null,              -- 1 ida · 2 vuelta
  tren        text not null,
  sale        text,                       -- 'HH:MM' hora de salida prevista
  llega       text,                       -- 'HH:MM' hora de llegada prevista
  destino     text,
  en_base     boolean not null default false,  -- llega a la base (deje 20) o fuera (deje 15)
  cuenta      boolean not null default true,   -- si el retraso cuenta (horas/dinero) o solo se anota
  tipo        text,                       -- ordinario · htdl · art5152 …
  cambio_con  text,                       -- si es un cambio de turno, con quién
  -- lo que va viendo el vigilante
  ult_ret     int,
  ult_est     text,
  ult_visto   timestamptz,
  ult_aviso   timestamptz,
  aviso_ret   int,
  llegado     boolean not null default false,
  ret_llegada int,
  resuelto    text,                       -- null · 'anadido' · 'anotado' · 'no'
  creado_en   timestamptz not null default now(),
  unique (mat, fecha, tramo)
);
create index if not exists vig_viajes_fecha on public.vig_viajes (fecha, llegado);

create table if not exists public.vig_ajustes (
  mat      text primary key,
  activo   boolean not null default true,
  cada20   boolean not null default true,
  llegada  boolean not null default true,
  actualizado_en timestamptz not null default now()
);

alter table public.vig_viajes enable row level security;
alter table public.vig_ajustes enable row level security;
revoke all on public.vig_viajes from anon, authenticated;
revoke all on public.vig_ajustes from anon, authenticated;

-- 1) La app sube tus trenes de ayer a +31 días (sustituye lo que no ha empezado todavía)
create or replace function public.vig_subir(p_mat text, p_viajes jsonb, p_ajustes jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare v jsonb; n int := 0;
begin
  if coalesce(p_mat,'') !~ '^\d{4,10}$' then raise exception 'matrícula no válida'; end if;
  if p_viajes is null or jsonb_typeof(p_viajes) <> 'array' or jsonb_array_length(p_viajes) > 200 then raise exception 'viajes no válidos'; end if;
  insert into vig_ajustes (mat, activo, cada20, llegada, actualizado_en)
  values (p_mat, coalesce((p_ajustes->>'activo')::boolean, true), coalesce((p_ajustes->>'cada20')::boolean, true), coalesce((p_ajustes->>'llegada')::boolean, true), now())
  on conflict (mat) do update set activo = excluded.activo, cada20 = excluded.cada20, llegada = excluded.llegada, actualizado_en = now();
  -- se borran los viajes futuros que ya no están (cambios de turno, turnos borrados…)
  delete from vig_viajes w where w.mat = p_mat and w.fecha >= current_date and w.ult_visto is null and not w.llegado
    and not exists (select 1 from jsonb_array_elements(p_viajes) x
                    where (x->>'fecha')::date = w.fecha and (x->>'tramo')::int = w.tramo and x->>'tren' = w.tren);
  for v in select * from jsonb_array_elements(p_viajes) loop
    if coalesce(v->>'tren','') !~ '^\d{2,6}$' or (v->>'fecha')::date < current_date - 1 or (v->>'fecha')::date > current_date + 40 then continue; end if;
    insert into vig_viajes (mat, fecha, tramo, tren, sale, llega, destino, en_base, cuenta, tipo, cambio_con)
    values (p_mat, (v->>'fecha')::date, (v->>'tramo')::int, v->>'tren', left(v->>'sale',5), left(v->>'llega',5), left(v->>'destino',60),
            coalesce((v->>'en_base')::boolean,false), coalesce((v->>'cuenta')::boolean,true), left(v->>'tipo',20), left(v->>'cambio_con',80))
    on conflict (mat, fecha, tramo) do update set
      tren = excluded.tren, sale = excluded.sale, llega = excluded.llega, destino = excluded.destino, en_base = excluded.en_base,
      cuenta = excluded.cuenta, tipo = excluded.tipo, cambio_con = excluded.cambio_con
      where vig_viajes.ult_visto is null and not vig_viajes.llegado;
    n := n + 1;
  end loop;
  delete from vig_viajes where fecha < current_date - 7;
  return n;
end $$;

-- 2) Llegadas con retraso pendientes de añadir al turno
create or replace function public.vig_pendientes(p_mat text)
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(w) order by w.fecha, w.tramo), '[]'::jsonb)
  from vig_viajes w
  where w.mat = p_mat and w.llegado and coalesce(w.ret_llegada,0) > 0 and w.resuelto is null and w.fecha >= current_date - 3;
$$;

-- 3) Marcar como resuelto (añadido, anotado o «ahora no»)
create or replace function public.vig_resolver(p_id bigint, p_mat text, p_como text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update vig_viajes set resuelto = left(p_como,10) where id = p_id and mat = p_mat;
end $$;

grant execute on function public.vig_subir(text,jsonb,jsonb) to anon, authenticated;
grant execute on function public.vig_pendientes(text) to anon, authenticated;
grant execute on function public.vig_resolver(bigint,text,text) to anon, authenticated;

-- 4) Que el vigilante se ejecute solo cada 5 minutos
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule(jobid) from cron.job where jobname = 'vigila-retrasos';
select cron.schedule('vigila-retrasos', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://xoftsdupynwhzxsiusox.supabase.co/functions/v1/vigila-retrasos',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb)
$$);
