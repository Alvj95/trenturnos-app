// TrenTurnos · renfe-directo (v2)
// Intermediario para «Mi tren ahora»: lee el visor público de largo recorrido de
// Renfe y se lo pasa a la app (el navegador del móvil no puede leerlo directamente).
// Solo lee datos públicos; no guarda nada.
//
//  · sin parámetros  → todos los trenes en marcha (nº, retraso, posición…)
//  · ?tren=3933      → ese tren con todas sus paradas: nombre, posición y horas
//
// En Supabase: Edge Functions → renfe-directo → Code → pegar → Deploy.
// «Verify JWT» desactivado (son datos públicos).

const BASE = "https://tiempo-real.largorecorrido.renfe.com";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};
type Obj = Record<string, unknown>;
const guardado: Record<string, { cuando: number; datos: unknown }> = {};

async function leer(ruta: string, ms: number): Promise<unknown> {
  const g = guardado[ruta];
  if (g && Date.now() - g.cuando < ms) return g.datos;
  const r = await fetch(BASE + ruta + "?v=" + Date.now(), {
    headers: { "Accept": "application/json", "User-Agent": "TrenTurnos/5 (consulta orientativa)" },
  });
  if (!r.ok) throw new Error("Renfe respondió " + r.status);
  const datos = await r.json();
  guardado[ruta] = { cuando: Date.now(), datos };
  return datos;
}
const sinCeros = (s: unknown) => String(s ?? "").replace(/^0+/, "");

// Estaciones: código → nombre y posición (cambian muy poco: 1 día)
async function estaciones(): Promise<Record<string, { n: string; lat: number; lon: number }>> {
  const g = await leer("/data/estaciones.geojson", 86400000) as { features?: Array<{ properties: Obj }> };
  const m: Record<string, { n: string; lat: number; lon: number }> = {};
  for (const f of g.features || []) {
    const p = f.properties;
    m[sinCeros(p.CODIGO)] = { n: String(p.NOMBRE || ""), lat: Number(p.LAT), lon: Number(p.LON) };
  }
  return m;
}
function compacto(t: Obj) {
  return {
    codComercial: t.codComercial, latitud: t.latitud, longitud: t.longitud, ultRetraso: t.ultRetraso,
    codEstAnt: t.codEstAnt, codEstSig: t.codEstSig, horaLlegadaSigEst: t.horaLlegadaSigEst,
    codOrigen: t.codOrigen, codDestino: t.codDestino, codProduct: t.codProduct, mat: t.mat, accesible: t.accesible,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), {
    status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "max-age=10" },
  });
  try {
    const flota = await leer("/renfe-visor/flotaLD.json", 15000) as { fechaActualizacion?: string; trenes?: Obj[]; trenesNoPosicionados?: Obj[] };
    const todos = [...(flota.trenes || []), ...(flota.trenesNoPosicionados || []).map((t) => ({ ...t, sinPosicion: true }))];
    const tren = new URL(req.url).searchParams.get("tren");
    if (!tren) return json({ fechaActualizacion: flota.fechaActualizacion, trenes: todos.map((t) => ({ ...compacto(t), sinPosicion: t.sinPosicion || undefined })) });

    const n = sinCeros(tren);
    const t = todos.find((x) => sinCeros(x.codComercial) === n) || null;
    const rutas = await leer("/renfe-visor/trenesConEstacionesLD.json", 60000) as { trenes?: Array<{ idTren: string; estaciones: Obj[] }> };
    const r = (rutas.trenes || []).find((x) => sinCeros(x.idTren) === n) || null;
    const est = await estaciones();
    const nombre = (c: unknown) => est[sinCeros(c)]?.n || "";
    const paradas = r ? r.estaciones.map((p) => {
      const e = est[sinCeros(p.p)];
      return { cod: p.p, nombre: e?.n || "", lat: e?.lat, lon: e?.lon, llega: p.h, sale: p.hs };
    }) : [];
    return json({
      fechaActualizacion: flota.fechaActualizacion,
      tren: t ? { ...compacto(t), sinPosicion: t.sinPosicion || undefined, estAnt: nombre(t.codEstAnt), estSig: nombre(t.codEstSig),
        origen: nombre(t.codOrigen), destino: nombre(t.codDestino) } : null,
      paradas,
    });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
});
