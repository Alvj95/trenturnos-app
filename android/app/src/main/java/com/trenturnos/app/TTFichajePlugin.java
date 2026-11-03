package com.trenturnos.app;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Abre la pantalla de fichaje dentro de la app (ver FichajeActivity). */
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
}
