package com.trenturnos.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.widget.RemoteViews;
import java.util.Calendar;
import org.json.JSONObject;

/**
 * Widget «Próximos turnos» (4×2): hoy y los 3 días siguientes.
 * Tocar una fila abre la ventana del turno (DiaActivity) sin abrir la app.
 */
public class ProximosWidget extends AppWidgetProvider {

    private static final int[] FILAS = { R.id.tt_p0, R.id.tt_p1, R.id.tt_p2, R.id.tt_p3 };
    private static final int[] DIA = { R.id.tt_pd0, R.id.tt_pd1, R.id.tt_pd2, R.id.tt_pd3 };
    private static final int[] PASTILLA = { R.id.tt_pc0, R.id.tt_pc1, R.id.tt_pc2, R.id.tt_pc3 };
    private static final int[] TEXTO = { R.id.tt_pt0, R.id.tt_pt1, R.id.tt_pt2, R.id.tt_pt3 };
    private static final int[] HORA = { R.id.tt_ph0, R.id.tt_ph1, R.id.tt_ph2, R.id.tt_ph3 };
    private static final String[] DIA_CORTO = { "DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB" };

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) pintar(ctx, mgr, id);
    }

    static void pintar(Context ctx, AppWidgetManager mgr, int id) {
        RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.tt_widget_proximos);
        boolean hayDatos = WidgetDatos.hayDatos(ctx);
        for (int i = 0; i < FILAS.length; i++) {
            Calendar c = Calendar.getInstance();
            c.add(Calendar.DAY_OF_MONTH, i);
            String clave = WidgetDatos.clave(c);
            JSONObject info = WidgetDatos.dia(ctx, clave);
            String tipo = info == null ? null : info.optString("k", null);

            rv.setTextViewText(DIA[i], i == 0 ? "HOY" : i == 1 ? "MAÑANA"
                : DIA_CORTO[c.get(Calendar.DAY_OF_WEEK) - 1] + " " + c.get(Calendar.DAY_OF_MONTH));
            rv.setTextColor(DIA[i], i == 0 ? 0xFFFCD34D : 0xFF94A3B8);

            String pastilla = info == null ? "—" : info.optString("c", info.optString("t", ""));
            if (info != null && !info.optString("c", "").isEmpty() && info.optString("c").matches("\\d+.*")) pastilla = "TREN " + pastilla;
            rv.setTextViewText(PASTILLA[i], pastilla.toUpperCase(java.util.Locale.ROOT));
            rv.setTextColor(PASTILLA[i], WidgetDatos.colorTexto(tipo));
            rv.setInt(PASTILLA[i], "setBackgroundResource", WidgetDatos.fondo(tipo, false));

            String texto;
            if (info == null) texto = i == 0 && !hayDatos ? "Abre TrenTurnos para cargar tus turnos" : "Sin turno";
            else texto = info.optString("r", info.optString("t", ""));
            rv.setTextViewText(TEXTO[i], texto);
            rv.setTextViewText(HORA[i], info == null ? "" : info.optString("h", ""));

            rv.setOnClickPendingIntent(FILAS[i], CalendarioWidget.abrirDia(ctx, 900000 + id * 8 + i, clave));
        }
        mgr.updateAppWidget(id, rv);
    }
}
