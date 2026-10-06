# TrenTurnos v5 — app Android

App Android (Capacitor) hecha a partir de `www/index.html`, el mismo HTML de la web de TrenTurnos.

## Versiones

- **Versión Console**: la app Android de Google Play (carpeta `www/`).
- **Versión URL**: `index.html` de un solo archivo para la web de los compañeros (carpeta `version-url/`, no entra en la app).

## Instalar

1. Abre desde el teléfono la página **Releases** del repositorio y abre la más reciente.
2. Descarga `TrenTurnos.apk` (o `TrenTurnos-apk.zip` si el navegador bloquea el .apk).
3. Ábrelo y permite “instalar apps de origen desconocido”.

Cada push compila un APK nuevo con GitHub Actions (`.github/workflows/android.yml`).

## Actualizar la app con una versión nueva del HTML

1. Sustituye `www/index.html` por tu nuevo HTML (la versión **sin** temas de temporada).
2. Vuelve a poner, justo debajo de `<meta charset="UTF-8">`, las líneas:
   ```html
   <script src="native-bridge.js"></script>
   <script src="tema-halloween.js"></script>
   ```
   (la segunda solo mientras haya un tema de temporada; ver abajo).
3. Vuelve a incrustar Servicios: `python3 servicios/incrustar.py www/index.html`.
4. Haz push: GitHub Actions genera el APK nuevo.

## Temas de temporada (Halloween, Navidad…)

Cada tema vive en su propio archivo (`www/tema-halloween.js`) y `index.html` solo lo carga con una línea.
El tema solo actúa entre sus fechas (`HW_DESDE` / `HW_HASTA` dentro del archivo); fuera de ellas no añade nada.
Cuando termine la temporada, borra el archivo y su línea `<script>`: el HTML principal no se toca.
Servicios a bordo recibe solo el tema activo (Halloween o Navidad) sin tocar su código.

En las dos versiones, el botón 🍽️ del Calendario abre Servicios sin cambiar de perfil. **Compartir MOL** (📤) lo manda a la matrícula de un compañero, que lo abre con un código de 4 cifras; lo marcado se sincroniza entre los dos móviles. Necesita `version-url/supabase-servicios-compartidos.sql` ejecutado una vez en Supabase.

## Archivos

| Archivo | Qué es |
| --- | --- |
| `www/index.html` | Tu app (sin cambios salvo la línea de `native-bridge.js`) |
| `servicios/servicios.html` | **Servicios a bordo** (fuente). Se incrusta en `www/index.html` y en `version-url/index.html` con `python3 servicios/incrustar.py [archivo]`; no editar a mano el bloque `SERVICIOS:INICIO/FIN` |
| `www/tema-halloween.js` | Tema de Halloween (del 1 de octubre al 5 de noviembre): app, pantalla de inicio y Portal de Interventor |
| `www/tema-navidad.js` | Tema de Navidad (del 1 de diciembre al 6 de enero). **Preparado pero aún no conectado**: para activarlo, añade `<script src="tema-navidad.js"></script>` debajo de la línea del tema de Halloween en `index.html` |
| `www/native-bridge.js` | Hace que en Android funcionen *Compartir*, las descargas (Excel) y las notificaciones. En la web no hace nada |
| `capacitor.config.json` | Nombre (`TrenTurnos`) e identificador (`com.trenturnos.app`) de la app |
| `android/` | Proyecto nativo de Android |

## Supabase

Las altas de empleados nuevos (acceso provisional) necesitan tres columnas en `solicitudes_acceso`.
Ejecutar una vez `version-url/supabase-altas-empleados.sql` en Supabase → SQL Editor.

## Google Play

Google Play pide un **App Bundle (`.aab`)** firmado con una clave privada de subida (*upload key*).

1. En GitHub: **Settings → Secrets and variables → Actions → New repository secret** y crea:
   - `UPLOAD_KEYSTORE_BASE64`: el contenido del keystore en base64.
   - `UPLOAD_KEYSTORE_PASSWORD`: su contraseña (alias `upload`).
2. A partir del siguiente push, cada release trae también `TrenTurnos.aab`.
3. Súbelo en Play Console → *Prueba cerrada* (o *Producción*) → *Crear versión*, con **Play App Signing** activado.

Guarda una copia del keystore y su contraseña fuera de GitHub: sin ellos no se pueden publicar actualizaciones.
El `.apk` de Releases sigue firmado con la clave de prueba del repo, así que quien lo instaló a mano tendrá que
desinstalarlo antes de instalar la versión de Google Play.

## Limitaciones

- Necesita internet para las librerías que el HTML carga de CDN (PDF, OCR, Excel, Supabase) y para las fuentes.
- Las notificaciones push con la app cerrada (service worker) no funcionan dentro de la app; las alarmas con la app abierta sí.
- Para Google Play hace falta firmar con una clave privada propia y una cuenta de desarrollador (25 USD, pago único).
