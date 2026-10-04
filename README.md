# TrenTurnos v5 — app Android

App Android (Capacitor) hecha a partir de `www/index.html`, el mismo HTML de la web de TrenTurnos.

## Instalar

1. Abre desde el teléfono la página **Releases** del repositorio y abre la más reciente.
2. Descarga `TrenTurnos.apk` (o `TrenTurnos-apk.zip` si el navegador bloquea el .apk).
3. Ábrelo y permite “instalar apps de origen desconocido”.

Cada push compila un APK nuevo con GitHub Actions (`.github/workflows/android.yml`).

## Actualizar la app con una versión nueva del HTML

1. Sustituye `www/index.html` por tu nuevo HTML.
2. Vuelve a poner, justo debajo de `<meta charset="UTF-8">`, la línea:
   `<script src="native-bridge.js"></script>`
3. Si cambias el convenio, sustituye `www/convenio-data.js` (tiene que llamarse exactamente así).
4. Haz push: GitHub Actions genera el APK nuevo.

## Archivos

| Archivo | Qué es |
| --- | --- |
| `www/index.html` | Tu app (sin cambios salvo la línea de `native-bridge.js`) |
| `www/convenio-data.js` | Texto del Convenio Colectivo |
| `www/native-bridge.js` | Hace que en Android funcionen *Compartir*, las descargas (Excel) y las notificaciones. En la web no hace nada |
| `capacitor.config.json` | Nombre (`TrenTurnos`) e identificador (`com.trenturnos.app`) de la app |
| `android/` | Proyecto nativo de Android |

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
