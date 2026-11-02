package com.trenturnos.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;
import com.getcapacitor.JSObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.Calendar;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widgets nuevos de la pantalla de inicio (tandas 2 y 3):
 *  · Aviso de retraso (4×1): pregunta a TrenTurnos (solo lectura, vig_pendientes) si hay un
 *    retraso de llegada pendiente de añadir. Tocar abre la app, que enseña el pop-up de siempre.
 *  · Mi tren en directo (4×1): retraso y próxima parada del tren de hoy, del intermediario de
 *    Renfe que ya usa «Mi tren ahora» (renfe-directo, datos públicos, solo lectura).
 *  · Horas y nómina del mes (2×2) y Con quién viajo hoy (4×2): los calcula la app
 *    (native-bridge.js) y aquí solo se pintan.
 * Nada de esto escribe en ningún sitio: solo lee. Cualquier fallo deja el widget con lo último
 * que tenía y nunca afecta a la app.
 */
public final class WidgetsVivos {

    private WidgetsVivos() {}

    static final String REFRESCAR_RETRASO = "com.trenturnos.app.widget.REFRESCAR_RETRASO";
    static final String REFRESCAR_TREN = "com.trenturnos.app.widget.REFRESCAR_TREN";
    private static final String PREFS = "tt_widget_vivo";
    private static final String RENFE = "https://xoftsdupynwhzxsiusox.supabase.co/functions/v1/renfe-directo";
    private static final ExecutorService HILO = Executors.newSingleThreadExecutor();

