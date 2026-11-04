package com.trenturnos.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Calendar;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Alarma para fichar la SALIDA, justo al acabar el deje (maqueta aprobada).
 *
 * La app (native-bridge.js) calcula para los próximos días la hora de salida de cada turno
 * (llegada del tren + deje: 15 fuera de base, 20 en base; turnos del PDF ya lo llevan; reserva
 * sin pinchar = hora fin) y la manda aquí con TTFichaje.programarSalidas.
 *
 * Retraso: desde 15 min antes de la llegada prevista, el móvil mira solo el retraso del tren en
 * el intermediario de Renfe que ya usa «Mi tren ahora» (renfe-directo, solo lectura) y, si va
 * tarde, aplaza la alarma a llegada + retraso + deje, y lo vuelve a mirar hasta que llega.
 * Sin conexión ni datos, suena a la hora prevista. Funciona con la app cerrada.
 */
public final class FichajeSalida {

    private FichajeSalida() {}

    static final String ACC_MIRAR = "com.trenturnos.app.fichaje.MIRAR";
    static final String ACC_SONAR = "com.trenturnos.app.fichaje.SONAR";
    static final String CANAL = "alarmas"; // el mismo canal que la alarma de entrada
    private static final String PREFS = "tt_fichaje_salida";
    private static final String RENFE = "https://xoftsdupynwhzxsiusox.supabase.co/functions/v1/renfe-directo";
    private static final int NOTIF_BASE = 885000, AVISO_BASE = 886000;

