package com.trenturnos.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Puente entre la app y los widgets de la pantalla de inicio.
 * native-bridge.js llama a guardar() cada vez que cambian los turnos, y a
 * fechaPendiente() al abrirse, por si se llegó desde «Abrir en TrenTurnos».
 */
@CapacitorPlugin(name = "TTWidget")
public class TTWidgetPlugin extends Plugin {

    @PluginMethod
    public void guardar(PluginCall call) {
        String datos = call.getString("datos");
        if (datos == null) {
            call.reject("Faltan los datos");
            return;
        }
        WidgetDatos.guardar(getContext(), datos);
        // Qué widgets que necesitan cálculos de la app están puestos (para no calcular de más).
        JSObject r = new JSObject();
        try { r.put("puestos", WidgetsVivos.puestos(getContext())); } catch (Exception e) { android.util.Log.w("TrenTurnos", "widgets puestos", e); }
        call.resolve(r);
    }

    @PluginMethod
    public void fechaPendiente(PluginCall call) {
        JSObject r = new JSObject();
        r.put("fecha", WidgetDatos.tomarFechaPendiente(getContext()));
        call.resolve(r);
    }
}
