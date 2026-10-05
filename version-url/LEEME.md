# Versión URL

`index.html` en **un solo archivo** para la web que usan los compañeros (el otro GitHub).

- Es la versión de Halloween del HTML + el arreglo del menú fijo.
- Halloween también en la pantalla de inicio (luna, murciélagos, araña, fantasma, calabazas) y en el Portal de Interventor (fondo, adornos, saludo y botón 🎃 para elegir estética), solo hasta el 5 de noviembre.
- Altas de empleados nuevos: el empleado envía la solicitud con su base y fecha de ingreso y el admin solo acepta (un toque). Acceso provisional, perfil autorrellenado, caduca al subir el PDF de su base. Requiere ejecutar supabase-altas-empleados.sql una vez.
- Avisos de solicitudes de acceso para el admin: cartel y globo en 🧑‍💼 con las pendientes, notificación con el tipo y los datos, tarjeta "Avisos en este móvil" con prueba. Arregla que _crearEventoPush no existía fuera de su bloque (los avisos de acceso nunca se creaban).
- Botón atrás: cierra ventana → vuelve al Calendario → "Pulsa atrás otra vez para salir" → sale (y en Interventor, del detalle al menú).
- "Desliza hacia abajo para actualizar" propio (el del navegador no funciona con la pantalla fija).
- Al entrar suena un "ding-dong-ding" de megafonía de tren (propio, Web Audio: clic de micro, altavoz de techo, eco de vagón), una vez por visita y solo durante la pantalla de inicio.
- No lleva nada de la app Android (`native-bridge.js`) ni temas en archivos aparte.
- Para publicarla: sustituir `index.html` en el otro GitHub (dejando allí `convenio-data.js` y `sw.js`).

La **versión Console** (app Android / Google Play) es la de la carpeta `www/` de este repositorio.
