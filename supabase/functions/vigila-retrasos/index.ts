// TrenTurnos · vigila-retrasos
// Se ejecuta sola cada 5 minutos (pg_cron, ver supabase/avisos-retraso.sql).
//  · Lee los trenes de hoy de quien tiene avisos activados (tabla vig_viajes).
//  · Mira el visor público de Renfe: si el tren va con retraso, avisa cada 20 min.
//  · Al llegar, guarda el retraso de llegada y avisa para añadirlo al turno.
//  · Si Renfe no da datos de un tren, no avisa ni guarda nada.
// Los avisos se mandan apuntándolos en eventos_push (como el resto de la app):
// el webhook de enviar-fcm los manda al móvil.
//
// En Supabase: Edge Functions → Deploy a new function → nombre «vigila-retrasos»
// → pegar → Deploy. «Verify JWT» desactivado.

type Obj = Record<string, any>;
const env = (k: string) => (globalThis as any).Deno?.env.get(k) ?? "";
const RENFE = "https://tiempo-real.largorecorrido.renfe.com";
const UMBRAL = 5;       // minutos a partir de los que se considera «con retraso»
const CADA = 20;        // minutos entre avisos mientras va con retraso
const sinCeros = (s: unknown) => String(s ?? "").replace(/^0+/, "");

// Hora de Madrid como minutos desde medianoche y fecha YYYY-MM-DD
export function madrid(d: Date) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)?.value || "0";
  const h = +g("hour") % 24;
  return { fecha: `${g("year")}-${g("month")}-${g("day")}`, min: h * 60 + +g("minute") };
}
const aMin = (h: string | null) => { const m = /(\d{1,2}):(\d{2})/.exec(h || ""); return m ? +m[1] * 60 + +m[2] : null; };
function diasEntre(a: string, b: string) { return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000); }

// Decide qué hacer con cada viaje. No toca nada: devuelve los cambios y los avisos.
export function procesar(viajes: Obj[], flota: Record<string, Obj>, est: Record<string, string>, ahora: Date, ajustes: Record<string, Obj>) {
  const M = madrid(ahora), cambios: { id: number; set: Obj }[] = [], avisos: Obj[] = [];
  for (const v of viajes) {
    const aj = ajustes[v.mat] || { activo: true, cada20: true, llegada: true };
    // minutos «ahora» relativos al día del viaje (para trenes que cruzan la medianoche)
    const ah = M.min + diasEntre(v.fecha, M.fecha) * 1440;
    const sale = aMin(v.sale), llega0 = aMin(v.llega);
    if (sale == null || llega0 == null) continue;
    const llega = llega0 < sale ? llega0 + 1440 : llega0;
    if (ah < sale - 30 || !aj.activo) continue;
    const vivo = flota[sinCeros(v.tren)];
    const ret = vivo && vivo.ultRetraso !== "" && vivo.ultRetraso != null && !isNaN(+vivo.ultRetraso) && Math.abs(+vivo.ultRetraso) <= 600 ? +vivo.ultRetraso : null;
    if (vivo && ret != null) {
      const set: Obj = { ult_ret: ret, ult_visto: ahora.toISOString(), ult_est: est[sinCeros(vivo.codEstAnt)] || est[sinCeros(vivo.codEstSig)] || null };
      // ¿ya ha llegado? (sigue saliendo en el visor pero la hora real de llegada ya pasó de largo)
      if (ah > llega + Math.max(ret, 0) + 15) { set.llegado = true; set.ret_llegada = Math.max(ret, 0); }
      else if (aj.cada20 && ret >= UMBRAL && (!v.ult_aviso || (ahora.getTime() - Date.parse(v.ult_aviso)) >= CADA * 60000 - 30000)) {
        set.ult_aviso = ahora.toISOString(); set.aviso_ret = ret;
        avisos.push({ matricula_destino: v.mat, titulo: `🚆 El ${v.tren} va con +${ret} min`,
          cuerpo: (set.ult_est ? `Última referencia: ${set.ult_est}. ` : "") + `Te aviso cada ${CADA} min mientras vaya con retraso.` + (v.cambio_con ? ` (Cambio con ${v.cambio_con})` : "") });
      }
      cambios.push({ id: v.id, set });
      if (set.llegado && set.ret_llegada > 0 && aj.llegada) avisos.push(avisoLlegada(v, set.ret_llegada));
    } else if (v.ult_visto) {
      // Ya no sale en el visor: ha llegado (si ya es su hora). El retraso de llegada es el último visto.
      if (ah >= llega - 10) {
        const r = Math.max(v.ult_ret || 0, 0);
        cambios.push({ id: v.id, set: { llegado: true, ret_llegada: r } });
        if (r > 0 && aj.llegada) avisos.push(avisoLlegada(v, r));
      }
    } else if (ah > llega + 180) {
      // Renfe nunca dio datos de este tren: se cierra sin avisar ni guardar retraso
      cambios.push({ id: v.id, set: { llegado: true, ret_llegada: null } });
    }
  }
  return { cambios, avisos };
}
function avisoLlegada(v: Obj, r: number) {
  const deje = v.en_base ? 20 : 15;
  return { matricula_destino: v.mat, titulo: `🚆 El ${v.tren} llegó${v.destino ? " a " + v.destino : ""} con +${r} min`,
    cuerpo: `${v.tramo === 2 ? "Vuelta" : "Ida"} · +${r} de retraso + ${deje} de deje = +${r + deje} min. Abre TrenTurnos para ${v.cuenta ? "añadirlo" : "anotarlo"} en tu turno.` };
}

