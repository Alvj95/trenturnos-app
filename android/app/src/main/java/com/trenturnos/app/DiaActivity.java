package com.trenturnos.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Ventana del turno de un día, al tocarlo en el widget: sale encima de la
 * pantalla de inicio sin abrir la app. «Abrir en TrenTurnos» abre la app
 * en ese día.
 */
public class DiaActivity extends Activity {

    static final String EXTRA_FECHA = "fecha";

    private static final int FONDO = 0xFF0D1B2E, CAJA = 0xFF132236, BORDE = 0xFF1E3350;
    private static final int TEXTO = 0xFFF8FAFC, GRIS = 0xFF94A3B8;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        pintar(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        pintar(intent);
    }

    private void pintar(Intent intent) {
        String fecha = intent.getStringExtra(EXTRA_FECHA);
        if (fecha == null) fecha = WidgetDatos.clave(java.util.Calendar.getInstance());
        final String clave = fecha;
        JSONObject info = WidgetDatos.dia(this, clave);
        String tipo = info == null ? null : info.optString("k", null);
        int color = WidgetDatos.colorTexto(tipo);

        LinearLayout tarjeta = new LinearLayout(this);
        tarjeta.setOrientation(LinearLayout.VERTICAL);
        tarjeta.setPadding(dp(16), dp(16), dp(16), dp(16));
        tarjeta.setBackground(caja(FONDO, 24, BORDE));

        // Cabecera: icono + fecha + tren/tipo.
        LinearLayout cab = new LinearLayout(this);
        cab.setOrientation(LinearLayout.HORIZONTAL);
        cab.setGravity(Gravity.CENTER_VERTICAL);
        TextView ico = texto(info == null ? "📅" : info.optString("i", "📅"), 22, TEXTO, false);
        ico.setGravity(Gravity.CENTER);
        ico.setBackground(caja((color & 0x00FFFFFF) | 0x33000000, 13, 0));
        cab.addView(ico, new LinearLayout.LayoutParams(dp(44), dp(44)));
        LinearLayout tit = new LinearLayout(this);
        tit.setOrientation(LinearLayout.VERTICAL);
        tit.setPadding(dp(12), 0, 0, 0);
        tit.addView(texto(WidgetDatos.fechaLarga(clave), 17, TEXTO, true));
        String sub = info == null ? "Sin turno registrado" : info.optString("s", info.optString("t", ""));
        if (!sub.isEmpty()) tit.addView(texto(sub, 13, GRIS, false));
        cab.addView(tit, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        tarjeta.addView(cab);

        if (info != null) {
            // Etiqueta del tipo de día.
            TextView tag = texto(info.optString("t", "").toUpperCase(java.util.Locale.ROOT), 11, color, true);
            tag.setLetterSpacing(0.05f);
            tag.setPadding(dp(10), dp(3), dp(10), dp(3));
            tag.setBackground(caja((color & 0x00FFFFFF) | 0x29000000, 20, (color & 0x00FFFFFF) | 0x66000000));
            LinearLayout.LayoutParams lpTag = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            lpTag.topMargin = dp(12);
            tarjeta.addView(tag, lpTag);

            // Detalle: trayecto, presentación, fin, horas…
            JSONArray filas = info.optJSONArray("f");
            if (filas != null && filas.length() > 0) {
                LinearLayout det = new LinearLayout(this);
                det.setOrientation(LinearLayout.VERTICAL);
                det.setPadding(dp(12), dp(6), dp(12), dp(6));
                det.setBackground(caja(CAJA, 14, 0));
                for (int i = 0; i < filas.length(); i++) {
                    JSONArray f = filas.optJSONArray(i);
                    if (f == null || f.length() < 2) continue;
                    LinearLayout fila = new LinearLayout(this);
                    fila.setOrientation(LinearLayout.HORIZONTAL);
                    fila.setPadding(0, dp(6), 0, dp(6));
                    fila.addView(texto(f.optString(0), 13.5f, GRIS, false),
                        new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
                    TextView v = texto(f.optString(1), 13.5f, TEXTO, true);
                    v.setGravity(Gravity.END);
                    LinearLayout.LayoutParams lpV = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
                    lpV.leftMargin = dp(12);
                    fila.addView(v, lpV);
                    det.addView(fila);
                }
                LinearLayout.LayoutParams lpDet = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                lpDet.topMargin = dp(12);
                tarjeta.addView(det, lpDet);
            }

            String nota = info.optString("n", "");
            if (!nota.isEmpty()) {
                TextView n = texto("📝 " + nota, 13, 0xFFFDE68A, false);
                n.setPadding(dp(10), dp(8), dp(10), dp(8));
                n.setBackground(caja(0x1AEAB308, 10, 0x59EAB308));
                LinearLayout.LayoutParams lpN = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                lpN.topMargin = dp(10);
                tarjeta.addView(n, lpN);
            }
        } else if (!WidgetDatos.hayDatos(this)) {
            TextView n = texto("Abre TrenTurnos una vez para que el widget cargue tus turnos.", 13, GRIS, false);
            n.setPadding(0, dp(12), 0, 0);
            tarjeta.addView(n);
        }

        // Botones.
        LinearLayout bot = new LinearLayout(this);
        bot.setOrientation(LinearLayout.HORIZONTAL);
        TextView cerrar = boton("Cerrar", CAJA, BORDE);
        cerrar.setOnClickListener(v -> finish());
        TextView abrir = boton("Abrir en TrenTurnos", 0xFF3B7FFF, 0);
        abrir.setOnClickListener(v -> {
            WidgetDatos.guardarFechaPendiente(this, clave);
            Intent app = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(app);
            finish();
        });
        LinearLayout.LayoutParams lpC = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1);
        LinearLayout.LayoutParams lpA = new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.4f);
        lpA.leftMargin = dp(8);
        bot.addView(cerrar, lpC);
        bot.addView(abrir, lpA);
        LinearLayout.LayoutParams lpBot = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        lpBot.topMargin = dp(14);
        tarjeta.addView(bot, lpBot);

        ScrollView sv = new ScrollView(this);
        sv.addView(tarjeta);
        setContentView(sv);
    }

    private TextView texto(String s, float sp, int color, boolean negrita) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        if (negrita) t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setEllipsize(TextUtils.TruncateAt.END);
        return t;
    }

    private TextView boton(String s, int fondo, int borde) {
        TextView b = texto(s, 14, TEXTO, true);
        b.setGravity(Gravity.CENTER);
        b.setPadding(dp(8), dp(13), dp(8), dp(13));
        b.setBackground(caja(fondo, 13, borde));
        b.setClickable(true);
        b.setFocusable(true);
        b.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);
        return b;
    }

    private GradientDrawable caja(int color, int radioDp, int borde) {
        GradientDrawable g = new GradientDrawable();
        g.setColor(color);
        g.setCornerRadius(dp(radioDp));
        if (borde != 0) g.setStroke(dp(1), borde);
        return g;
    }

    private int dp(float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }
}