    static SharedPreferences prefs(Context c) { return c.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    static void log(Exception e) { android.util.Log.w("TrenTurnos", "fichaje salida", e); }

    /** Guarda la lista nueva y programa sus alarmas (borra las de antes). */
    static synchronized void programar(Context ctx, JSONArray lista, boolean abrir) {
        Context app = ctx.getApplicationContext();
        JSONObject antes = leer(app, "estado");
        JSONArray vieja = leerLista(app);
        for (int i = 0; i < vieja.length(); i++) { JSONObject v = vieja.optJSONObject(i); if (v != null) cancelar(app, v.optInt("id")); }
        // Se conserva el retraso ya visto si el turno es el mismo.
        JSONObject estado = new JSONObject();
        for (int i = 0; i < lista.length(); i++) {
            JSONObject v = lista.optJSONObject(i); if (v == null) continue;
            String id = String.valueOf(v.optInt("id"));
            JSONObject e = antes == null ? null : antes.optJSONObject(id);
            if (e != null && e.optLong("fin") == v.optLong("fin") && e.optString("tren").equals(v.optString("tren"))) {
                try { estado.put(id, e); } catch (Exception ignored) {}
            }
        }
        prefs(app).edit().putString("lista", lista.toString()).putString("estado", estado.toString()).putBoolean("abrir", abrir).apply();
        reprogramarTodo(app);
    }

    static JSONArray leerLista(Context c) { try { return new JSONArray(prefs(c).getString("lista", "[]")); } catch (Exception e) { return new JSONArray(); } }
    static JSONObject leer(Context c, String k) { try { return new JSONObject(prefs(c).getString(k, "{}")); } catch (Exception e) { return new JSONObject(); } }
    static JSONObject item(Context c, int id) {
        JSONArray l = leerLista(c);
        for (int i = 0; i < l.length(); i++) { JSONObject v = l.optJSONObject(i); if (v != null && v.optInt("id") == id) return v; }
        return null;
    }
    static JSONObject estado(Context c, int id) { JSONObject e = leer(c, "estado").optJSONObject(String.valueOf(id)); return e == null ? new JSONObject() : e; }
    static synchronized void guardarEstado(Context c, int id, JSONObject e) {
        JSONObject todo = leer(c, "estado");
        try { todo.put(String.valueOf(id), e); } catch (Exception ignored) {}
        prefs(c).edit().putString("estado", todo.toString()).apply();
    }

    /** Hora a la que debe sonar: la prevista + el retraso visto. */
    static long horaFinal(JSONObject v, JSONObject e) { return v.optLong("fin") + e.optInt("ret", 0) * 60_000L; }

    /** Programa (otra vez) las alarmas de toda la lista: al abrir la app, al reiniciar el móvil… */
    static void reprogramarTodo(Context c) {
        JSONArray l = leerLista(c); long ahora = System.currentTimeMillis();
        for (int i = 0; i < l.length(); i++) {
            JSONObject v = l.optJSONObject(i); if (v == null) continue;
            int id = v.optInt("id"); JSONObject e = estado(c, id);
            if (e.optBoolean("hecho")) continue;
            long fin = horaFinal(v, e);
            if (fin < ahora - 10 * 60_000L) continue; // ya pasó
            poner(c, id, ACC_SONAR, Math.max(fin, ahora + 2000));
            long llega = v.optLong("llega");
            if (!v.optString("tren").isEmpty() && llega > 0) poner(c, id, ACC_MIRAR, Math.max(llega - 15 * 60_000L, ahora + 5000));
        }
    }

    static PendingIntent pi(Context c, int id, String accion) {
        Intent i = new Intent(c, Receptor.class).setAction(accion).putExtra("id", id);
        int cod = (ACC_SONAR.equals(accion) ? 0 : 1) + id * 2;
        return PendingIntent.getBroadcast(c, cod, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static void poner(Context c, int id, String accion, long cuando) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent p = pi(c, id, accion);
        boolean exacta = ACC_SONAR.equals(accion) && (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms());
        try {
            if (exacta) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, p);
            else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cuando, p);
        } catch (Exception e) { log(e); try { am.set(AlarmManager.RTC_WAKEUP, cuando, p); } catch (Exception ignored) {} }
    }
    static void cancelar(Context c, int id) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try { am.cancel(pi(c, id, ACC_SONAR)); am.cancel(pi(c, id, ACC_MIRAR)); } catch (Exception ignored) {}
    }

    static String hora(long t) {
        Calendar c = Calendar.getInstance(); c.setTimeInMillis(t);
        return String.format(Locale.ROOT, "%02d:%02d", c.get(Calendar.HOUR_OF_DAY), c.get(Calendar.MINUTE));
    }

    // ── Mirar el retraso del tren (en segundo plano) ──
    static void mirar(Context c, int id) {
        JSONObject v = item(c, id); if (v == null) return;
        JSONObject e = estado(c, id);
        if (e.optBoolean("hecho")) return;
        long ahora = System.currentTimeMillis(), llega = v.optLong("llega");
        int retAntes = e.optInt("ret", 0);
        Integer ret = null; boolean hay = false, error = false;
        try {
            HttpURLConnection con = (HttpURLConnection) new URL(RENFE + "?tren=" + v.optString("tren") + "&v=" + ahora).openConnection();
            con.setConnectTimeout(8000); con.setReadTimeout(8000); con.setUseCaches(false);
            con.setRequestProperty("Accept", "application/json");
            if (con.getResponseCode() != 200) throw new Exception("HTTP " + con.getResponseCode());
            StringBuilder sb = new StringBuilder();
            BufferedReader r = new BufferedReader(new InputStreamReader(con.getInputStream(), "UTF-8"));
            char[] b = new char[4096]; int n;
            while ((n = r.read(b)) > 0 && sb.length() < 500_000) sb.append(b, 0, n);
            r.close(); con.disconnect();
            JSONObject t = new JSONObject(sb.toString()).optJSONObject("tren");
            if (t != null) {
                hay = true;
                try { int x = Integer.parseInt(t.optString("ultRetraso", "").trim()); if (x >= 0 && x <= 600) ret = x; } catch (Exception ignored) {}
            }
        } catch (Exception ex) { error = true; }

        if (ret != null && ret != retAntes) {
            try { e.put("ret", ret); } catch (Exception ignored) {}
            guardarEstado(c, id, e);
            long fin = horaFinal(v, e);
            poner(c, id, ACC_SONAR, Math.max(fin, ahora + 2000));
            // Aviso si la alarma se mueve 2 min o más.
            if (Math.abs(ret - retAntes) >= 2) avisoRetraso(c, id, v, ret, fin);
        }
        // ¿Volver a mirar? Mientras el tren no haya llegado (llegada prevista + retraso + margen).
        int r = ret != null ? ret : retAntes;
        long llegaReal = llega + r * 60_000L;
        boolean seguir = ahora < llegaReal + 5 * 60_000L && (hay || error || ahora < llega + 30 * 60_000L);
        if (seguir) poner(c, id, ACC_MIRAR, ahora + (llegaReal - ahora > 30 * 60_000L ? 10 : 5) * 60_000L);
    }

    static void canal(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CANAL) != null) return;
        NotificationChannel ch = new NotificationChannel(CANAL, "Alarma inteligente", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Avisos para fichar la entrada y la salida");
        ch.enableVibration(true);
        nm.createNotificationChannel(ch);
    }

    static PendingIntent abrirFichaje(Context c, int cod) {
        Intent i = new Intent(c, FichajeActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, cod, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
    static PendingIntent abrirApp(Context c, int cod) {
        Intent i = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (i == null) i = new Intent(c, MainActivity.class);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, cod, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void avisoRetraso(Context c, int id, JSONObject v, int ret, long fin) {
        try {
            canal(c);
            String t = ret > 0 ? "⏱️ Tu tren " + v.optString("tren") + " va con +" + ret + " min" : "✅ Tu tren " + v.optString("tren") + " va en hora";
            NotificationCompat.Builder b = new NotificationCompat.Builder(c, CANAL)
                .setSmallIcon(R.drawable.ic_stat_trenturnos).setColor(0xFFF97316)
                .setContentTitle(t).setContentText("La alarma de salida pasa a las " + hora(fin))
                .setPriority(NotificationCompat.PRIORITY_DEFAULT).setOnlyAlertOnce(true).setSilent(true)
                .setAutoCancel(true).setContentIntent(abrirApp(c, AVISO_BASE + id));
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.notify(AVISO_BASE + id, b.build());
        } catch (Exception ex) { log(ex); }
    }

    // ── Sonar: «🕒 Fichar salida» ──
    static void sonar(Context c, int id) {
        JSONObject v = item(c, id); if (v == null) return;
        JSONObject e = estado(c, id);
        if (e.optBoolean("hecho")) return;
        long fin = horaFinal(v, e), ahora = System.currentTimeMillis();
        if (fin > ahora + 60_000L) { poner(c, id, ACC_SONAR, fin); return; } // el retraso la movió: aún no toca
        try { e.put("hecho", true); } catch (Exception ignored) {}
        guardarEstado(c, id, e);
        try {
            canal(c);
            int ret = e.optInt("ret", 0), deje = v.optInt("deje", 0);
            String tren = v.optString("tren"), cuerpo;
            if (!tren.isEmpty()) cuerpo = "Tren " + tren + (ret > 0 ? " llegó con +" + ret + " min" : "") + (deje > 0 ? " · deje " + (v.optBoolean("base") ? "en base " : "fuera de base ") + deje + " min" : "");
            else cuerpo = v.optString("txt", "Fin del turno");
            boolean abrir = prefs(c).getBoolean("abrir", true);
            NotificationCompat.Builder b = new NotificationCompat.Builder(c, CANAL)
                .setSmallIcon(R.drawable.ic_stat_trenturnos).setColor(0xFFF97316)
                .setContentTitle("🕒 Fichar salida · " + hora(fin)).setContentText(cuerpo)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(cuerpo))
                .setPriority(NotificationCompat.PRIORITY_MAX).setCategory(NotificationCompat.CATEGORY_ALARM)
                .setDefaults(NotificationCompat.DEFAULT_ALL).setAutoCancel(true)
                .setContentIntent(abrir ? abrirFichaje(c, NOTIF_BASE + id) : abrirApp(c, NOTIF_BASE + id))
                .addAction(0, "🕒 Fichar ahora", abrirFichaje(c, NOTIF_BASE + 500 + id));
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) { nm.cancel(AVISO_BASE + id); nm.notify(NOTIF_BASE + id, b.build()); }
        } catch (Exception ex) { log(ex); }
    }

    /** Recibe las alarmas (mirar / sonar) y el reinicio del móvil. */
    public static class Receptor extends BroadcastReceiver {
        @Override public void onReceive(Context ctx, Intent i) {
            final Context c = ctx.getApplicationContext();
            final String a = i.getAction();
            final int id = i.getIntExtra("id", -1);
            final PendingResult pr = goAsync();
            new Thread(() -> {
                try {
                    if (ACC_MIRAR.equals(a)) mirar(c, id);
                    else if (ACC_SONAR.equals(a)) sonar(c, id);
                    else if (Intent.ACTION_BOOT_COMPLETED.equals(a) || "android.intent.action.MY_PACKAGE_REPLACED".equals(a)) reprogramarTodo(c);
                } catch (Exception e) { log(e); }
                finally { try { pr.finish(); } catch (Exception ignored) {} }
            }).start();
        }
    }
}
