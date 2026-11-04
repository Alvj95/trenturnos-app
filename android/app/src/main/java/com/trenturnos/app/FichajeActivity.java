package com.trenturnos.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

/**
 * Fichaje dentro de TrenTurnos: abre la página de fichaje de la empresa en una pantalla
 * propia de la app (no en Chrome). Se abre al tocar la alarma de «Fichar» o con el botón
 * «🕒 Fichar». El usuario y la contraseña se escriben en la página de la empresa:
 * TrenTurnos no los lee ni los guarda (solo se conservan las cookies de la página, como
 * en cualquier navegador). ✕ o «atrás» la cierran y se vuelve a la app.
 */
public class FichajeActivity extends AppCompatActivity {

    static final String URL_FICHAJE = "https://cp.serveo.com/wfp_portal_empleados.aspx?Id=SABfichajetripulantes#Again-No-back-button";
    private static final int FONDO = 0xFF0D1B2E, CAJA = 0xFF132236, BORDE = 0xFF1E3350, TEXTO = 0xFFF8FAFC, GRIS = 0xFF94A3B8;

    private WebView web;
    private ProgressBar barra;
    private TextView aviso;

    /** Abre el fichaje (lo llama el plugin desde la app). */
    static void abrir(Context ctx) {
        Intent i = new Intent(ctx, FichajeActivity.class);
        if (!(ctx instanceof android.app.Activity)) i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        ctx.startActivity(i);
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(false);

        LinearLayout raiz = new LinearLayout(this);
        raiz.setOrientation(LinearLayout.VERTICAL);
        raiz.setBackgroundColor(FONDO);

        // Cabecera: ✕  🕒 Fichaje  ⟳
        LinearLayout cab = new LinearLayout(this);
        cab.setOrientation(LinearLayout.HORIZONTAL);
        cab.setGravity(Gravity.CENTER_VERTICAL);
        cab.setPadding(dp(10), dp(8), dp(10), dp(8));
        TextView cerrar = boton("✕");
        cerrar.setContentDescription("Cerrar el fichaje");
        cerrar.setOnClickListener(v -> finish());
        LinearLayout tit = new LinearLayout(this);
        tit.setOrientation(LinearLayout.VERTICAL);
        tit.setPadding(dp(10), 0, dp(10), 0);
        TextView t1 = texto("🕒 Fichaje", 16, TEXTO, true);
        TextView t2 = texto("Portal del empleado · tripulantes", 11.5f, GRIS, false);
        tit.addView(t1); tit.addView(t2);
        TextView recargar = boton("⟳");
        recargar.setContentDescription("Recargar");
        recargar.setOnClickListener(v -> { aviso.setVisibility(View.GONE); web.loadUrl(URL_FICHAJE); });
        cab.addView(cerrar);
        cab.addView(tit, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1));
        cab.addView(recargar);
        raiz.addView(cab);

        barra = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        barra.setMax(100);
        barra.setIndeterminate(false);
        barra.setProgressTintList(android.content.res.ColorStateList.valueOf(0xFF3B82F6));
        raiz.addView(barra, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        FrameLayout cuerpo = new FrameLayout(this);
        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        cuerpo.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        aviso = texto("", 14, TEXTO, false);
        aviso.setGravity(Gravity.CENTER);
        aviso.setPadding(dp(24), dp(24), dp(24), dp(24));
        aviso.setBackgroundColor(FONDO);
        aviso.setVisibility(View.GONE);
        cuerpo.addView(aviso, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        raiz.addView(cuerpo, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1));

        TextView pie = texto("🔒 TrenTurnos no lee ni guarda tu usuario ni tu contraseña: los escribes en la página de la empresa.", 11, GRIS, false);
        pie.setPadding(dp(12), dp(8), dp(12), dp(8));
        raiz.addView(pie);

        setContentView(raiz);
        // Que no quede debajo de las barras del móvil ni del teclado (Android 15+ dibuja detrás).
        ViewCompat.setOnApplyWindowInsetsListener(raiz, (v, insets) -> {
            Insets b = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            int abajo = Math.max(b.bottom, insets.getInsets(WindowInsetsCompat.Type.ime()).bottom);
            v.setPadding(b.left, b.top, b.right, abajo);
            return WindowInsetsCompat.CONSUMED;
        });

        // Para el Control de fichaje: al volver a la app se pregunta «¿Has fichado?» con esta hora.
        if (savedInstanceState == null) {
            try { getSharedPreferences("tt_fichaje", MODE_PRIVATE).edit().putLong("abierto", System.currentTimeMillis()).apply(); } catch (Exception ignored) {}
        }

        configurarWeb();
        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) web.loadUrl(URL_FICHAJE);

