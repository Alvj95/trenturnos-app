package com.trenturnos.servicios;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

/**
 * Aviso de versión nueva dentro de la app (Google Play «In-App Updates»).
 *
 * native-bridge.js pregunta con comprobar() si Google Play tiene una versión
 * más nueva; si la persona pulsa «Actualizar», iniciar() abre la ventana de
 * Google Play y la descarga sigue en segundo plano (avisa con el evento
 * "estado"); al terminar, completar() instala y reinicia la app.
 * Solo funciona si la app se instaló desde Google Play.
 */
@CapacitorPlugin(name = "TTActualizar")
public class TTActualizarPlugin extends Plugin {

    private AppUpdateManager gestor;
    private AppUpdateInfo ultimaInfo;
    private InstallStateUpdatedListener oyente;

    @Override
    public void load() {
        gestor = AppUpdateManagerFactory.create(getContext());
        oyente = estado -> {
            JSObject r = new JSObject();
            r.put("estado", nombre(estado.installStatus()));
            r.put("descargado", estado.bytesDownloaded());
            r.put("total", estado.totalBytesToDownload());
            notifyListeners("estado", r);
        };
        gestor.registerListener(oyente);
    }

    @Override
    protected void handleOnDestroy() {
        if (gestor != null && oyente != null) gestor.unregisterListener(oyente);
    }

    /** {disponible, version ("1.0.N"), estado}. disponible=false si no hay versión nueva o no viene de Google Play. */
    @PluginMethod
    public void comprobar(PluginCall call) {
        gestor.getAppUpdateInfo().addOnSuccessListener(info -> {
            ultimaInfo = info;
            JSObject r = new JSObject();
            boolean hay = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
                && info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE);
            r.put("disponible", hay);
            // versionCode = 100 + número de compilación (app/build.gradle) → versión 1.0.N
            int codigo = info.availableVersionCode();
            r.put("version", codigo > 100 ? "1.0." + (codigo - 100) : "");
            r.put("estado", nombre(info.installStatus()));
            call.resolve(r);
        }).addOnFailureListener(e -> {
            JSObject r = new JSObject();
            r.put("disponible", false);
            r.put("version", "");
            r.put("estado", "desconocido");
            r.put("error", String.valueOf(e.getMessage()));
            call.resolve(r);
        });
    }

    /** Abre la ventana de Google Play para descargar en segundo plano. Devuelve {aceptado}. */
    @PluginMethod
    public void iniciar(PluginCall call) {
        if (ultimaInfo == null || getActivity() == null) {
            call.reject("Primero hay que comprobar si hay actualización");
            return;
        }
        try {
            gestor.startUpdateFlow(ultimaInfo, getActivity(), AppUpdateOptions.defaultOptions(AppUpdateType.FLEXIBLE))
                .addOnSuccessListener(codigo -> {
                    JSObject r = new JSObject();
                    r.put("aceptado", codigo != null && codigo == android.app.Activity.RESULT_OK);
                    call.resolve(r);
                })
                .addOnFailureListener(e -> call.reject(String.valueOf(e.getMessage())));
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    /** Instala la versión ya descargada (la app se reinicia sola). */
    @PluginMethod
    public void completar(PluginCall call) {
        gestor.completeUpdate();
        call.resolve();
    }

    private static String nombre(int estado) {
        switch (estado) {
            case InstallStatus.PENDING: return "pendiente";
            case InstallStatus.DOWNLOADING: return "descargando";
            case InstallStatus.DOWNLOADED: return "descargada";
            case InstallStatus.INSTALLING: return "instalando";
            case InstallStatus.INSTALLED: return "instalada";
            case InstallStatus.FAILED: return "fallo";
            case InstallStatus.CANCELED: return "cancelada";
            default: return "nada";
        }
    }
}
