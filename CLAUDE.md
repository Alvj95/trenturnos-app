# TrenTurnos V5 — guía para Claude

App de turnos para tripulantes, auxiliares e interventores de tren (Serveo / Renfe larga distancia). Dueño y administrador: **Alex** (GitHub `Alvj95`).

## Cómo trabajar con Alex (obligatorio)
- Hablar **siempre en español**, claro y sin tecnicismos. Si algo no está claro, **repetir lo entendido y preguntar** antes de hacerlo.
- **Maqueta primero** (imagen; GIF si hay movimiento) con **datos inventados**. Nunca nombres ni matrículas reales de compañeros.
- **Esperar su confirmación** («sí», «me gusta», «hazlo») antes de implementar.
- Implementar → **probar** → PR de `claude/keen-knuth-i2ir08` a `main`. **Alex acepta el PR**; nunca fusionar por él.
- Tras la fusión, GitHub publica `v5.0.N`: pasarle el **.aab** (`releases/download/v5.0.N/TrenTurnos.aab`, comprobando su contenido), el **`version-url/index.html`** y la **nota para Google Play**:
  ```
  <es-ES>
  🚆 Novedades de TrenTurnos

  🔗 …una línea por novedad, solo lo nuevo, < 500 caracteres…
  </es-ES>
  ```
- Commits con el pie `Co-Authored-By`; sin identificadores de modelo en el código ni en los commits.

## Seguridad (prioridad nº 1)
- «No hacer nada que dañe, corrompa o rompa la app.»
- **Nunca escribir en las tablas de Supabase de producción** para probar: solo lecturas. Los SQL los ejecuta Alex.
- La clave de servicio de Firebase es secreta. No poner correos personales en el código.
- Todo lo que pueda fallar va en `try/catch`: un fallo nunca tumba la app.

## Estructura
| Ruta | Qué es |
|---|---|
| `version-url/index.html` | Versión **web** (un solo archivo, ~38.700 líneas). |
| `www/index.html` | La misma app para **Android**; solo cambia la línea de `native-bridge.js`. **Cambiar siempre los dos a la vez.** |
| `www/native-bridge.js` | Puente con Android: notificaciones, alarmas nativas, widgets, fichaje, atrás, actualizaciones de Play. |
| `android/app/src/main/java/com/trenturnos/app/` | Java: widgets (`WidgetsMas`, `WidgetsVivos`, `CalendarioWidget`, `ProximosWidget`), `FichajeActivity`, `FichajeSalida`, plugins `TT*Plugin`. |
| `servicios/servicios.html` | Fuente de Servicios a bordo → `python3 servicios/incrustar.py <archivo>`. |
| `privacidad/privacidad.html` | Fuente de «No quiero aparecer» → `python3 privacidad/incrustar.py version-url/index.html www/index.html`. |
| `supabase/` | SQL y Edge Functions `vigila-retrasos`, `renfe-directo`, `enviar-fcm`. |

Datos en el móvil (localStorage): `tv5` turnos (TV), `tv2_extra` (TV2), `aj5` ajustes (AJ, con `alarmas` y `fichajes`), `comp5` compañero (COMP_DATA), `mtFabPos`.

## Reglas del trabajo
- **Deje**: 20 min en base, 15 fuera. Turno del **PDF** (horario individual): ya lleva el deje (+0). Turno **a mano**: se suma. **Ida de un ida y vuelta** del mismo día: solo el retraso.
- **Retraso**: de cada viaje cuenta el del **último tramo** (último tren que llega), aunque haya **continuidad** (`t.continuidad` tras la ida, `t.continuidadVuelta` tras la vuelta). «Mi tren» muestra **todos** los tramos.
- **DH**: «3062-3113DH» = ida trabajando y vuelta de DH; «3113-3113DH» = trabaja la 1ª mitad y DH la 2ª; «3113DH-3113» = al revés; «3113DH» = DH todo. El primer número distinto es la ida. **UM** = dos composiciones.
- **Fichaje**: entrada 5 min antes de la toma; salida **justo al acabar el deje** (ida y vuelta: solo al volver a base; pernocta: en el destino y al volver; con retraso se aplaza). **Reserva sin pinchar**: toma `reservaHoraToma`, fin `reservaHoraLlegada`, sin deje. Pinchada: pasa a ordinario con su tren.
- Meses: el calendario cuenta de 0 a 11; los Horarios Generales (`config_global` `horario_general_<sede>_<AAAA-MM>`) de 1 a 12.

## Compilar y probar
- `node --check www/native-bridge.js` y comprobar la sintaxis de los `<script>` de los HTML.
- Playwright con Chromium (`/opt/pw-browsers/chromium`): cargar el HTML con `localStorage` de prueba; para Android, `window.Capacitor` de imitación.
- Java: compilación real con GitHub Actions `android.yml` (workflow_dispatch en la rama). `verify-apk.yml` prueba la APK en emuladores Android 10 y 14 (si falla la descarga de la imagen de Google, se relanza).
- Push a `main` → release `v5.0.N` (`versionCode = 100 + N`). La APK de GitHub va firmada con otra clave: no instalarla encima de la de Google Play.

## Supabase
Proyecto `xoftsdupynwhzxsiusox`. Avisos de retraso: `vig_viajes` (uno por matrícula, fecha y tramo) ← `vig_subir`; `vigila-retrasos` cada 5 min → `eventos_push` → webhook → `enviar-fcm` → Firebase (`push_fcm`).