async function rest(ruta: string, init: RequestInit = {}) {
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  return fetch(env("SUPABASE_URL") + "/rest/v1/" + ruta, { ...init,
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json", Prefer: "return=minimal", ...(init.headers || {}) } });
}
let estCache: { t: number; m: Record<string, string> } | null = null;
async function estaciones() {
  if (estCache && Date.now() - estCache.t < 86400000) return estCache.m;
  const m: Record<string, string> = {};
  try { const g = await (await fetch(RENFE + "/data/estaciones.geojson")).json();
    for (const f of g.features || []) m[sinCeros(f.properties.CODIGO)] = String(f.properties.NOMBRE || ""); } catch { /* sin nombres */ }
  estCache = { t: Date.now(), m }; return m;
}

export async function manejar(_req: Request): Promise<Response> {
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json" } });
  const ahora = new Date(), M = madrid(ahora);
  const ayer = new Date(Date.parse(M.fecha + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);
  const rv = await rest(`vig_viajes?select=*&llegado=eq.false&fecha=gte.${ayer}&fecha=lte.${M.fecha}`, { headers: { Prefer: "" } });
  const viajes: Obj[] = rv.ok ? await rv.json() : [];
  if (!viajes.length) return json({ viajes: 0 });
  const mats = [...new Set(viajes.map((v) => v.mat))];
  const ra = await rest(`vig_ajustes?select=*&mat=in.(${mats.join(",")})`, { headers: { Prefer: "" } });
  const ajustes: Record<string, Obj> = {}; for (const a of (ra.ok ? await ra.json() : [])) ajustes[a.mat] = a;
  let flota: Record<string, Obj> = {};
  try {
    const f = await (await fetch(RENFE + "/renfe-visor/flotaLD.json?v=" + Date.now(), { headers: { Accept: "application/json", "User-Agent": "TrenTurnos/5 (avisos de retraso)" } })).json();
    for (const t of [...(f.trenes || []), ...(f.trenesNoPosicionados || [])]) { const k = sinCeros(t.codComercial); if (k) flota[k] = t; }
  } catch (e) { return json({ error: "Renfe no responde: " + e }, 502); }
  const { cambios, avisos } = procesar(viajes, flota, await estaciones(), ahora, ajustes);
  for (const c of cambios) await rest(`vig_viajes?id=eq.${c.id}`, { method: "PATCH", body: JSON.stringify(c.set) });
  if (avisos.length) await rest("eventos_push", { method: "POST", body: JSON.stringify(avisos) });
  return json({ viajes: viajes.length, cambios: cambios.length, avisos: avisos.length });
}

(globalThis as any).Deno?.serve(manejar);
