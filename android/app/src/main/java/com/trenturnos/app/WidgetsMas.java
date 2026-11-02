package com.trenturnos.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Widgets nuevos de la pantalla de inicio (tanda 1, todos con los turnos del calendario):
 * Hoy, Semana, Mes compacto, Agenda de la semana, Cuenta atrás de descanso y de vacaciones,
 * Próxima presentación, Reloj con tu turno y Días libres del mes.
 * Como los de antes, solo leen lo que la app guarda en WidgetDatos (sin internet ni cálculos de horas).
 * Tocar un día abre la ventana del turno (DiaActivity); tocar el resto abre la app.
 */
public final class WidgetsMas {

    private WidgetsMas() {}

    static final String[] DC = { "DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB" };
    static final String[] MC = { "ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC" };

    // ── Un proveedor por widget (el manifiesto los registra) ──
    public static class Hoy extends AppWidgetProvider {
        @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) hoy(c, m, id); } }
    public static class Semana extends AppWidgetProvider {
        @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) semana(c, m, id); } }
    public static class Mes extends AppWidgetProvider {
        @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) mes(c, m, id); } }
    public static class Agenda extends AppWidgetProvider {
        @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) agenda(c, m, id); } }
    public static class Descanso extends AppWidgetProvider {
        @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) descanso(c, m, id); } }
    public static class Vacaciones extends AppWidgetProvider {
        @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) vacaciones(c, m, id); } }
    public static class Presentacion extends AppWidgetProvider {
        @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) presentacion(c, m, id); } }
    public static class Reloj extends AppWidgetProvider {
        @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) reloj(c, m, id); } }
    public static class Libres extends AppWidgetProvider {
        @Override public void onUpdate(Context c, AppWidgetManager m, int[] ids) { for (int id : ids) libres(c, m, id); } }

    /** Repinta todos los widgets nuevos que estén puestos (lo llama WidgetDatos al llegar datos). */
    static void actualizarTodos(Context ctx) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, Hoy.class))) hoy(ctx, m, id);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, Semana.class))) semana(ctx, m, id);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, Mes.class))) mes(ctx, m, id);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, Agenda.class))) agenda(ctx, m, id);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, Descanso.class))) descanso(ctx, m, id);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, Vacaciones.class))) vacaciones(ctx, m, id);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, Presentacion.class))) presentacion(ctx, m, id);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, Reloj.class))) reloj(ctx, m, id);
        for (int id : m.getAppWidgetIds(new ComponentName(ctx, Libres.class))) libres(ctx, m, id);
    }

    // ── Ayudas ──
    static PendingIntent abrirApp(Context ctx, int codigo) {
        Intent i = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (i == null) i = new Intent(ctx, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(ctx, codigo, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static Calendar dentroDe(int dias) { Calendar c = Calendar.getInstance(); c.add(Calendar.DAY_OF_MONTH, dias); return c; }
    static String diaCorto(Calendar c) { return DC[c.get(Calendar.DAY_OF_WEEK) - 1] + " " + c.get(Calendar.DAY_OF_MONTH); }
    static String fechaCorta(Calendar c) { return diaCorto(c) + " " + MC[c.get(Calendar.MONTH)]; }
    static String tipo(JSONObject d) { return d == null ? null : d.optString("k", null); }
    static boolean esLibre(String k) { return "des".equals(k) || "dop".equals(k) || "vac".equals(k); }
    /** «3062 / 3113» si hay tren; si no, el nombre del tipo de día («Descanso»…). */
    static String principal(JSONObject d) {
        if (d == null) return "Sin turno";
        String c = d.optString("c", ""), v = d.optString("v", "");
        if (c.matches("\\d+.*")) return c + (v.isEmpty() ? "" : " / " + v);
        return d.optString("t", c);
    }
    static String horas(JSONObject d) {
        if (d == null) return "";
        JSONArray f = d.optJSONArray("f");
        if (f != null) for (int i = 0; i < f.length(); i++) {
            JSONArray x = f.optJSONArray(i);
            if (x != null && "Horas".equals(x.optString(0))) return x.optString(1, "");
        }
        return "";
    }
    /** «06:40 → 17:50 · 11 h 10 min» (lo que haya). */
    static String franja(JSONObject d) {
        if (d == null) return "";
        String h = d.optString("h", ""), hl = d.optString("hl", ""), hs = horas(d), out = "";
        if (!h.isEmpty()) out = h + (hl.isEmpty() ? "" : " → " + hl);
        if (!hs.isEmpty()) out += (out.isEmpty() ? "" : " · ") + hs;
        return out;
    }
    static String sinDatos(Context ctx) { return WidgetDatos.hayDatos(ctx) ? "Sin turno" : "Abre TrenTurnos para cargar tus turnos"; }
    /** Primer día desde hoy (incluido) que cumple el tipo; -1 si no hay en ~13 meses. */
    static int buscar(Context ctx, String[] tipos) {
        for (int i = 0; i < 400; i++) {
            String k = tipo(WidgetDatos.dia(ctx, WidgetDatos.clave(dentroDe(i))));
            for (String t : tipos) if (t.equals(k)) return i;
        }
        return -1;
    }

    // ── Hoy (2×2) ──
    static void hoy(Context ctx, AppWidgetManager m, int id) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.tt_widget_hoy);
        Calendar c = dentroDe(0); String clave = WidgetDatos.clave(c);
        JSONObject d = WidgetDatos.dia(ctx, clave); String k = tipo(d);
        rv.setTextViewText(R.id.tw_fecha, "HOY · " + fechaCorta(c));
        rv.setTextViewText(R.id.tw_tren, d == null ? sinDatos(ctx) : principal(d));
        rv.setTextViewText(R.id.tw_horas, franja(d));
        rv.setTextViewText(R.id.tw_tipo, d == null ? "—" : d.optString("t", "").toUpperCase(Locale.ROOT));
        rv.setTextColor(R.id.tw_tipo, WidgetDatos.colorTexto(k));
        rv.setInt(R.id.tw_tipo, "setBackgroundResource", WidgetDatos.fondo(k, false));
        rv.setViewVisibility(R.id.tw_tipo, d == null ? View.GONE : View.VISIBLE);
        rv.setOnClickPendingIntent(R.id.tw_raiz, CalendarioWidget.abrirDia(ctx, 910000 + id, clave));
        m.updateAppWidget(id, rv);
    }

    // ── Semana (4×1): de lunes a domingo de esta semana ──
    private static final int[] S = { R.id.tw_s0, R.id.tw_s1, R.id.tw_s2, R.id.tw_s3, R.id.tw_s4, R.id.tw_s5, R.id.tw_s6 };
    private static final int[] SD = { R.id.tw_sd0, R.id.tw_sd1, R.id.tw_sd2, R.id.tw_sd3, R.id.tw_sd4, R.id.tw_sd5, R.id.tw_sd6 };
    private static final int[] SN = { R.id.tw_sn0, R.id.tw_sn1, R.id.tw_sn2, R.id.tw_sn3, R.id.tw_sn4, R.id.tw_sn5, R.id.tw_sn6 };
    private static final int[] SC = { R.id.tw_sc0, R.id.tw_sc1, R.id.tw_sc2, R.id.tw_sc3, R.id.tw_sc4, R.id.tw_sc5, R.id.tw_sc6 };
    static void semana(Context ctx, AppWidgetManager m, int id) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.tt_widget_semana);
        Calendar hoy = dentroDe(0);
        int desdeLunes = (hoy.get(Calendar.DAY_OF_WEEK) + 5) % 7; // lunes = 0
        for (int i = 0; i < 7; i++) {
            Calendar c = dentroDe(i - desdeLunes); String clave = WidgetDatos.clave(c);
            JSONObject d = WidgetDatos.dia(ctx, clave); String k = tipo(d); boolean esHoy = i == desdeLunes;
            rv.setTextViewText(SD[i], DC[c.get(Calendar.DAY_OF_WEEK) - 1]);
            rv.setTextViewText(SN[i], String.valueOf(c.get(Calendar.DAY_OF_MONTH)));
            rv.setTextViewText(SC[i], d == null ? "" : d.optString("c", "").toUpperCase(Locale.ROOT));
            rv.setTextColor(SC[i], WidgetDatos.colorTexto(k));
            rv.setInt(S[i], "setBackgroundResource", WidgetDatos.fondo(k, esHoy));
            rv.setOnClickPendingIntent(S[i], CalendarioWidget.abrirDia(ctx, 920000 + id * 8 + i, clave));
        }
        m.updateAppWidget(id, rv);
    }

    // ── Mes compacto (2×2): solo colores ──
    private static final int[] MZ = new int[42];
    static {
        int[] ids = { R.id.tw_m0, R.id.tw_m1, R.id.tw_m2, R.id.tw_m3, R.id.tw_m4, R.id.tw_m5, R.id.tw_m6, R.id.tw_m7, R.id.tw_m8, R.id.tw_m9,
            R.id.tw_m10, R.id.tw_m11, R.id.tw_m12, R.id.tw_m13, R.id.tw_m14, R.id.tw_m15, R.id.tw_m16, R.id.tw_m17, R.id.tw_m18, R.id.tw_m19,
            R.id.tw_m20, R.id.tw_m21, R.id.tw_m22, R.id.tw_m23, R.id.tw_m24, R.id.tw_m25, R.id.tw_m26, R.id.tw_m27, R.id.tw_m28, R.id.tw_m29,
            R.id.tw_m30, R.id.tw_m31, R.id.tw_m32, R.id.tw_m33, R.id.tw_m34, R.id.tw_m35, R.id.tw_m36, R.id.tw_m37, R.id.tw_m38, R.id.tw_m39,
            R.id.tw_m40, R.id.tw_m41 };
        System.arraycopy(ids, 0, MZ, 0, 42);
    }
    static void mes(Context ctx, AppWidgetManager m, int id) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.tt_widget_mes);
        Calendar hoy = dentroDe(0);
        Calendar c = dentroDe(0); c.set(Calendar.DAY_OF_MONTH, 1);
        rv.setTextViewText(R.id.tw_mes, WidgetDatos.MESES[c.get(Calendar.MONTH)].toUpperCase(Locale.ROOT) + " " + c.get(Calendar.YEAR));
        int hueco = (c.get(Calendar.DAY_OF_WEEK) + 5) % 7, ultimo = c.getActualMaximum(Calendar.DAY_OF_MONTH);
        for (int i = 0; i < 42; i++) {
            int dia = i - hueco + 1;
            if (dia < 1 || dia > ultimo) {
                rv.setTextViewText(MZ[i], "");
                rv.setInt(MZ[i], "setBackgroundColor", 0x00000000);
                continue;
            }
            c.set(Calendar.DAY_OF_MONTH, dia); String clave = WidgetDatos.clave(c);
            String k = tipo(WidgetDatos.dia(ctx, clave));
            boolean esHoy = dia == hoy.get(Calendar.DAY_OF_MONTH);
            rv.setTextViewText(MZ[i], String.valueOf(dia));
            rv.setTextColor(MZ[i], k == null ? 0xFF94A3B8 : WidgetDatos.colorTexto(k));
            rv.setInt(MZ[i], "setBackgroundResource", WidgetDatos.fondo(k, esHoy));
            rv.setOnClickPendingIntent(MZ[i], CalendarioWidget.abrirDia(ctx, 930000 + id * 64 + i, clave));
        }
        rv.setOnClickPendingIntent(R.id.tw_mes, abrirApp(ctx, 939000 + id));
        m.updateAppWidget(id, rv);
    }

    // ── Agenda de la semana (4×3): hoy y los 6 días siguientes ──
    private static final int[] A = { R.id.tw_a0, R.id.tw_a1, R.id.tw_a2, R.id.tw_a3, R.id.tw_a4, R.id.tw_a5, R.id.tw_a6 };
    private static final int[] AD = { R.id.tw_ad0, R.id.tw_ad1, R.id.tw_ad2, R.id.tw_ad3, R.id.tw_ad4, R.id.tw_ad5, R.id.tw_ad6 };
    private static final int[] AT = { R.id.tw_at0, R.id.tw_at1, R.id.tw_at2, R.id.tw_at3, R.id.tw_at4, R.id.tw_at5, R.id.tw_at6 };
    private static final int[] AH = { R.id.tw_ah0, R.id.tw_ah1, R.id.tw_ah2, R.id.tw_ah3, R.id.tw_ah4, R.id.tw_ah5, R.id.tw_ah6 };
    static void agenda(Context ctx, AppWidgetManager m, int id) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.tt_widget_agenda);
        for (int i = 0; i < 7; i++) {
            Calendar c = dentroDe(i); String clave = WidgetDatos.clave(c);
            JSONObject d = WidgetDatos.dia(ctx, clave);
            rv.setTextViewText(AD[i], i == 0 ? "HOY" : diaCorto(c));
            rv.setTextViewText(AT[i], d == null ? (i == 0 ? sinDatos(ctx) : "Sin turno") : principal(d));
            rv.setTextColor(AT[i], d == null ? 0xFF64748B : 0xFFF8FAFC);
            String h = d == null ? "" : d.optString("h", ""), hl = d == null ? "" : d.optString("hl", "");
            rv.setTextViewText(AH[i], h.isEmpty() ? "" : h + (hl.isEmpty() ? "" : "–" + hl));
            rv.setOnClickPendingIntent(A[i], CalendarioWidget.abrirDia(ctx, 940000 + id * 8 + i, clave));
        }
        m.updateAppWidget(id, rv);
    }

    // ── Cuenta atrás de descanso / vacaciones (2×1) ──
    static void cuenta(Context ctx, AppWidgetManager m, int id, int layout, String[] tipos, String hoyTxt, String queTxt, int codigo) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), layout);
        int n = buscar(ctx, tipos);
        if (!WidgetDatos.hayDatos(ctx)) {
            rv.setTextViewText(R.id.tw_num, "—"); rv.setTextViewText(R.id.tw_l1, "Abre TrenTurnos");
            rv.setTextViewText(R.id.tw_l2, "para cargar tus turnos"); rv.setTextViewText(R.id.tw_l3, "");
        } else if (n < 0) {
            rv.setTextViewText(R.id.tw_num, "—"); rv.setTextViewText(R.id.tw_l1, "No hay " + queTxt);
            rv.setTextViewText(R.id.tw_l2, "en tu calendario"); rv.setTextViewText(R.id.tw_l3, "");
        } else if (n == 0) {
            int fin = 0; while (fin < 60 && contiene(tipos, tipo(WidgetDatos.dia(ctx, WidgetDatos.clave(dentroDe(fin + 1)))))) fin++;
            rv.setTextViewText(R.id.tw_num, "🎉"); rv.setTextViewText(R.id.tw_l1, "Hoy");
            rv.setTextViewText(R.id.tw_l2, hoyTxt);
            rv.setTextViewText(R.id.tw_l3, fin > 0 ? "hasta el " + fechaCorta(dentroDe(fin)).toLowerCase(Locale.ROOT) : "");
        } else {
            rv.setTextViewText(R.id.tw_num, String.valueOf(n));
            rv.setTextViewText(R.id.tw_l1, n == 1 ? "día para tu" : "días para tu");
            rv.setTextViewText(R.id.tw_l2, queTxt);
            rv.setTextViewText(R.id.tw_l3, "(" + fechaCorta(dentroDe(n)).toLowerCase(Locale.ROOT) + ")");
        }
        rv.setOnClickPendingIntent(R.id.tw_raiz, n > 0 ? CalendarioWidget.abrirDia(ctx, codigo + id, WidgetDatos.clave(dentroDe(n))) : abrirApp(ctx, codigo + id));
        m.updateAppWidget(id, rv);
    }
    static boolean contiene(String[] a, String k) { for (String x : a) if (x.equals(k)) return true; return false; }
    static void descanso(Context ctx, AppWidgetManager m, int id) {
        cuenta(ctx, m, id, R.layout.tt_widget_descanso, new String[] { "des", "dop" }, "descansas", "próximo descanso", 950000);
    }
    static void vacaciones(Context ctx, AppWidgetManager m, int id) {
        cuenta(ctx, m, id, R.layout.tt_widget_vacaciones, new String[] { "vac" }, "estás de vacaciones", "vacaciones", 955000);
    }

    // ── Próxima presentación (2×1): cuenta atrás que avanza sola ──
    static void presentacion(Context ctx, AppWidgetManager m, int id) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.tt_widget_presentacion);
        long ahora = System.currentTimeMillis(), objetivo = -1; String clave = null, donde = "";
        for (int i = 0; i < 45 && objetivo < 0; i++) {
            Calendar c = dentroDe(i); String k = WidgetDatos.clave(c); JSONObject d = WidgetDatos.dia(ctx, k);
            String h = d == null ? "" : d.optString("h", "");
            java.util.regex.Matcher mt = java.util.regex.Pattern.compile("^(\\d{1,2}):(\\d{2})").matcher(h);
            if (!mt.find()) continue;
            c.set(Calendar.HOUR_OF_DAY, Integer.parseInt(mt.group(1))); c.set(Calendar.MINUTE, Integer.parseInt(mt.group(2)));
            c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0);
            if (c.getTimeInMillis() <= ahora) continue;
            objetivo = c.getTimeInMillis(); clave = k;
            String sl = d.optString("sl", "");
            donde = (i == 0 ? "hoy " : i == 1 ? "mañana " : diaCorto(c).toLowerCase(Locale.ROOT) + " ") + h + (sl.isEmpty() ? "" : " · " + sl);
        }
        if (objetivo < 0) {
            rv.setViewVisibility(R.id.tw_crono, View.GONE); rv.setViewVisibility(R.id.tw_dias, View.VISIBLE);
            rv.setTextViewText(R.id.tw_dias, "—");
            rv.setTextViewText(R.id.tw_donde, WidgetDatos.hayDatos(ctx) ? "Sin presentaciones próximas" : "Abre TrenTurnos para cargar tus turnos");
        } else if (objetivo - ahora > 24L * 3600 * 1000) {
            long dias = (objetivo - ahora) / (24L * 3600 * 1000);
            rv.setViewVisibility(R.id.tw_crono, View.GONE); rv.setViewVisibility(R.id.tw_dias, View.VISIBLE);
            rv.setTextViewText(R.id.tw_dias, dias + (dias == 1 ? " día" : " días"));
            rv.setTextViewText(R.id.tw_donde, donde);
        } else {
            rv.setViewVisibility(R.id.tw_dias, View.GONE); rv.setViewVisibility(R.id.tw_crono, View.VISIBLE);
            rv.setChronometer(R.id.tw_crono, SystemClock.elapsedRealtime() + (objetivo - ahora), null, true);
            rv.setChronometerCountDown(R.id.tw_crono, true);
            rv.setTextViewText(R.id.tw_donde, donde);
        }
        rv.setOnClickPendingIntent(R.id.tw_raiz, clave != null ? CalendarioWidget.abrirDia(ctx, 960000 + id, clave) : abrirApp(ctx, 960000 + id));
        m.updateAppWidget(id, rv);
    }

    // ── Reloj con tu turno (4×1) ──
    static void reloj(Context ctx, AppWidgetManager m, int id) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.tt_widget_reloj);
        Calendar c = dentroDe(0); String clave = WidgetDatos.clave(c);
        JSONObject d = WidgetDatos.dia(ctx, clave), man = WidgetDatos.dia(ctx, WidgetDatos.clave(dentroDe(1)));
        rv.setTextViewText(R.id.tw_fecha, fechaCorta(c));
        String fr = franja(d);
        rv.setTextViewText(R.id.tw_turno, d == null ? sinDatos(ctx) : principal(d) + (fr.isEmpty() ? "" : " · " + fr));
        rv.setTextViewText(R.id.tw_man, "Mañana: " + (man == null ? "sin turno" : principal(man)));
        rv.setOnClickPendingIntent(R.id.tw_raiz, CalendarioWidget.abrirDia(ctx, 970000 + id, clave));
        m.updateAppWidget(id, rv);
    }

    // ── Días libres del mes (2×1): desde hoy hasta fin de mes ──
    static void libres(Context ctx, AppWidgetManager m, int id) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.tt_widget_libres);
        Calendar c = dentroDe(0); int hoy = c.get(Calendar.DAY_OF_MONTH), ultimo = c.getActualMaximum(Calendar.DAY_OF_MONTH), des = 0, vac = 0;
        for (int dia = hoy; dia <= ultimo; dia++) {
            c.set(Calendar.DAY_OF_MONTH, dia); String k = tipo(WidgetDatos.dia(ctx, WidgetDatos.clave(c)));
            if ("vac".equals(k)) vac++; else if (esLibre(k)) des++;
        }
        String mes = WidgetDatos.MESES[c.get(Calendar.MONTH)].toLowerCase(Locale.ROOT);
        if (!WidgetDatos.hayDatos(ctx)) {
            rv.setTextViewText(R.id.tw_num, "—"); rv.setTextViewText(R.id.tw_l1, "Abre TrenTurnos");
            rv.setTextViewText(R.id.tw_l2, "para cargar tus turnos"); rv.setTextViewText(R.id.tw_l3, "");
        } else {
            rv.setTextViewText(R.id.tw_num, String.valueOf(des + vac));
            rv.setTextViewText(R.id.tw_l1, (des + vac == 1 ? "día libre" : "días libres") + " en " + mes);
            rv.setTextViewText(R.id.tw_l2, des + (des == 1 ? " descanso" : " descansos") + " · " + vac + " vacaciones");
            rv.setTextViewText(R.id.tw_l3, "desde hoy hasta el " + ultimo);
        }
        rv.setOnClickPendingIntent(R.id.tw_raiz, abrirApp(ctx, 980000 + id));
        m.updateAppWidget(id, rv);
    }
}
