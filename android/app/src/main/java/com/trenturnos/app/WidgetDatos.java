package com.trenturnos.app;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import java.util.Calendar;
import org.json.JSONObject;

/**
 * Datos de los widgets de la pantalla de inicio.
 *
 * La app (native-bridge.js) prepara cada día ya resumido (color, texto corto,
 * detalle de la ventana) y lo guarda aquí con TTWidgetPlugin.guardar. Los
 * widgets y la ventana del día solo leen esto: no calculan nada ni necesitan
 * internet, así enseñan exactamente lo mismo que la app.
 *
 * Formato: {"v":1, "dias": {"2026-10-17": {"k":"ord", "c":"3060", "i":"🚂",
 *   "t":"Ordinario", "s":"Tren 3060 · AVE", "r":"Barcelona → Madrid",
 *   "h":"07:30", "f":[["Presentación","07:30"], …], "n":"nota"}}}
 */
public final class WidgetDatos {

    private static final String PREFS = "tt_widget";
    private static final String K_DATOS = "datos";
    private static final String K_FECHA_PENDIENTE = "fechaPendiente";

    static final String[] MESES = { "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
        "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre" };
    static final String[] DIAS_SEMANA = { "Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado" };

    private static JSONObject cache;
    private static String cacheCrudo;

    private WidgetDatos() {}

    static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Guarda lo que manda la app y repinta todos los widgets puestos. */
    static void guardar(Context ctx, String json) {
        prefs(ctx).edit().putString(K_DATOS, json).apply();
        actualizarTodos(ctx);
    }

    static boolean hayDatos(Context ctx) {
        return dias(ctx) != null;
    }

    private static synchronized JSONObject dias(Context ctx) {
        String crudo = prefs(ctx).getString(K_DATOS, null);
        if (crudo == null) return null;
        if (!crudo.equals(cacheCrudo)) {
            try {
                cache = new JSONObject(crudo).optJSONObject("dias");
            } catch (Exception e) {
                cache = null;
            }
            cacheCrudo = crudo;
        }
        return cache;
    }

    /** El día "AAAA-MM-DD", o null si no hay turno guardado. */
    static JSONObject dia(Context ctx, String clave) {
        JSONObject d = dias(ctx);
        return d == null ? null : d.optJSONObject(clave);
    }

    static String clave(Calendar c) {
        return String.format(java.util.Locale.ROOT, "%04d-%02d-%02d",
            c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH));
    }

    static Calendar desdeClave(String clave) {
        Calendar c = Calendar.getInstance();
        try {
            String[] p = clave.split("-");
            c.clear();
            c.set(Integer.parseInt(p[0]), Integer.parseInt(p[1]) - 1, Integer.parseInt(p[2]));
        } catch (Exception ignored) {}
        return c;
    }

    /** "Lunes 20 de octubre". */
    static String fechaLarga(String clave) {
        Calendar c = desdeClave(clave);
        return DIAS_SEMANA[c.get(Calendar.DAY_OF_WEEK) - 1] + " " + c.get(Calendar.DAY_OF_MONTH)
            + " de " + MESES[c.get(Calendar.MONTH)].toLowerCase(java.util.Locale.ROOT);
    }

    /** Fondo de la celda según el tipo de día (mismos colores que el calendario de la app). */
    static int fondo(String tipo, boolean hoy) {
        if (tipo == null) tipo = "nada";
        switch (tipo) {
            case "ord": return hoy ? R.drawable.tt_cel_ord_hoy : R.drawable.tt_cel_ord;
            case "res": return hoy ? R.drawable.tt_cel_res_hoy : R.drawable.tt_cel_res;
            case "des": return hoy ? R.drawable.tt_cel_des_hoy : R.drawable.tt_cel_des;
            case "baj": return hoy ? R.drawable.tt_cel_baj_hoy : R.drawable.tt_cel_baj;
            case "tra": return hoy ? R.drawable.tt_cel_tra_hoy : R.drawable.tt_cel_tra;
            case "cmp": return hoy ? R.drawable.tt_cel_cmp_hoy : R.drawable.tt_cel_cmp;
            case "vac": return hoy ? R.drawable.tt_cel_vac_hoy : R.drawable.tt_cel_vac;
            case "dop": return hoy ? R.drawable.tt_cel_dop_hoy : R.drawable.tt_cel_dop;
            case "art": return hoy ? R.drawable.tt_cel_art_hoy : R.drawable.tt_cel_art;
            case "pmd": return hoy ? R.drawable.tt_cel_pmd_hoy : R.drawable.tt_cel_pmd;
            default: return hoy ? R.drawable.tt_cel_nada_hoy : R.drawable.tt_cel_nada;
        }
    }

    /** Color del texto según el tipo de día. */
    static int colorTexto(String tipo) {
        if (tipo == null) return 0xFFCBD5E1;
        switch (tipo) {
            case "ord": case "art": return 0xFF93C5FD;
            case "res": case "pmd": return 0xFFFCD34D;
            case "des": return 0xFF86EFAC;
            case "baj": return 0xFFFCA5A5;
            case "tra": return 0xFFC4B5FD;
            case "cmp": return 0xFF67E8F9;
            case "vac": return 0xFF7DD3FC;
            case "dop": return 0xFFF9A8D4;
            default: return 0xFFCBD5E1;
        }
    }

    /** Al pulsar «Abrir en TrenTurnos»: la app abre ese día (lo recoge con TTWidgetPlugin.fechaPendiente). */
    static void guardarFechaPendiente(Context ctx, String clave) {
        prefs(ctx).edit().putString(K_FECHA_PENDIENTE, clave).apply();
    }

    static String tomarFechaPendiente(Context ctx) {
        SharedPreferences p = prefs(ctx);
        String f = p.getString(K_FECHA_PENDIENTE, null);
        if (f != null) p.edit().remove(K_FECHA_PENDIENTE).apply();
        return f;
    }

    static void actualizarTodos(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        for (int id : mgr.getAppWidgetIds(new ComponentName(ctx, CalendarioWidget.class))) {
            CalendarioWidget.pintar(ctx, mgr, id);
        }
        for (int id : mgr.getAppWidgetIds(new ComponentName(ctx, ProximosWidget.class))) {
            ProximosWidget.pintar(ctx, mgr, id);
        }
    }
}
