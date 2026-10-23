# TrenTurnos V5 Servicios (app Android aparte)

Solo **Servicios a bordo**, como app de Google Play distinta de TrenTurnos
(`com.trenturnos.servicios`). El contenido es el mismo módulo `servicios/servicios.html`
de TrenTurnos: cuando se mejora Servicios, esta app se actualiza a la vez.

- `www/index.html`: la entrada (nombre y matrícula, Ajustes, avisos de MOL compartido),
  la misma que la web Solo Servicios. `native-bridge.js` es el puente con Android de TrenTurnos.
- `android/`: proyecto Capacitor. Icono «tren de frente + cubiertos».
- Compilación: `.github/workflows/android-servicios.yml` (misma clave de subida que TrenTurnos).
  Cada compilación de `main` publica una Release `servicios-v1.0.N` con el `.aab`.
