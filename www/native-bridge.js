/*
 * Puente nativo para la app Android (Capacitor).
 *
 * El WebView de Android no trae algunas APIs que TrenTurnos usa en el
 * navegador. Este archivo las rellena con los plugins nativos, sin tocar
 * el código de index.html:
 *   - navigator.share / navigator.canShare  → hoja "Compartir" de Android
 *   - descargas <a download> (p. ej. XLSX.writeFile) → se guardan y se
 *     abre "Compartir" para mandarlas a Drive, WhatsApp, Archivos…
 *   - window.Notification → notificaciones locales del sistema
 *   - pantalla fija: la página no se desplaza, el menú inferior no se mueve
 *   - botón "atrás" de Android: no cierra la app de golpe (ver index.html)
 *
 * En el navegador normal (web/PWA) no hace nada.
 */
(function () {
  var Cap = window.Capacitor;
  if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return;
  var P = Cap.Plugins || {};
  var Share = P.Share, Filesystem = P.Filesystem, LocalNotifications = P.LocalNotifications;

  // ── Pantalla fija, como una app nativa ──────────────────────
  // La página nunca se desplaza ni rebota: solo el contenido de dentro.
  // Así el menú inferior no se mueve aunque un HTML nuevo traiga CSS
  // que haga la página más alta que la pantalla.
  var fixStyle = document.createElement('style');
  fixStyle.textContent =
    'html,body{height:100%!important;overflow:hidden!important;overscroll-behavior:none!important}' +
    'body{padding-bottom:0!important}';
  (document.head || document.documentElement).appendChild(fixStyle);

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { reject(r.error); };
      r.readAsDataURL(blob);
    });
  }

  function safeName(name) {
    return String(name || 'archivo').replace(/[\\/:*?"<>|]+/g, '_');
  }

  // Guarda un Blob en la caché de la app y devuelve su URI nativa.
  function writeCacheFile(blob, name) {
    return blobToBase64(blob).then(function (data) {
      return Filesystem.writeFile({
        path: 'compartir/' + Date.now() + '-' + safeName(name),
        data: data,
        directory: 'CACHE',
        recursive: true
      });
    }).then(function (res) { return res.uri; });
  }

  function shareBlob(blob, name, title) {
    return writeCacheFile(blob, name).then(function (uri) {
      return Share.share({ title: title || name, files: [uri], dialogTitle: 'Guardar o compartir' });
    });
  }

  function isCancel(err) {
    return /cancel/i.test(String((err && err.message) || err));
  }

  // ── Botón "atrás" de Android ────────────────────────────────
  // Sin esto Android cierra la app al pulsar "atrás". Se pasa al
  // historial de la página, donde index.html decide: cerrar ventana,
  // volver al inicio, o avisar y salir con la segunda pulsación.
  if (P.App && P.App.addListener) {
    P.App.addListener('backButton', function (ev) {
      if (ev && ev.canGoBack) window.history.back();
      else P.App.exitApp();
    });
  }

  // ── navigator.share / canShare ───────────────────────────────
  if (Share && Filesystem) {
    navigator.canShare = function () { return true; };
    navigator.share = function (data) {
      data = data || {};
      var files = Array.prototype.slice.call(data.files || []);
      return Promise.all(files.map(function (f) { return writeCacheFile(f, f.name); }))
        .then(function (uris) {
          var opts = { dialogTitle: 'Compartir' };
          if (data.title) opts.title = data.title;
          if (data.text) opts.text = data.text;
          if (data.url) opts.url = data.url;
          if (uris.length) opts.files = uris;
          return Share.share(opts);
        })
        .then(function () {}, function (err) {
          // Mismo contrato que la API web: cancelar = AbortError.
          var e = new Error(String((err && err.message) || err));
          e.name = isCancel(err) ? 'AbortError' : 'NotAllowedError';
          throw e;
        });
    };

    // ── Descargas <a download href="blob:…|data:…"> ────────────
    var nativeClick = HTMLAnchorElement.prototype.click;
    function handleDownload(a) {
      var href = a.href || '';
      if (!a.hasAttribute('download') || !/^(blob|data):/.test(href)) return false;
      var name = a.getAttribute('download') || 'archivo';
      fetch(href).then(function (r) { return r.blob(); })
        .then(function (blob) { return shareBlob(blob, name); })
        .catch(function (err) {
          if (!isCancel(err)) alert('No se pudo guardar el archivo: ' + ((err && err.message) || err));
        });
      return true;
    }
    HTMLAnchorElement.prototype.click = function () {
      if (handleDownload(this)) return;
      return nativeClick.apply(this, arguments);
    };
    document.addEventListener('click', function (ev) {
      var a = ev.target && ev.target.closest && ev.target.closest('a[download]');
      if (a && handleDownload(a)) ev.preventDefault();
    }, true);
  }

  // ── window.Notification → notificaciones locales ────────────
  if (LocalNotifications) {
    var nextId = 1;
    function NativeNotification(title, options) {
      options = options || {};
      this.title = title;
      this.body = options.body || '';
      if (NativeNotification.permission !== 'granted') return;
      LocalNotifications.schedule({
        notifications: [{
          id: (Date.now() % 2000000000) + (nextId++),
          title: String(title || 'TrenTurnos'),
          body: String(options.body || '')
        }]
      }).catch(function () {});
    }
    NativeNotification.prototype.close = function () {};
    NativeNotification.permission = 'default';
    NativeNotification.requestPermission = function (cb) {
      return LocalNotifications.requestPermissions().then(function (r) {
        var p = r.display === 'granted' ? 'granted' : (r.display === 'denied' ? 'denied' : 'default');
        NativeNotification.permission = p;
        if (typeof cb === 'function') cb(p);
        return p;
      });
    };
    LocalNotifications.checkPermissions().then(function (r) {
      NativeNotification.permission = r.display === 'granted' ? 'granted' : (r.display === 'denied' ? 'denied' : 'default');
    }).catch(function () {});
    window.Notification = NativeNotification;
  }

  // ── Notificaciones push (Firebase) ──────────────────────────
  // En el navegador los avisos llegan por Web Push; el WebView de Android no
  // lo tiene. Aquí el móvil se registra en Firebase y guarda su "token" en
  // Supabase con la matrícula (función registrar_token_fcm). La función
  // enviar-fcm de Supabase manda cada aviso de eventos_push a esos móviles.
  // La versión web no cambia: esto solo existe dentro de la app Android.
  var Push = P.PushNotifications;
  if (Push) {
    var CANAL = 'trenturnos', tokenActual = null, escuchando = false;

    function matricula() {
      try { return (window.AJ && window.AJ.matricula) ? String(window.AJ.matricula).trim() : ''; } catch (e) { return ''; }
    }
    function pintarEstado(html) {
      var el = document.getElementById('notifPushEstado');
      if (el) el.innerHTML = html;
    }
    function guardarToken(token) {
      tokenActual = token;
      var mat = matricula(), sb = window.sbAdmin;
      if (!mat) { pintarEstado('<span style="color:var(--nar3)">⚠️ Configura tu matrícula en Ajustes → Perfil primero.</span>'); return Promise.resolve(false); }
      if (!sb) return Promise.resolve(false);
      return sb.rpc('registrar_token_fcm', { p_matricula: mat, p_token: token }).then(function (r) {
        if (r.error) {
          pintarEstado('<span style="color:var(--nar3)">⚠️ Falta activar las notificaciones de Android en el servidor (' + (r.error.message || 'error') + ').</span>');
          return false;
        }
        try { localStorage.setItem('trenturnosFcmMatricula', mat); } catch (e) {}
        pintarEstado('<span style="color:var(--green2)">✅ Notificaciones activadas en este móvil.</span>');
        return true;
      }, function () { return false; });
    }
    function escuchar() {
      if (escuchando) return; escuchando = true;
      Push.addListener('registration', function (t) { if (t && t.value) guardarToken(t.value); });
      Push.addListener('registrationError', function (e) {
        pintarEstado('<span style="color:var(--nar3)">⚠️ No se pudo registrar el móvil: ' + ((e && e.error) || 'error') + '</span>');
      });
      // Con la app abierta Android no enseña el aviso: se muestra como notificación local
      // y se revisa en el momento si hay un MOL compartido.
      Push.addListener('pushNotificationReceived', function (n) {
        if (LocalNotifications) LocalNotifications.schedule({ notifications: [{
          id: (Date.now() % 2000000000), title: String(n.title || 'TrenTurnos'), body: String(n.body || ''), channelId: CANAL }] }).catch(function () {});
        try { if (window.__svComprobarCompartidos) window.__svComprobarCompartidos(); } catch (e) {}
      });
      Push.addListener('pushNotificationActionPerformed', function () {
        try { if (window.__svComprobarCompartidos) window.__svComprobarCompartidos(); } catch (e) {}
      });
    }
    function crearCanal() {
      var c = { id: CANAL, name: 'Avisos de TrenTurnos', description: 'Cambios de turno, MOL compartidos y avisos de la app', importance: 4, visibility: 1, vibration: true };
      return Promise.all([
        Push.createChannel(c).catch(function () {}),
        LocalNotifications && LocalNotifications.createChannel ? LocalNotifications.createChannel(c).catch(function () {}) : null
      ]);
    }
    // interactivo = lo ha pedido la persona (botón): se pide permiso si hace falta.
    function activar(interactivo) {
      escuchar();
      return Push.checkPermissions().then(function (r) {
        if (r.receive === 'granted') return 'granted';
        if (!interactivo) return r.receive;
        return Push.requestPermissions().then(function (q) { return q.receive; });
      }).then(function (perm) {
        if (perm !== 'granted') {
          if (interactivo) pintarEstado('<span style="color:var(--nar3)">⚠️ No diste permiso. Puedes activarlo en Ajustes de Android → Apps → TrenTurnos → Notificaciones.</span>');
          return false;
        }
        if (window.Notification) window.Notification.permission = 'granted';
        return crearCanal().then(function () { return Push.register(); }).then(function () { return true; });
      }).catch(function (e) {
        if (interactivo) pintarEstado('<span style="color:var(--nar3)">⚠️ Error: ' + ((e && e.message) || e) + '</span>');
        return false;
      });
    }

    // Se sustituyen (solo en la app Android) los botones de Ajustes y del panel de admin.
    function enganchar() {
      window.activarNotificacionesPush = function () {
        if (!matricula()) { pintarEstado('<span style="color:var(--nar3)">⚠️ Configura tu matrícula en Ajustes → Perfil primero.</span>'); return Promise.resolve(); }
        pintarEstado('<span style="color:var(--tx3)">Activando...</span>');
        return activar(true);
      };
      window.avisosAdminEstado = function () {
        var el = document.getElementById('avisosAdminEstado'), btn = document.getElementById('avisosAdminBtnActivar');
        if (!el) return;
        Push.checkPermissions().then(function (r) {
          var activo = r.receive === 'granted' && !!tokenActual, mat = matricula();
          el.textContent = 'Notificaciones (app Android): ' + (activo ? '✅ activadas' : (r.receive === 'denied' ? '🚫 bloqueadas en Ajustes de Android' : '❌ sin activar')) +
            '\nMatrícula de este móvil (Ajustes → Perfil): ' + (mat || '— sin poner —');
          el.style.whiteSpace = 'pre-line';
          el.classList.toggle('sin-archivo', !activo);
          if (btn) btn.style.display = activo ? 'none' : '';
        }).catch(function () {});
      };
      window.avisosAdminActivar = function () {
        return window.activarNotificacionesPush().then(function () {
          var msg = document.getElementById('avisosAdminMsg'), st = document.getElementById('notifPushEstado');
          if (msg && st) msg.innerHTML = st.innerHTML;
          setTimeout(window.avisosAdminEstado, 1500);
        });
      };
      // Al abrir el panel de admin, su tarjeta de avisos muestra el estado de Android.
      var abrirAdmin = window.abrirAccesoAdmin;
      if (typeof abrirAdmin === 'function') {
        window.abrirAccesoAdmin = function () { var r = abrirAdmin.apply(this, arguments); setTimeout(window.avisosAdminEstado, 120); return r; };
      }
      // Si ya dio permiso antes, al abrir la app se renueva el registro (el token puede cambiar)
      // y, si cambió la matrícula en Ajustes, se vuelve a guardar con la nueva.
      setTimeout(function () { if (matricula()) activar(false); }, 5000);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden || !tokenActual) return;
        var antes = ''; try { antes = localStorage.getItem('trenturnosFcmMatricula') || ''; } catch (e) {}
        if (matricula() && matricula() !== antes) guardarToken(tokenActual);
      });
    }
    if (document.readyState === 'complete') enganchar();
    else window.addEventListener('load', function () { setTimeout(enganchar, 0); });
  }
})();
