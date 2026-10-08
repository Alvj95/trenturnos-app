package com.trenturnos.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Barras del móvil (arriba: hora y batería; abajo: botones o gestos).
 *
 * Desde Android 15 las apps se dibujan por detrás de esas barras y la app tenía
 * que dejar el hueco ella sola; dentro del WebView (y sobre todo en Servicios,
 * que va en un marco) ese hueco a veces salía 0 y la barra tapaba el menú de
 * abajo y los botones. Aquí la app se coloca SIEMPRE dentro de las barras
 * (y encima del teclado cuando está abierto), con el fondo oscuro de la app
 * detrás de ellas y los iconos de las barras en claro.
 * Capacitor no gestiona las barras (capacitor.config.json: SystemBars.insetsHandling = "disable").
 */
public class MainActivity extends BridgeActivity {

    private static final int FONDO = Color.parseColor("#07111F");

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        View decor = window.getDecorView();
        decor.setBackgroundColor(FONDO);

        WindowInsetsControllerCompat barras = WindowCompat.getInsetsController(window, decor);
        barras.setAppearanceLightStatusBars(false);
        barras.setAppearanceLightNavigationBars(false);

        ViewCompat.setOnApplyWindowInsetsListener(decor, (v, insets) -> {
            int tipos = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
            Insets b = insets.getInsets(tipos);
            boolean teclado = insets.isVisible(WindowInsetsCompat.Type.ime());
            int abajo = teclado ? Math.max(insets.getInsets(WindowInsetsCompat.Type.ime()).bottom, b.bottom) : b.bottom;
            v.setPadding(b.left, b.top, b.right, abajo);
            // El hueco ya está hecho: la página no debe añadir otro (env(safe-area-inset-*) = 0).
            return new WindowInsetsCompat.Builder(insets).setInsets(tipos, Insets.NONE).build();
        });
        ViewCompat.requestApplyInsets(decor);
    }
}
