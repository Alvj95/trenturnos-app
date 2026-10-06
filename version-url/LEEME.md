# Versión URL

`index.html` en **un solo archivo** para la web que usan los compañeros (el otro GitHub).

- Es la versión de Halloween del HTML + el arreglo del menú fijo.
- Halloween también en la pantalla de inicio (luna, murciélagos, araña, fantasma, calabazas) y en el Portal de Interventor (fondo, adornos, saludo y botón 🎃 para elegir estética), solo hasta el 5 de noviembre.
- Altas de empleados nuevos: el empleado envía la solicitud con su base y fecha de ingreso y el admin solo acepta (un toque). Acceso provisional, perfil autorrellenado, caduca al subir el PDF de su base. Requiere ejecutar supabase-altas-empleados.sql una vez.
- Avisos de solicitudes de acceso para el admin: cartel y globo en 🧑‍💼 con las pendientes, notificación con el tipo y los datos, tarjeta "Avisos en este móvil" con prueba. Arregla que _crearEventoPush no existía fuera de su bloque (los avisos de acceso nunca se creaban).
- Botón atrás: cierra ventana → vuelve al Calendario → "Pulsa atrás otra vez para salir" → sale (y en Interventor, del detalle al menú).
- "Desliza hacia abajo para actualizar" propio (el del navegador no funciona con la pantalla fija).
- Al entrar suena un "ding-dong-ding" de megafonía de tren (propio, Web Audio: clic de micro, altavoz de techo, eco de vagón), una vez por visita y solo durante la pantalla de inicio.
- **Servicios a bordo** (tercer botón de la pantalla de entrada, 🍽️): se sube el PDF del MOL y la app lo lee en el móvil (coche, asiento, comida, menú, tramo, cumpleaños, nombre), lo enseña para comprobarlo y lo coloca en un mapa por coches. Ficha de cada asiento, "Servido", control de embarque (subió / no subió) y Resumen (qué preparar, por tramo, lista). Sin matrícula; todo se queda en el móvil y se borra a los 2 días de cargarlo. El código fuente está en `servicios/servicios.html` y se incrusta aquí con `python3 servicios/incrustar.py` (no editar a mano el bloque SERVICIOS:INICIO/FIN). El plano de asientos es provisional hasta tener el de cada serie. También lee **capturas (imágenes) del MOL**: limpia la imagen (quita los ⊟ de la tabla dinámica), la lee con OCR en el móvil, relee coche y asiento con tres lecturas y marca en naranja los dudosos para corregirlos o confirmarlos antes de colocarlos. Filtro por estación (suben en / bajan en) en Asientos y Resumen. Temas de temporada: Servicios recibe el tema activo de la app (ahora Halloween: fondo, adornos, saludo y botón 🎃 para elegir; cuando se active la Navidad, igual con 🎄) sin tener que tocar el módulo.
- **Acceso directo 🍽️ en el Calendario** (cabecera de Tripulante): abre Servicios sin cambiar de perfil; dentro, 📅 (o "atrás") vuelve al Calendario.
- **Compartir MOL** (📤 en Servicios): el móvil de la empresa comparte el MOL cargado con la matrícula de un compañero. Al compañero le sale un aviso en el Calendario ("📨 X te comparte el MOL", con punto rojo en 🍽️) y una notificación, y lo abre con el **código de 4 cifras** que ve quien lo comparte (5 intentos). Lo que marca cada uno (servido, subió / no subió) se ve en los dos móviles. Los nombres de clientes van apagados por defecto. Se borra solo a las 24 h o con "Dejar de compartir". **Requiere ejecutar una vez `supabase-servicios-compartidos.sql`** en Supabase → SQL Editor (sin él, todo lo demás funciona igual y compartir avisa de que falta activarlo).
- Sin Convenio: se quitó su tarjeta del Tutorial y ya no se carga `convenio-data.js` (no hace falta subirlo).
- No lleva nada de la app Android (`native-bridge.js`) ni temas en archivos aparte.
- Para publicarla: sustituir `index.html` en el otro GitHub (dejando allí `sw.js`).

La **versión Console** (app Android / Google Play) es la de la carpeta `www/` de este repositorio.
