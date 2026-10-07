-- ═══════════════════════════════════════════════════════════════════
-- TrenTurnos · NOTIFICACIONES EN LA APP ANDROID (Firebase)
-- Ejecutar UNA vez en Supabase → SQL Editor → New query → Run.
-- Se puede volver a ejecutar sin problema.
--
-- La versión web sigue con su sistema (push_subscriptions + su función):
-- esto no lo toca. Aquí solo se guardan los móviles Android (su "token"
-- de Firebase) con la matrícula; la función enviar-fcm los usa para
-- mandar cada aviso que se apunta en eventos_push.
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.push_fcm (
  token       text primary key,          -- identificador del móvil en Firebase
  matricula   text not null,
  creado      timestamptz not null default now(),
  actualizado timestamptz not null default now()
);
create index if not exists push_fcm_matricula on public.push_fcm (matricula);

-- La tabla no se puede leer ni escribir directamente desde la app.
alter table public.push_fcm enable row level security;
revoke all on public.push_fcm from anon, authenticated;

-- La app registra (o renueva) su móvil con esta función.
create or replace function public.registrar_token_fcm(p_matricula text, p_token text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_matricula,'') !~ '^[0-9A-Za-z]{3,12}$' or length(coalesce(p_token,'')) not between 20 and 4096 then
    raise exception 'datos no válidos';
  end if;
  insert into push_fcm(token, matricula) values (p_token, p_matricula)
    on conflict (token) do update set matricula = excluded.matricula, actualizado = now();
  -- como mucho 5 móviles por matrícula (los más recientes)
  delete from push_fcm where matricula = p_matricula and token not in (
    select token from push_fcm where matricula = p_matricula order by actualizado desc limit 5);
end $$;

grant execute on function public.registrar_token_fcm(text,text) to anon, authenticated;
