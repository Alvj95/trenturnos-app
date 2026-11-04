package com.trenturnos.app;

import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;

/**
 * Fichaje: abre la página de fichaje dentro de la app (FichajeActivity), dice a la app cuándo
 * se abrió (para preguntar «¿Has fichado?») y programa las alarmas de fichar la salida
 * (FichajeSalida, con el retraso del tren).
 */
@CapacitorPlugin(name = "TTFichaje")
public class TTFichajePlugin extends Plugin {
    @PluginMethod
    public void abrir(PluginCall call) {
        try {
            FichajeActivity.abrir(getActivity() != null ? getActivity() : getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo abrir el fichaje", e);
        }
    }

    /** Si se abrió la página de fichaje desde la última vez: { abierto: hora en ms } (y se borra). */
    @PluginMethod
    public void pendiente(PluginCall call) {
        JSObject r = new JSObject();
        try {
            SharedPreferences p = getContext().getSharedPreferences("tt_fichaje", android.content.Context.MODE_PRIVATE);
            long t = p.getLong("abierto", 0);
            if (t > 0) { r.put("abierto", t); p.edit().remove("abierto").apply(); }
        } catch (Exception ignored) {}
        call.resolve(r);
    }

    /** lista: JSON con las salidas de los próximos días; abrir: tocar la alarma abre el fichaje. */
    @PluginMethod
    public void programarSalidas(PluginCall call) {
        try {
            JSONArray lista = new JSONArray(call.getString("lista", "[]"));
            FichajeSalida.programar(getContext(), lista, call.getBoolean("abrir", true));
            JSObject r = new JSObject();
            r.put("n", lista.length());
            call.resolve(r);
        } catch (Exception e) {
            call.reject("No se pudieron programar las salidas", e);
        }
    }
}
