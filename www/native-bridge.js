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

  // ── ⏰ Alarma inteligente programada en el móvil ────────────
  // En la web, la alarma solo avisa con la app abierta (mira la hora cada 30 s). Aquí se
  // programan en Android, para los próximos 14 días, las de 5 min antes de fichar y 45 min
  // antes de salir fuera de base: suenan aunque la app esté cerrada o el móvil bloqueado.
  // Se reprograman al abrir la app, al salir de ella y al cambiar turnos o ajustes.
  if (LocalNotifications) {
    var CANAL_AL = 'alarmas', ID_AL = 880000, DIAS_AL = 14, alTimer = null, alInexacta = false, alN = 0;
    function alMismaEst(a, b) {
      function n(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
      a = n(a); b = n(b);
      return !!a && !!b && (a === b || a.indexOf(b) === 0 || b.indexOf(a) === 0);
    }
    function alHora(s) { var m = /^(\d{1,2}):(\d{2})/.exec(String(s || '')); return m ? [+m[1], +m[2]] : null; }
    function alClave(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    // Las alarmas que tocan, con la hora exacta de cada una.
    function alCalcular() {
      var AJ = window.AJ, TV = window.TV, out = [], ahora = Date.now();
      if (!AJ || !TV || !AJ.alarmas || !AJ.alarmas.activas) return out;
      for (var i = 0; i < DIAS_AL; i++) {
        var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
        var t = TV[alClave(d)], h = t && alHora(t.hF);
        if (!t || !h) continue;
        var toma = new Date(d); toma.setHours(h[0], h[1], 0, 0);
        if (AJ.alarmas.fichar !== false && ['ordinario', 'trabajado', 'reserva'].indexOf(t.tipo) > -1) {
          out.push({ id: ID_AL + i * 2, at: new Date(toma.getTime() - 5 * 60000),
            title: '⏰ Fichar en ' + t.hF, body: 'Turno ' + t.tipo + ' · Firma en 5 minutos' });
        }
        if (AJ.alarmas.salida !== false && ['ordinario', 'trabajado'].indexOf(t.tipo) > -1 && t.sal && AJ.base && !alMismaEst(t.sal, AJ.base)) {
          out.push({ id: ID_AL + i * 2 + 1, at: new Date(toma.getTime() - 45 * 60000),
            title: '🚆 Salir hacia ' + t.sal + ' (' + t.hF + ')', body: 'Estás fuera de base — tienes 45 min para llegar al tren' });
        }
      }
      return out.filter(function (a) { return a.at.getTime() > ahora + 30000; });
    }
    function alCanal() {
      return LocalNotifications.createChannel ? LocalNotifications.createChannel({ id: CANAL_AL, name: 'Alarma inteligente',
        description: 'Aviso 5 min antes de fichar y 45 min antes de salir fuera de base', importance: 5, visibility: 1, vibration: true }).catch(function () {}) : Promise.resolve();
    }
    function alBorrarProgramadas() {
      return LocalNotifications.getPending().then(function (r) {
        var ids = ((r && r.notifications) || []).filter(function (n) { return n.id >= ID_AL && n.id < ID_AL + 1000; }).map(function (n) { return { id: n.id }; });
        return ids.length ? LocalNotifications.cancel({ notifications: ids }) : null;
      }).catch(function () {});
    }
    function alPintarEstado() {
      var sw = document.getElementById('alarm-sw'), body = sw && sw.closest('.aj-card-body');
      if (!body) return;
      var el = document.getElementById('alarm-nativa');
      if (!el) { el = document.createElement('div'); el.id = 'alarm-nativa'; el.style.cssText = 'font-size:11.5px;line-height:1.45;margin-top:10px;color:var(--tx2)'; body.appendChild(el); }
      var on = window.AJ && AJ.alarmas && AJ.alarmas.activas;
      el.innerHTML = !on ? '' : (window.__alarmasNativas
        ? '📱 <b style="color:var(--green2)">' + alN + ' alarma' + (alN === 1 ? '' : 's') + ' programada' + (alN === 1 ? '' : 's') + '</b> en el móvil para los próximos ' + DIAS_AL + ' días: suenan aunque la app esté cerrada.'
        : '⚠️ Sin permiso de notificaciones: las alarmas solo suenan con la app abierta.') +
        (window.__alarmasNativas && alInexacta ? '<br><span style="color:var(--nar3)">⚠️ Android puede retrasarlas unos minutos.</span> <a href="#" onclick="window.__alarmaPermisoExacto();return false" style="color:var(--acc3);font-weight:800">Permitir hora exacta</a>' : '');
    }
    window.__alarmaPermisoExacto = function () {
      if (LocalNotifications.changeExactNotificationSetting) LocalNotifications.changeExactNotificationSetting().then(function () { alProgramar(); }).catch(function () {});
    };
    function alProgramar() {
      return LocalNotifications.checkPermissions().then(function (p) {
        var lista = alCalcular(), on = window.AJ && AJ.alarmas && AJ.alarmas.activas;
        if (p.display !== 'granted' || !on) {
          window.__alarmasNativas = false; alN = 0;
          return alBorrarProgramadas().then(alPintarEstado);
        }
        return alCanal().then(alBorrarProgramadas).then(function () {
          if (!lista.length) return null;
          return LocalNotifications.schedule({ notifications: lista.map(function (a) {
            return { id: a.id, title: a.title, body: a.body, channelId: CANAL_AL, schedule: { at: a.at, allowWhileIdle: true } };
          }) });
        }).then(function (r) {
          window.__alarmasNativas = true; alN = lista.length; alInexacta = !!(r && r.warning);
          alPintarEstado();
        });
      }).catch(function () { window.__alarmasNativas = false; alPintarEstado(); });
    }
    function alPronto() { clearTimeout(alTimer); alTimer = setTimeout(alProgramar, 1200); }
    window.__alarmasReprogramar = alPronto;
    window.addEventListener('load', function () {
      // Cambios de turnos o de ajustes de alarma → se reprograman.
      ['saveTV', 'toggleAlarmas', 'toggleAlarmFichar', 'toggleAlarmSalida'].forEach(function (f) {
        var orig = window[f];
        if (typeof orig !== 'function') return;
        window[f] = function () { var r = orig.apply(this, arguments); alPronto(); return r; };
      });
      // Probar: además del sonido, una notificación de prueba a los 10 s (bloquea el móvil y espera).
      var test = window.alarmaTest;
      if (typeof test === 'function') window.alarmaTest = function () {
        test.apply(this, arguments);
        LocalNotifications.checkPermissions().then(function (p) {
          if (p.display !== 'granted') { if (window.toast) toast('⚠️ Activa las notificaciones de TrenTurnos en Android'); return; }
          return alCanal().then(function () {
            return LocalNotifications.schedule({ notifications: [{ id: ID_AL + 999, title: '⏰ Prueba de alarma', body: 'Así te llegará el aviso para fichar', channelId: CANAL_AL, schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true } }] });
          }).then(function () { if (window.toast) toast('🔔 En 10 s llega una notificación de prueba: puedes bloquear el móvil'); });
        }).catch(function () {});
      };
      setTimeout(alProgramar, 2500);
      setInterval(alProgramar, 30 * 60000);
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) alProgramar(); else alPronto(); });
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