    // ── Proveedores ──
    public static class Retraso extends AppWidgetProvider {
        @Override public void onReceive(Context c, Intent i) {
            if (REFRESCAR_RETRASO.equals(i.getAction())) { pedirRetraso(c, goAsync(), true); return; }
            super.onReceive(c, i);
        }
        @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { pedirRetraso(c, goAsync(), false); }
    }
    public static class MiTren extends AppWidgetProvider {
        @Override public void onReceive(Context c, Intent i) {
            if (REFRESCAR_TREN.equals(i.getAction())) { pedirTren(c, goAsync(), true); return; }
            super.onReceive(c, i);
        }
        @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { pedirTren(c, goAsync(), false); }
        @Override public void onDisabled(Context c) { try { alarmaTren(c, 0); } catch (Exception ignored) {} }
    }
    public static class Nomina extends AppWidgetProvider {
        @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) try { nomina(c, m, id); } catch (Exception e) { log(e); } }
    }
    public static class ConQuien extends AppWidgetProvider {
        @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) try { conQuien(c, m, id); } catch (Exception e) { log(e); } }
    }

    static void log(Exception e) { android.util.Log.w("TrenTurnos", "widget vivo", e); }
    static int[] ids(Context ctx, Class<?> k) { return AppWidgetManager.getInstance(ctx).getAppWidgetIds(new ComponentName(ctx, k)); }

    /** Lo llama la app al guardar los turnos: repinta y, si hace rato, vuelve a preguntar. */
    static void actualizarTodos(Context ctx) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        for (int id : ids(ctx, Nomina.class)) try { nomina(ctx, m, id); } catch (Exception e) { log(e); }
        for (int id : ids(ctx, ConQuien.class)) try { conQuien(ctx, m, id); } catch (Exception e) { log(e); }
        if (ids(ctx, Retraso.class).length > 0) pedirRetraso(ctx, null, false);
        if (ids(ctx, MiTren.class).length > 0) pedirTren(ctx, null, false);
    }

    /** Qué widgets que necesitan cálculos de la app están puestos. */
    static JSObject puestos(Context ctx) {
        JSObject r = new JSObject();
        r.put("nomina", ids(ctx, Nomina.class).length > 0);
        r.put("conQuien", ids(ctx, ConQuien.class).length > 0);
        return r;
    }

    // ── Ayudas ──
    static SharedPreferences prefs(Context ctx) { return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    static JSONObject leer(Context ctx, String k) {
        try { String s = prefs(ctx).getString(k, null); return s == null ? null : new JSONObject(s); } catch (Exception e) { return null; }
    }
    static String hora(long t) {
        Calendar c = Calendar.getInstance(); c.setTimeInMillis(t);
        return String.format(Locale.ROOT, "%d:%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE));
    }
    static int minutos(String h) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d{1,2}):(\\d{2})").matcher(h == null ? "" : h);
        return m.find() ? Integer.parseInt(m.group(1)) * 60 + Integer.parseInt(m.group(2)) : -1;
    }
    static PendingIntent refrescar(Context ctx, Class<?> k, String accion, int codigo) {
        Intent i = new Intent(ctx, k).setAction(accion);
        return PendingIntent.getBroadcast(ctx, codigo, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Petición HTTP corta (8 s). Solo para leer. */
    static String pedir(String url, String cuerpo, String clave) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        try {
            c.setConnectTimeout(8000); c.setReadTimeout(8000); c.setUseCaches(false);
            c.setRequestProperty("Accept", "application/json");
            if (clave != null) { c.setRequestProperty("apikey", clave); c.setRequestProperty("Authorization", "Bearer " + clave); }
            if (cuerpo != null) {
                c.setRequestMethod("POST"); c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json");
                OutputStream o = c.getOutputStream(); o.write(cuerpo.getBytes("UTF-8")); o.close();
            }
            int st = c.getResponseCode();
            if (st < 200 || st >= 300) throw new Exception("HTTP " + st);
            StringBuilder sb = new StringBuilder();
            BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
            char[] b = new char[4096]; int n;
            while ((n = r.read(b)) > 0 && sb.length() < 2_000_000) sb.append(b, 0, n);
            r.close();
            return sb.toString();
        } finally { c.disconnect(); }
    }

    /** Pinta ya con lo guardado y pregunta en segundo plano si hace falta. */
    static void enSegundoPlano(final Context ctx, final android.content.BroadcastReceiver.PendingResult pr, final Runnable pintar, final Runnable trabajo) {
        try { pintar.run(); } catch (Exception e) { log(e); }
        try {
            HILO.execute(() -> {
                try { trabajo.run(); } catch (Exception e) { log(e); }
                try { pintar.run(); } catch (Exception e) { log(e); }
                if (pr != null) try { pr.finish(); } catch (Exception ignored) {}
            });
        } catch (Exception e) { log(e); if (pr != null) try { pr.finish(); } catch (Exception ignored) {} }
    }

    // ══ Aviso de retraso (4×1) ══
    static void pedirRetraso(final Context ctx, android.content.BroadcastReceiver.PendingResult pr, final boolean forzar) {
        final Context app = ctx.getApplicationContext();
        enSegundoPlano(app, pr, () -> {
            AppWidgetManager m = AppWidgetManager.getInstance(app);
            for (int id : ids(app, Retraso.class)) try { retraso(app, m, id); } catch (Exception e) { log(e); }
        }, () -> {
            JSONObject x = WidgetDatos.extra(app), viejo = leer(app, "ret");
            if (x == null || x.optString("mat", "").isEmpty() || x.optJSONObject("sb") == null) return;
            if (!forzar && viejo != null && System.currentTimeMillis() - viejo.optLong("t") < 60_000) return;
            JSONObject sb = x.optJSONObject("sb"), out = new JSONObject();
            try {
                JSONObject cuerpo = new JSONObject().put("p_mat", x.optString("mat"));
                String r = pedir(sb.optString("u") + "/rest/v1/rpc/vig_pendientes", cuerpo.toString(), sb.optString("k"));
                out.put("l", new JSONArray(r.trim().isEmpty() ? "[]" : r)).put("ok", true);
            } catch (Exception e) {
                try { if (viejo != null && viejo.has("l")) out.put("l", viejo.optJSONArray("l")); out.put("ok", false); } catch (Exception ignored) {}
            }
            try { out.put("t", System.currentTimeMillis()).put("mat", x.optString("mat")); } catch (Exception ignored) {}
            prefs(app).edit().putString("ret", out.toString()).apply();
        });
    }

    static void retraso(Context ctx, AppWidgetManager m, int id) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.tt_widget_retraso);
        JSONObject x = WidgetDatos.extra(ctx), r = leer(ctx, "ret");
        String mat = x == null ? "" : x.optString("mat", "");
        if (r != null && !mat.equals(r.optString("mat", mat))) r = null; // cambió la matrícula
        JSONArray l = r == null ? null : r.optJSONArray("l");
        String tit, sub; boolean boton = false; String icono = "⏱️";
        if (x == null) { tit = "Avisos de retraso"; sub = "Abre TrenTurnos para activarlo"; }
        else if (mat.isEmpty()) { tit = "Avisos de retraso"; sub = "Pon tu matrícula en Ajustes de TrenTurnos"; }
        else if (x.optInt("rt", 1) == 0) { tit = "Avisos de retraso apagados"; sub = "Actívalos en Ajustes de TrenTurnos"; }
        else if (l != null && l.length() > 0) {
            JSONObject v = l.optJSONObject(0);
            String tren = v == null ? "" : String.valueOf(v.optString("tren", "")).replaceFirst("^0+", "");
            String f = v == null ? "" : v.optString("fecha", "");
            String cuando = f.equals(WidgetDatos.clave(WidgetsMas.dentroDe(0))) ? "" : f.equals(WidgetDatos.clave(WidgetsMas.dentroDe(-1))) ? " (ayer)" : f.length() >= 10 ? " (" + Integer.parseInt(f.substring(8, 10)) + "/" + Integer.parseInt(f.substring(5, 7)) + ")" : "";
            tit = "El " + tren + cuando + " llegó con +" + (v == null ? 0 : v.optInt("ret_llegada")) + " min";
            sub = "Toca para añadirlo a tu turno" + (l.length() > 1 ? " · y " + (l.length() - 1) + " más" : "");
            boton = true;
        } else if (r != null && r.has("l")) {
            icono = "✅"; tit = "Sin retrasos pendientes";
            sub = (r.optBoolean("ok", true) ? "Revisado a las " : "Sin conexión · último a las ") + hora(r.optLong("t"));
        } else if (r != null) { tit = "Sin conexión"; sub = "Toca ⟳ para volver a mirar"; }
        else { tit = "Avisos de retraso"; sub = "Mirando…"; }
        rv.setTextViewText(R.id.tw_ico, icono);
        rv.setTextViewText(R.id.tw_tit, tit);
        rv.setTextViewText(R.id.tw_sub, sub);
        rv.setViewVisibility(R.id.tw_btn, boton ? View.VISIBLE : View.GONE);
        rv.setViewVisibility(R.id.tw_ref, boton ? View.GONE : View.VISIBLE);
        rv.setOnClickPendingIntent(R.id.tw_raiz, WidgetsMas.abrirApp(ctx, 990000 + id));
        rv.setOnClickPendingIntent(R.id.tw_ref, refrescar(ctx, Retraso.class, REFRESCAR_RETRASO, 991000 + id));
        m.updateAppWidget(id, rv);
    }

    // ══ Mi tren en directo (4×1) ══
    /** El tren de hoy que toca mirar ahora (el primero que no ha llegado hace más de 20 min). */
    static JSONObject trenAhora(Context ctx) {
        JSONObject d = WidgetDatos.dia(ctx, WidgetDatos.clave(WidgetsMas.dentroDe(0)));
        JSONArray tr = d == null ? null : d.optJSONArray("tr");
        if (tr == null || tr.length() == 0) return null;
        Calendar c = Calendar.getInstance(); int ahora = c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE);
        JSONObject ultimo = null;
        for (int i = 0; i < tr.length(); i++) {
            JSONObject t = tr.optJSONObject(i); if (t == null) continue;
            ultimo = t;
            int hs = minutos(t.optString("hs")), hl = minutos(t.optString("hl"));
            if (hl >= 0 && hs >= 0 && hl < hs) hl += 1440; // llega pasada la medianoche
            if (hl < 0 || ahora <= hl + 20) return t;
        }
        return ultimo;
    }
    /** ¿Tiene sentido preguntar a Renfe ahora? (de 1 h antes de salir a 30 min después de llegar) */
    static boolean enMarcha(JSONObject t) {
        if (t == null) return false;
        Calendar c = Calendar.getInstance(); int ahora = c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE);
        int hs = minutos(t.optString("hs")), hl = minutos(t.optString("hl"));
        if (hs < 0) return true;
        if (hl < 0) hl = hs + 600; else if (hl < hs) hl += 1440;
        return ahora >= hs - 60 && ahora <= hl + 30;
    }
    static void alarmaTren(Context ctx, long ms) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = refrescar(ctx, MiTren.class, REFRESCAR_TREN, 992999);
        if (am == null) return;
        am.cancel(pi);
        if (ms > 0) am.set(AlarmManager.ELAPSED_REALTIME, SystemClock.elapsedRealtime() + ms, pi); // sin despertar el móvil
    }

    static void pedirTren(final Context ctx, android.content.BroadcastReceiver.PendingResult pr, final boolean forzar) {
        final Context app = ctx.getApplicationContext();
        enSegundoPlano(app, pr, () -> {
            AppWidgetManager m = AppWidgetManager.getInstance(app);
            for (int id : ids(app, MiTren.class)) try { miTren(app, m, id); } catch (Exception e) { log(e); }
        }, () -> {
            JSONObject t = trenAhora(app), viejo = leer(app, "tren");
            boolean marcha = enMarcha(t);
            // Mientras el tren va en marcha se vuelve a mirar cada 10 min (sin despertar el móvil).
            try { alarmaTren(app, marcha && ids(app, MiTren.class).length > 0 ? 10 * 60_000L : 0); } catch (Exception e) { log(e); }
            if (!marcha) return;
            String n = t.optString("n");
            if (!forzar && viejo != null && n.equals(viejo.optString("n")) && System.currentTimeMillis() - viejo.optLong("t") < 60_000) return;
            JSONObject out = new JSONObject();
            try {
                out.put("n", n).put("t", System.currentTimeMillis());
                JSONObject j = new JSONObject(pedir(RENFE + "?tren=" + URLEncoder.encode(n, "UTF-8") + "&v=" + System.currentTimeMillis(), null, null));
                JSONObject v = j.optJSONObject("tren");
                out.put("ok", true);
                if (v != null) {
                    out.put("hay", true).put("ret", v.optString("ultRetraso", "")).put("sig", v.optString("estSig", ""))
                        .put("hsig", v.optString("horaLlegadaSigEst", "")).put("sinpos", v.optBoolean("sinPosicion", false))
                        .put("um", v.optString("mat", "").contains(","));
                }
            } catch (Exception e) {
                try {
                    if (viejo != null && n.equals(viejo.optString("n"))) { out = viejo; out.put("t", System.currentTimeMillis()); }
                    out.put("ok", false);
                } catch (Exception ignored) {}
            }
            prefs(app).edit().putString("tren", out.toString()).apply();
        });
    }

    static void miTren(Context ctx, AppWidgetManager m, int id) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.tt_widget_mitren);
        JSONObject t = trenAhora(ctx), v = leer(ctx, "tren");
        String tit, grande = "—", lin, pie = ""; int color = 0xFF94A3B8; boolean refrescar = false;
        if (!WidgetDatos.hayDatos(ctx)) { tit = "🚆 Mi tren en directo"; lin = "Abre TrenTurnos para cargar tus turnos"; }
        else if (t == null) {
            tit = "🚆 Hoy no tienes tren";
            JSONObject man = WidgetDatos.dia(ctx, WidgetDatos.clave(WidgetsMas.dentroDe(1)));
            JSONArray mt = man == null ? null : man.optJSONArray("tr");
            JSONObject p = mt == null || mt.length() == 0 ? null : mt.optJSONObject(0);
            lin = p == null ? "Mañana tampoco" : "Mañana: " + p.optString("n") + (p.optString("hs").isEmpty() ? "" : " a las " + p.optString("hs"));
        } else {
            String n = t.optString("n"), o = t.optString("o"), d = t.optString("d");
            tit = "🚆 " + n + (o.isEmpty() && d.isEmpty() ? "" : " · " + o + (d.isEmpty() ? "" : " → " + d));
            boolean mio = v != null && n.equals(v.optString("n"));
            refrescar = true;
            if (!enMarcha(t) && !(mio && v.optBoolean("hay"))) {
                int hs = minutos(t.optString("hs")); Calendar c = Calendar.getInstance();
                boolean antes = hs >= 0 && c.get(Calendar.HOUR_OF_DAY) * 60 + c.get(Calendar.MINUTE) < hs - 60;
                lin = antes ? "Sale a las " + t.optString("hs") + " · el directo empieza 1 h antes" : "Ya ha llegado";
                refrescar = false;
            } else if (mio && v.optBoolean("hay")) {
                String r = v.optString("ret", "");
                int min = 0; boolean num = false;
                try { min = Integer.parseInt(r.trim()); num = Math.abs(min) <= 600; } catch (Exception ignored) {}
                if (num && min > 0) { grande = "+" + min + " min"; color = 0xFFF87171; }
                else if (num) { grande = "En hora"; color = 0xFF4ADE80; }
                String sig = v.optString("sig", ""), hs = v.optString("hsig", "");
                String hh = hs.length() >= 16 ? hs.substring(11, 16).replaceFirst("^0", "") : "";
                lin = v.optBoolean("sinpos") ? "Sin posición ahora mismo" : sig.isEmpty() ? "En marcha" : "Próxima: " + sig + (hh.isEmpty() ? "" : " · " + hh);
                if (v.optBoolean("um")) lin += " · UM";
                pie = (v.optBoolean("ok", true) ? "📡 Renfe · " : "Sin conexión · ") + hora(v.optLong("t"));
            } else if (mio) {
                lin = v.optBoolean("ok", true) ? "Renfe aún no da datos de este tren" : "Sin conexión";
                pie = hora(v.optLong("t"));
            } else { lin = "Mirando…"; }
        }
        rv.setTextViewText(R.id.tw_tit, tit);
        rv.setTextViewText(R.id.tw_ret, grande);
        rv.setTextColor(R.id.tw_ret, color);
        rv.setTextViewText(R.id.tw_lin, lin);
        rv.setTextViewText(R.id.tw_pie, pie);
        rv.setViewVisibility(R.id.tw_ref, refrescar ? View.VISIBLE : View.GONE);
        rv.setOnClickPendingIntent(R.id.tw_raiz, WidgetsMas.abrirApp(ctx, 993000 + id));
        rv.setOnClickPendingIntent(R.id.tw_ref, refrescar(ctx, MiTren.class, REFRESCAR_TREN, 994000 + id));
        m.updateAppWidget(id, rv);
    }

    // ══ Horas y nómina del mes (2×2) ══
    static String horasTxt(double h) {
        return (Math.abs(h - Math.round(h)) < 0.05 ? String.valueOf(Math.round(h)) : String.format(Locale.ROOT, "%.1f", h).replace('.', ',')) + " h";
    }
    static String euros(double e) { return String.format(Locale.GERMANY, "%,d €", Math.round(e)); } // 1842 → «1.842 €»
    static void nomina(Context ctx, AppWidgetManager m, int id) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.tt_widget_nomina);
        JSONObject x = WidgetDatos.extra(ctx), n = x == null ? null : x.optJSONObject("nom");
        String hoy = WidgetDatos.clave(WidgetsMas.dentroDe(0));
        if (n == null || !n.optString("f").substring(0, Math.min(7, n.optString("f").length())).equals(hoy.substring(0, 7))) {
            rv.setTextViewText(R.id.tw_mes, WidgetDatos.MESES[WidgetsMas.dentroDe(0).get(Calendar.MONTH)].toUpperCase(Locale.ROOT));
            rv.setTextViewText(R.id.tw_h, "—"); rv.setTextViewText(R.id.tw_ref, "");
            rv.setTextViewText(R.id.tw_x, ""); rv.setTextViewText(R.id.tw_xl, "");
            rv.setProgressBar(R.id.tw_prog, 100, 0, false);
            rv.setTextViewText(R.id.tw_eur, "Abre TrenTurnos para calcularlo");
        } else {
            double h = n.optDouble("h", 0), ref = n.optDouble("ref", 163), hx = n.optDouble("x", 0);
            rv.setTextViewText(R.id.tw_mes, n.optString("mes").toUpperCase(Locale.ROOT) + (n.optString("f").equals(hoy) ? " · HASTA HOY" : ""));
            rv.setTextViewText(R.id.tw_h, horasTxt(h));
            rv.setTextViewText(R.id.tw_ref, "de " + horasTxt(ref));
            rv.setTextViewText(R.id.tw_x, hx > 0 ? "+" + horasTxt(hx) : "0 h");
            rv.setTextViewText(R.id.tw_xl, "HTDL");
            rv.setProgressBar(R.id.tw_prog, 1000, (int) Math.max(0, Math.min(1000, ref > 0 ? h / ref * 1000 : 0)), false);
            rv.setTextViewText(R.id.tw_eur, n.isNull("eur") || !n.has("eur") ? "Nómina: abre «Nómina» en la app" : "Nómina estimada: " + euros(n.optDouble("eur")));
        }
        rv.setOnClickPendingIntent(R.id.tw_raiz, WidgetsMas.abrirApp(ctx, 995000 + id));
        m.updateAppWidget(id, rv);
    }

    // ══ Con quién viajo hoy (4×2) ══
    private static final int[] QF = { R.id.tw_q0, R.id.tw_q1, R.id.tw_q2, R.id.tw_q3 };
    private static final int[] QA = { R.id.tw_qa0, R.id.tw_qa1, R.id.tw_qa2, R.id.tw_qa3 };
    private static final int[] QN = { R.id.tw_qn0, R.id.tw_qn1, R.id.tw_qn2, R.id.tw_qn3 };
    private static final int[] QT = { R.id.tw_qt0, R.id.tw_qt1, R.id.tw_qt2, R.id.tw_qt3 };
    static String iniciales(String s) {
        String[] p = s.trim().split("\\s+"); String r = "";
        for (String x : p) if (!x.isEmpty() && Character.isUpperCase(x.charAt(0)) && r.length() < 2) r += x.charAt(0);
        return r.isEmpty() ? "?" : r;
    }
    static void conQuien(Context ctx, AppWidgetManager m, int id) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.tt_widget_conquien);
        JSONObject x = WidgetDatos.extra(ctx), q = x == null ? null : x.optJSONObject("cq");
        String hoy = WidgetDatos.clave(WidgetsMas.dentroDe(0));
        JSONArray g = q == null ? null : q.optJSONArray("g");
        boolean vale = q != null && hoy.equals(q.optString("f"));
        String cab = "HOY", msg = null;
        if (!vale) msg = "Abre TrenTurnos para ver con quién viajas hoy";
        else if (q.optString("tr").isEmpty()) msg = "Hoy no tienes tren";
        else {
            cab = "HOY · " + q.optString("tr");
            if (q.optInt("no") == 1) msg = "No se pudo mirar el Horario General ahora";
            else if (g == null || g.length() == 0) msg = "Nadie más de tu base en tus trenes";
        }
        rv.setTextViewText(R.id.tw_cab, cab);
        rv.setViewVisibility(R.id.tw_msg, msg == null ? View.GONE : View.VISIBLE);
        rv.setTextViewText(R.id.tw_msg, msg == null ? "" : msg);
        int total = msg == null && g != null ? g.length() : 0;
        for (int i = 0; i < 4; i++) {
            JSONObject p = i < total ? g.optJSONObject(i) : null;
            rv.setViewVisibility(QF[i], p == null ? View.GONE : View.VISIBLE);
            if (p == null) continue;
            String nom = p.optString("n");
            rv.setTextViewText(QA[i], iniciales(nom));
            rv.setTextViewText(QN[i], nom);
            rv.setTextViewText(QT[i], p.optString("t"));
            rv.setTextColor(QT[i], p.optInt("dh") == 1 ? 0xFFFCD34D : 0xFF94A3B8);
        }
        rv.setViewVisibility(R.id.tw_mas, total > 4 ? View.VISIBLE : View.GONE);
        rv.setTextViewText(R.id.tw_mas, total > 4 ? "y " + (total - 4) + " más · toca para verlos" : "");
        rv.setOnClickPendingIntent(R.id.tw_raiz, CalendarioWidget.abrirDia(ctx, 996000 + id, hoy));
        m.updateAppWidget(id, rv);
    }
}
