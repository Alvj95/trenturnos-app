package com.trenturnos.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.RelativeSizeSpan;
import android.text.style.StyleSpan;
import android.view.View;
import android.widget.RemoteViews;
import java.util.Calendar;
import org.json.JSONObject;

/**
 * Widget «Calendario del mes» (4×4): el mes con el color de cada día y el
 * número de tren; ‹ › cambia de mes, tocar el título vuelve al mes actual.
 * Tocar un día abre la ventana del turno (DiaActivity) sin abrir la app.
 */
public class CalendarioWidget extends AppWidgetProvider {

    static final String ACCION_MES = "com.trenturnos.app.widget.MES";
    private static final String EXTRA_SALTO = "salto";

    private static final int[] CELDAS = {
        R.id.tt_c0, R.id.tt_c1, R.id.tt_c2, R.id.tt_c3, R.id.tt_c4, R.id.tt_c5, R.id.tt_c6,
        R.id.tt_c7, R.id.tt_c8, R.id.tt_c9, R.id.tt_c10, R.id.tt_c11, R.id.tt_c12, R.id.tt_c13,
        R.id.tt_c14, R.id.tt_c15, R.id.tt_c16, R.id.tt_c17, R.id.tt_c18, R.id.tt_c19, R.id.tt_c20,
        R.id.tt_c21, R.id.tt_c22, R.id.tt_c23, R.id.tt_c24, R.id.tt_c25, R.id.tt_c26, R.id.tt_c27,
        R.id.tt_c28, R.id.tt_c29, R.id.tt_c30, R.id.tt_c31, R.id.tt_c32, R.id.tt_c33, R.id.tt_c34,
        R.id.tt_c35, R.id.tt_c36, R.id.tt_c37, R.id.tt_c38, R.id.tt_c39, R.id.tt_c40, R.id.tt_c41
    };

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) pintar(ctx, mgr, id);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (ACCION_MES.equals(intent.getAction())) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID) {
                int salto = intent.getIntExtra(EXTRA_SALTO, 0);
                int mes = salto == 0 ? 0 : WidgetDatos.prefs(ctx).getInt(claveMes(id), 0) + salto;
                WidgetDatos.prefs(ctx).edit().putInt(claveMes(id), mes).apply();
                pintar(ctx, AppWidgetManager.getInstance(ctx), id);
            }
            return;
        }
        super.onReceive(ctx, intent);
    }

    @Override
    public void onDeleted(Context ctx, int[] ids) {
        for (int id : ids) WidgetDatos.prefs(ctx).edit().remove(claveMes(id)).apply();
    }

    private static String claveMes(int id) {
        return "mes_" + id;
    }

    static void pintar(Context ctx, AppWidgetManager mgr, int id) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.tt_widget_calendario);
        int salto = WidgetDatos.prefs(ctx).getInt(claveMes(id), 0);

        Calendar hoy = Calendar.getInstance();
        String claveHoy = WidgetDatos.clave(hoy);
        Calendar mes = Calendar.getInstance();
        mes.set(Calendar.DAY_OF_MONTH, 1);
        mes.add(Calendar.MONTH, salto);
        int anio = mes.get(Calendar.YEAR), m = mes.get(Calendar.MONTH);
        rv.setTextViewText(R.id.tt_titulo, WidgetDatos.MESES[m] + " " + anio);

        // Lunes = primera columna.
        int hueco = (mes.get(Calendar.DAY_OF_WEEK) + 5) % 7;
        int diasMes = mes.getActualMaximum(Calendar.DAY_OF_MONTH);
        for (int i = 0; i < CELDAS.length; i++) {
            int celda = CELDAS[i], d = i - hueco + 1;
            if (d < 1 || d > diasMes) {
                rv.setViewVisibility(celda, View.INVISIBLE);
                continue;
            }
            rv.setViewVisibility(celda, View.VISIBLE);
            Calendar c = (Calendar) mes.clone();
            c.set(Calendar.DAY_OF_MONTH, d);
            String clave = WidgetDatos.clave(c);
            JSONObject info = WidgetDatos.dia(ctx, clave);
            String tipo = info == null ? null : info.optString("k", null);
            boolean esHoy = clave.equals(claveHoy);

            SpannableStringBuilder txt = new SpannableStringBuilder(String.valueOf(d));
            txt.setSpan(new StyleSpan(android.graphics.Typeface.BOLD), 0, txt.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            String corto = info == null ? "" : info.optString("c", "");
            if (!corto.isEmpty()) {
                int ini = txt.length();
                txt.append("\n").append(corto);
                txt.setSpan(new RelativeSizeSpan(0.68f), ini, txt.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                txt.setSpan(new StyleSpan(android.graphics.Typeface.BOLD), ini, txt.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
            rv.setTextViewText(celda, txt);
            rv.setTextColor(celda, esHoy && info == null ? 0xFFFCD34D : WidgetDatos.colorTexto(tipo));
            rv.setInt(celda, "setBackgroundResource", WidgetDatos.fondo(tipo, esHoy));
            rv.setOnClickPendingIntent(celda, abrirDia(ctx, id * 64 + i, clave));
        }

        // Pie: el turno de hoy.
        String pie;
        if (!WidgetDatos.hayDatos(ctx)) {
            pie = "Abre TrenTurnos una vez para cargar tus turnos";
        } else {
            JSONObject h = WidgetDatos.dia(ctx, claveHoy);
            if (h == null) {
                pie = "Hoy · sin turno";
            } else {
                String s = h.optString("s", h.optString("t", ""));
                String r = h.optString("r", "");
                String hora = h.optString("h", "");
                pie = h.optString("i", "📅") + "  Hoy · " + s + (r.isEmpty() || s.contains(r) ? "" : " · " + r)
                    + (hora.isEmpty() ? "" : "  " + hora);
            }
        }
        rv.setTextViewText(R.id.tt_pie, pie);
        rv.setOnClickPendingIntent(R.id.tt_pie, abrirDia(ctx, id * 64 + 50, claveHoy));

        rv.setOnClickPendingIntent(R.id.tt_ant, cambiarMes(ctx, id, -1));
        rv.setOnClickPendingIntent(R.id.tt_sig, cambiarMes(ctx, id, 1));
        rv.setOnClickPendingIntent(R.id.tt_titulo_caja, cambiarMes(ctx, id, 0));

        mgr.updateAppWidget(id, rv);
    }

    static PendingIntent abrirDia(Context ctx, int codigo, String clave) {
        Intent i = new Intent(ctx, DiaActivity.class)
            .setData(Uri.parse("trenturnos://dia/" + clave))
            .putExtra(DiaActivity.EXTRA_FECHA, clave)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        return PendingIntent.getActivity(ctx, codigo, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent cambiarMes(Context ctx, int id, int salto) {
        Intent i = new Intent(ctx, CalendarioWidget.class)
            .setAction(ACCION_MES)
            .setData(Uri.parse("trenturnos://mes/" + id + "/" + salto))
            .putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, id)
            .putExtra(EXTRA_SALTO, salto);
        return PendingIntent.getBroadcast(ctx, id * 4 + salto + 1, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