        // «Atrás» siempre cierra el fichaje y vuelve a la app (la página de la empresa
        // bloquea su propio «atrás», así que no se usa su historial).
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() { finish(); }
        });
    }

    private void configurarWeb() {
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setGeolocationEnabled(true);
        CookieManager cm = CookieManager.getInstance();
        cm.setAcceptCookie(true);
        cm.setAcceptThirdPartyCookies(web, true);

        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                String esq = u.getScheme() == null ? "" : u.getScheme();
                if (esq.equals("http") || esq.equals("https")) return false; // todo dentro de la pantalla
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {} // tel:, mailto:…
                return true;
            }
            @Override public void onPageStarted(WebView v, String url, Bitmap f) { barra.setVisibility(View.VISIBLE); }
            @Override public void onPageFinished(WebView v, String url) { barra.setVisibility(View.INVISIBLE); CookieManager.getInstance().flush(); }
            @Override public void onReceivedError(WebView v, android.webkit.WebResourceRequest r, android.webkit.WebResourceError e) {
                if (r.isForMainFrame()) mostrarAviso("No se pudo abrir la página de fichaje.\nRevisa la conexión y toca ⟳ para volver a intentarlo.");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView v, int p) { barra.setProgress(p); }
            // TrenTurnos no pide permiso de ubicación. Si la página la pidiera para fichar,
            // se avisa y se ofrece abrirla en Chrome, que sí puede pedirla.
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback cb) {
                cb.invoke(origin, false, false);
                runOnUiThread(() -> new androidx.appcompat.app.AlertDialog.Builder(FichajeActivity.this)
                    .setMessage("La página de fichaje pide tu ubicación y TrenTurnos no la usa. ¿La abrimos en Chrome para fichar allí?")
                    .setPositiveButton("Abrir en Chrome", (d, w) -> abrirFuera())
                    .setNegativeButton("Seguir aquí", null).show());
            }
        });
    }

    private void abrirFuera() {
        try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(URL_FICHAJE))); } catch (Exception ignored) {}
    }

    private void mostrarAviso(String t) {
        aviso.setText(t);
        aviso.setVisibility(View.VISIBLE);
    }

    @Override protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }
    @Override protected void onPause() {
        super.onPause();
        try { CookieManager.getInstance().flush(); } catch (Exception ignored) {}
    }
    @Override protected void onDestroy() {
        if (web != null) {
            try { ((ViewGroup) web.getParent()).removeView(web); web.destroy(); } catch (Exception ignored) {}
            web = null;
        }
        super.onDestroy();
    }

    // ── Ayudas de diseño (mismos colores que la app) ──
    private int dp(float v) { return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics())); }
    private TextView texto(String s, float sp, int color, boolean negrita) {
        TextView t = new TextView(this);
        t.setText(s); t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp); t.setTextColor(color);
        if (negrita) t.setTypeface(Typeface.DEFAULT_BOLD);
        return t;
    }
    private TextView boton(String s) {
        TextView b = texto(s, 18, TEXTO, true);
        b.setGravity(Gravity.CENTER);
        GradientDrawable g = new GradientDrawable();
        g.setColor(CAJA); g.setCornerRadius(dp(12)); g.setStroke(dp(1), BORDE);
        b.setBackground(g);
        b.setLayoutParams(new LinearLayout.LayoutParams(dp(42), dp(42)));
        b.setClickable(true); b.setFocusable(true);
        return b;
    }
}
