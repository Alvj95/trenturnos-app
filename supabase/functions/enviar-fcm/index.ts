// TrenTurnos · enviar-fcm
// Manda a los móviles Android (Firebase Cloud Messaging) cada aviso que la app
// apunta en la tabla eventos_push. La versión web tiene su propia función:
// esta no la sustituye, va en paralelo.
//
// Se activa con un Database Webhook de Supabase: tabla eventos_push, evento INSERT.
// Secreto necesario (Edge Functions → Secrets): FCM_SERVICE_ACCOUNT = el .json
// completo de la cuenta de servicio de Firebase. SUPABASE_URL y
// SUPABASE_SERVICE_ROLE_KEY ya los pone Supabase.

type CuentaServicio = { project_id: string; client_email: string; private_key: string; token_uri?: string };

const env = (k: string) => (globalThis as any).Deno?.env.get(k) ?? "";

function b64url(datos: ArrayBuffer | string): string {
  const bytes = typeof datos === "string" ? new TextEncoder().encode(datos) : new Uint8Array(datos);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Permiso de Google (OAuth) firmando un JWT con la clave de la cuenta de servicio. Se reutiliza ~50 min.
let cache: { token: string; hasta: number } | null = null;
async function tokenGoogle(sa: CuentaServicio): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  if (cache && cache.hasta > ahora + 60) return cache.token;
  const aud = sa.token_uri || "https://oauth2.googleapis.com/token";
  const cab = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const cuerpo = b64url(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud, iat: ahora, exp: ahora + 3600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const clave = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const firma = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", clave, new TextEncoder().encode(cab + "." + cuerpo));
  const jwt = cab + "." + cuerpo + "." + b64url(firma);
  const r = await fetch(aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=" + encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer") + "&assertion=" + jwt,
  });
  const j = await r.json();
  if (!r.ok || !j.access_token) throw new Error("Google OAuth: " + JSON.stringify(j));
  cache = { token: j.access_token, hasta: ahora + (j.expires_in || 3600) };
  return cache.token;
}

async function rest(ruta: string, init: RequestInit = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(env("SUPABASE_URL") + "/rest/v1/" + ruta, {
    ...init,
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

export async function manejar(req: Request): Promise<Response> {
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
  let datos: any;
  try { datos = await req.json(); } catch { return json({ error: "sin datos" }, 400); }
  const ev = datos?.record;
  if (datos?.type !== "INSERT" || !ev?.matricula_destino) return json({ ignorado: true });

  const sa: CuentaServicio = JSON.parse(env("FCM_SERVICE_ACCOUNT") || "{}");
  if (!sa.project_id || !sa.private_key) return json({ error: "falta el secreto FCM_SERVICE_ACCOUNT" }, 500);

  const r = await rest("push_fcm?select=token&matricula=eq." + encodeURIComponent(String(ev.matricula_destino)));
  const moviles: { token: string }[] = r.ok ? await r.json() : [];
  if (!moviles.length) return json({ enviados: 0 });

  const acceso = await tokenGoogle(sa);
  let enviados = 0, borrados = 0;
  for (const m of moviles) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: { Authorization: "Bearer " + acceso, "Content-Type": "application/json" },
      body: JSON.stringify({ message: {
        token: m.token,
        notification: { title: String(ev.titulo || "TrenTurnos").slice(0, 200), body: String(ev.cuerpo || "").slice(0, 1000) },
        android: { priority: "HIGH", notification: { channel_id: "trenturnos", icon: "ic_stat_trenturnos", color: "#F97316", sound: "default" } },
      } }),
    });
    if (res.ok) { enviados++; continue; }
    const err = await res.text();
    // Móvil desinstalado o token caducado: se borra para no volver a intentarlo.
    if (res.status === 404 || /UNREGISTERED|registration-token-not-registered|INVALID_ARGUMENT/.test(err)) {
      await rest("push_fcm?token=eq." + encodeURIComponent(m.token), { method: "DELETE" });
      borrados++;
    } else console.error("FCM", res.status, err);
  }
  return json({ enviados, borrados });
}

(globalThis as any).Deno?.serve(manejar);
