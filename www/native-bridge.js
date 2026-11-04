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
 *   - widgets de la pantalla de inicio (calendario y próximos turnos)
 *   - aviso de versión nueva de Google Play, con descarga en segundo plano
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
        if (AJ.alarmas.fichar !== false && ['ordinario', 'trabajado', 'reserva', 'vuelta-pernocta'].indexOf(t.tipo) > -1) {
          out.push({ id: ID_AL + i * 2, at: new Date(toma.getTime() - 5 * 60000),
            title: '⏰ Fichar en ' + t.hF, body: 'Turno ' + t.tipo + ' · Firma en 5 minutos', fichar: true });
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
    // ── Fichar la SALIDA al acabar el deje: la programa Android (FichajeSalida.java), que además
    // mira el retraso del tren en Renfe y aplaza la alarma. Aquí solo se calcula la hora prevista.
    function alSalidas(activas) {
      if (!P.TTFichaje || !P.TTFichaje.programarSalidas) return Promise.resolve();
      var out = [], AJ = window.AJ || {}, A = AJ.alarmas || {}, ahora = Date.now();
      if (activas && A.salidaFichaje !== false && typeof window.fichPlan === 'function') {
        for (var i = -1; i < DIAS_AL; i++) {
          var d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i);
          var k = alClave(d), p = null;
          try { p = window.fichPlan(k); } catch (e) { p = null; }
          if (!p || p.s == null) continue;
          var fin = new Date(d); fin.setDate(fin.getDate() + (p.sDia || 0)); fin.setHours(0, p.s, 0, 0);
          if (fin.getTime() < ahora - 60000) continue;
          var llega = 0;
          if (p.tren && p.llega != null) { var l = new Date(d); l.setDate(l.getDate() + (p.llegaDia || 0)); l.setHours(0, p.llega, 0, 0); llega = l.getTime(); }
          out.push({ id: 700 + (i + 1), k: k, fin: fin.getTime(), llega: llega, tren: p.tren || '', deje: p.deje || 0, base: !!p.enBase,
            txt: p.tren ? '' : (p.resumen === 'Reserva' ? 'Fin de la reserva' : 'Fin del turno') });
        }
      }
      return P.TTFichaje.programarSalidas({ lista: JSON.stringify(out), abrir: A.abrirFichaje !== false }).catch(function () {});
    }
    function alProgramar() {
      return LocalNotifications.checkPermissions().then(function (p) {
        var lista = alCalcular(), on = window.AJ && AJ.alarmas && AJ.alarmas.activas;
        alSalidas(p.display === 'granted' && on);
        if (p.display !== 'granted' || !on) {
          window.__alarmasNativas = false; alN = 0;
          return alBorrarProgramadas().then(alPintarEstado);
        }
        return alCanal().then(alAcciones).then(alBorrarProgramadas).then(function () {
          if (!lista.length) return null;
          return LocalNotifications.schedule({ notifications: lista.map(function (a) {
            var n = { id: a.id, title: a.title, body: a.body, channelId: CANAL_AL, schedule: { at: a.at, allowWhileIdle: true } };
            if (a.fichar) { n.actionTypeId = ACC_FICHAR; n.extra = { tt: 'fichar' }; }
            return n;
          }) });
        }).then(function (r) {
          window.__alarmasNativas = true; alN = lista.length; alInexacta = !!(r && r.warning);
          alPintarEstado();
        });
      }).catch(function () { window.__alarmasNativas = false; alPintarEstado(); });
    }
    function alPronto() { clearTimeout(alTimer); alTimer = setTimeout(alProgramar, 1200); }
    // ── Fichaje desde la alarma: botón «🕒 Fichar ahora» en la notificación de fichar.
    // Al tocarlo (o al tocar la notificación, si está activado en Ajustes) se abre la página
    // de fichaje dentro de la app (TTFichaje → FichajeActivity).
    var ACC_FICHAR = 'tt_fichar', alAccionesYa = null;
    function alAcciones() {
      if (alAccionesYa) return alAccionesYa;
      alAccionesYa = (LocalNotifications.registerActionTypes ? LocalNotifications.registerActionTypes({ types: [{ id: ACC_FICHAR,
        actions: [{ id: 'fichar', title: '🕒 Fichar ahora', foreground: true }] }] }) : Promise.resolve()).catch(function () {});
      return alAccionesYa;
    }
    // Al volver de la página de fichaje (abierta desde la app o desde una alarma): «¿Has fichado?»
    function fichPendiente() {
      if (!P.TTFichaje || !P.TTFichaje.pendiente) return;
      P.TTFichaje.pendiente().then(function (r) {
        if (r && r.abierto && typeof window.fichPreguntar === 'function') window.fichPreguntar(r.abierto);
      }).catch(function () {});
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) setTimeout(fichPendiente, 400); });
    window.addEventListener('load', function () { setTimeout(fichPendiente, 6000); });
    if (LocalNotifications.addListener) LocalNotifications.addListener('localNotificationActionPerformed', function (ev) {
      try {
        var n = ev && ev.notification, ex = n && n.extra;
        if (!ex || ex.tt !== 'fichar') return;
        var aj = (window.AJ && AJ.alarmas) || {};
        if (ev.actionId === 'fichar' || (ev.actionId === 'tap' && aj.abrirFichaje !== false)) {
          if (P.TTFichaje) P.TTFichaje.abrir().catch(function () {});
        }
      } catch (e) {}
    });
    window.__alarmasReprogramar = alPronto;
    window.addEventListener('load', function () {
      // Cambios de turnos o de ajustes de alarma → se reprograman.
      ['saveTV', 'toggleAlarmas', 'toggleAlarmFichar', 'toggleAlarmSalida', 'toggleAlarmSalidaFichaje', 'toggleAlarmAbrirFichaje'].forEach(function (f) {
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
            return alAcciones().then(function () {
              return LocalNotifications.schedule({ notifications: [{ id: ID_AL + 999, title: '⏰ Prueba de alarma', body: 'Así te llegará el aviso para fichar · toca «Fichar ahora» para probar el fichaje', channelId: CANAL_AL, schedule: { at: new Date(Date.now() + 10000), allowWhileIdle: true }, actionTypeId: ACC_FICHAR, extra: { tt: 'fichar' } }] });
            });
          }).then(function () { if (window.toast) toast('🔔 En 10 s llega una notificación de prueba: puedes bloquear el móvil'); });
        }).catch(function () {});
      };
      setTimeout(alProgramar, 2500);
      setInterval(alProgramar, 30 * 60000);
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) alProgramar(); else alPronto(); });
  }

  // ── 📅 Widgets de la pantalla de inicio ─────────────────────
  // Android pinta los widgets (calendario del mes y próximos turnos) con lo que se le
  // pasa aquí: cada día ya resumido (color, texto corto y el detalle de la ventana que
  // sale al tocarlo). Se manda al abrir la app, al cambiar turnos y al salir de ella.
  // «Abrir en TrenTurnos» desde la ventana del día abre la app en ese día.
  var TTWidget = P.TTWidget;
  if (TTWidget) {
    var wgTimer = null, wgUltimo = '';
    var WG_CORTO = { ordinario: 'ORD', reserva: 'RES', descanso: 'L', baja: 'BAJA', trabajado: 'TRAB', comp: 'COMP',
      vacaciones: 'VAC', dop: 'DOP', 'vuelta-pernocta': '🌙', 'pernocta3-intermedio': '🌙' };
    var WG_TITULO = { comp: 'Compensación', 'vuelta-pernocta': 'Vuelta de pernocta' };
    function wgClave(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    function wgMin(h) { var m = /^(\d{1,2}):(\d{2})/.exec(String(h || '')); return m ? +m[1] * 60 + +m[2] : null; }
    function wgDuracion(t) {
      var a = wgMin(t.hF), b = wgMin(t.hL);
      var min = (typeof t.horas === 'number' && t.horas > 0) ? Math.round(t.horas * 60) : (a !== null && b !== null ? (b - a + 1440) % 1440 : 0);
      return min ? Math.floor(min / 60) + ' h' + (min % 60 ? ' ' + (min % 60) + ' min' : '') : '';
    }
    function wgDia(t) {
      var TI = (typeof TIPO_INFO !== 'undefined' && TIPO_INFO) || {};
      var info = TI[t.tipo] || {};
      var pmd = typeof esPMD === 'function' && esPMD(t);
      var k = pmd ? 'pmd' : String(info.cls || '').replace(/^dc-/, '').replace('art5152', 'art') || 'nada';
      var titulo = pmd ? 'Art. 52 · P.M.D.' : t.tipo === 'art5152' ? 'Art. ' + (t.articulo === 52 ? 52 : 51) : (WG_TITULO[t.tipo] || info.lbl || t.tipo || 'Turno');
      var tren = t.numTren ? String(t.numTren) : '';
      var corto = tren || (t.tipo === 'art5152' ? (t.articulo === 52 ? 'A52' : 'A51') : (WG_CORTO[t.tipo] || String(titulo).slice(0, 4).toUpperCase()));
      var vuelta = t.numTrenVuelta && String(t.numTrenVuelta) !== tren ? String(t.numTrenVuelta) : '';
      var trayecto = t.sal && t.lle ? t.sal + ' → ' + t.lle : (t.sal || t.lle || '');
      var f = [];
      if (trayecto) f.push(['Trayecto', trayecto]);
      if (t.hF) f.push(['Presentación', t.hF]);
      if (t.hL) f.push(['Fin', t.hL]);
      var dur = wgDuracion(t); if (dur) f.push(['Horas', dur]);
      if (vuelta) f.push(['Tren de vuelta', vuelta]);
      if (t.turnoPisado && t.turnoPisado.numTren) f.push(['Turno debajo', 'Tren ' + t.turnoPisado.numTren + (t.contarPisado ? ' · cuenta' : '')]);
      return { k: k, c: corto, i: info.ico || '📅', t: titulo,
        s: tren ? 'Tren ' + tren + (vuelta ? ' / ' + vuelta : '') + (t.linea ? ' · ' + t.linea : '') : titulo,
        r: trayecto || titulo, h: t.hF || '', f: f, n: t.notas ? String(t.notas) : '',
        // para los widgets nuevos (hoy, agenda, presentación…): tren de vuelta, fin del turno y estación de salida
        v: vuelta, hl: t.hL2 || t.hL || '', sl: t.sal || '', tr: wgTrenes(t) };
    }
    // Trenes del día con su trayecto y horas (para «Mi tren en directo»): ida y, si hay, vuelta.
    function wgTrenes(t) {
      var n = function (x) { return String(x || '').replace(/\D/g, '').replace(/^0+/, ''); }, base = (window.AJ && AJ.base) || '', l = [];
      if (n(t.numTren)) l.push({ n: n(t.numTren), o: t.sal || base, d: t.lle || '', hs: t.hF || '', hl: t.hL || '' });
      if (n(t.numTrenVuelta) && n(t.numTrenVuelta) !== n(t.numTren)) l.push({ n: n(t.numTrenVuelta), o: t.sal2 || t.lle || '', d: t.lle2 || base, hs: t.hF2 || '', hl: t.hL2 || '' });
      return l.length ? l : undefined;
    }
    // ── Widgets de la tanda 2 y 3 ──
    // Solo se calculan si ese widget está puesto (Android lo dice al guardar). Todo en try/catch:
    // si algo falla, el widget enseña lo último que tenía y la app sigue igual.
    var wgPuestos = {}, wgCq = null, wgCqT = 0, wgCqEnCurso = false;
    function wgR2(x) { return Math.round(x * 100) / 100; }
    // Nómina neta estimada del mes (la misma cuenta que la pantalla «Nómina»).
    function wgNeto(y, m) {
      var TV = window.TV || {}, rol = AJ.rol || 'tripulante', t = TARIFAS_ROL[rol] || TARIFAS_ROL.tripulante;
      var fijos = _nominaConceptosFijos(rol, y, m);
      if (AJ.tieneCAPH && parseFloat(AJ.caphImporte) > 0) fijos.push({ val: wgR2(parseFloat(AJ.caphImporte)) });
      var totalFijos = fijos.reduce(function (s, f) { return s + f.val; }, 0);
      var mt = _nominaMesAnterior(y, m);
      var ks = Object.keys(TV).filter(function (k) { var d = new Date(k + 'T00:00:00'); return d.getFullYear() === mt.anio && d.getMonth() === mt.mes - 1; });
      var e = calculateEarnings(ks), htdl = _nominaHTDLPuro(ks, t.vh), art = _nominaArt5152Importe(ks), pmd = _nominaPMD(_ksMesNomina(y, m));
      var resto = e.totalNoc + e.totalAct + e.totalJT + e.totalIntl + e.totalRebase + e.totalPlusTrasl;
      var bruto = wgR2(totalFijos + htdl.importe + art + pmd.importe + resto), mv = _nominaValoresManuales;
      return wgR2(bruto - wgR2(bruto * mv.ssPct / 100) - mv.cuotaSindical - wgR2(bruto * mv.irpfPct / 100));
    }
    // Horas del mes hasta hoy, horas HTDL y nómina de este mes.
    function wgNomina() {
      var TV = window.TV || {}, hoy = new Date(), y = hoy.getFullYear(), m = hoy.getMonth() + 1, hk = wgClave(hoy), pref = hk.slice(0, 7);
      var ks = Object.keys(TV).filter(function (k) { return k.slice(0, 7) === pref && k <= hk; });
      var e = calculateEarnings(ks), ref = 163, eur = null;
      try { ref = _nominaJornadaRefAjustada(y, m).ref; } catch (x) {}
      try { eur = wgNeto(y, m); } catch (x) {}
      return { f: hk, mes: MESES[m - 1], h: wgR2(e.totalHoras || 0), ref: ref, x: wgR2(e.horasHTDL || 0), eur: eur };
    }
    // «Rodríguez Pons, Pablo» / «RUIZ PONS PABLO» → «Pablo Ruiz Pons»
    function wgNombre(s) {
      s = String(s || '').trim().replace(/\s+/g, ' ');
      var nom = s, ap = '';
      if (s.indexOf(',') > 0) { ap = s.split(',')[0].trim(); nom = s.split(',').slice(1).join(' ').trim(); }
      else { var p = s.split(' '), PART = { DE: 1, DEL: 1, LA: 1, LAS: 1, LOS: 1, Y: 1, SAN: 1, SANTA: 1 }, i = 0, n = 0;
        while (i < p.length - 1 && n < 2) { if (!PART[p[i].toUpperCase()]) n++; i++; }
        if (p.length > 2) { ap = p.slice(0, i).join(' '); nom = p.slice(i).join(' '); } }
      var t = (nom + (ap ? ' ' + ap : '')).toLowerCase().replace(/(^|[\s-])(\S)/g, function (a, b, c) { return b + c.toUpperCase(); });
      return t.replace(/ (De|Del|La|Las|Los|Y)(?= )/g, function (x) { return x.toLowerCase(); });
    }
    // Con quién viajo hoy: lo mismo que «Viajas con» en el detalle del día (Horario General de tu base).
    function wgConQuien() {
      var hk = wgClave(new Date());
      if (wgCqEnCurso || (wgCq && wgCq.f === hk && Date.now() - wgCqT < 3 * 3600000)) return;
      var t = (window.TV || {})[hk], tr = t ? (wgTrenes(t) || []).map(function (x) { return x.n; }) : [];
      if (!tr.length) { wgCq = { f: hk, tr: '', g: [] }; wgCqT = Date.now(); wgPronto(); return; }
      if (typeof window.asegurarHorarioGeneralCargado !== 'function') return;
      wgCqEnCurso = true;
      var p = hk.split('-').map(Number);
      Promise.resolve(window.asegurarHorarioGeneralCargado({ anio: p[0], mes: p[1] })).catch(function () { return false; }).then(function (ok) {
        wgCqEnCurso = false;
        if (!ok || typeof activeBase === 'undefined' || !activeBase || !activeBase.data) { if (!wgCq || wgCq.f !== hk) { wgCq = { f: hk, tr: tr.join(' / '), no: 1, g: [] }; wgPronto(); } return; }
        var mat = String((window.AJ && AJ.matricula) || '').trim(), g = [];
        activeBase.data.forEach(function (e) {
          if (!e || String(e[0]).trim() === mat) return;
          var cel = e[2] ? e[2][String(p[2])] : null; if (!cel) return;
          var tok = String(cel).split(/[^0-9A-Za-z]+/).filter(Boolean), suyos = [];
          tr.forEach(function (n) {
            var mios = tok.filter(function (x) { var d = (x.match(/\d{2,6}/) || [''])[0].replace(/^0+/, ''); return d === n; });
            if (!mios.length) return;
            var dh = mios.filter(function (x) { return /DH/i.test(x); }).length;
            suyos.push(dh === mios.length ? 'DH ' + n : dh ? n + ' (½ DH)' : n);
          });
          if (suyos.length) g.push({ n: wgNombre(e[1]), t: suyos.join(' · '), dh: suyos.every(function (x) { return /^DH/.test(x); }) ? 1 : 0 });
        });
        g.sort(function (a, b) { return a.dh - b.dh || a.n.localeCompare(b.n, 'es'); });
        wgCq = { f: hk, tr: tr.join(' / '), g: g }; wgCqT = Date.now(); wgPronto();
      });
    }
    function wgExtra() {
      var x = {}, A = window.AJ || {};
      x.mat = String(A.matricula || '').trim();
      try { x.sb = { u: SUPABASE_URL_ADMIN, k: SUPABASE_KEY_ADMIN }; } catch (e) {}
      try { x.rt = typeof rtG === 'function' ? (rtG().activo ? 1 : 0) : 1; } catch (e) {}
      if (wgPuestos.nomina) try { x.nom = wgNomina(); } catch (e) {}
      if (wgCq) x.cq = wgCq;
      return x;
    }
    function wgDatos() {
      var TV = window.TV || {}, dias = {};
      var desde = new Date(); desde.setDate(desde.getDate() - 62);
      var hasta = new Date(); hasta.setDate(hasta.getDate() + 400);
      var a = wgClave(desde), b = wgClave(hasta);
      Object.keys(TV).forEach(function (k) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || k < a || k > b || !TV[k] || !TV[k].tipo) return;
        try { dias[k] = wgDia(TV[k]); } catch (e) {}
      });
      var x = null; try { x = wgExtra(); } catch (e) {}
      return JSON.stringify(x ? { v: 1, dias: dias, x: x } : { v: 1, dias: dias });
    }
    function wgEnviar() {
      clearTimeout(wgTimer);
      var datos; try { datos = wgDatos(); } catch (e) { return; }
      if (datos === wgUltimo) return;
      TTWidget.guardar({ datos: datos }).then(function (r) {
        wgUltimo = datos;
        // Qué widgets nuevos hay puestos: si acaba de aparecer el de nómina, se manda otra vez con sus datos.
        var antes = wgPuestos.nomina; wgPuestos = (r && r.puestos) || {};
        if (wgPuestos.nomina && !antes) wgPronto();
        if (wgPuestos.conQuien) setTimeout(function () { try { wgConQuien(); } catch (e) { wgCqEnCurso = false; } }, 20000);
      }).catch(function () {});
    }
    function wgPronto() { clearTimeout(wgTimer); wgTimer = setTimeout(wgEnviar, 1500); }
    window.__widgetActualizar = wgPronto;
    function wgIrAFecha() {
      TTWidget.fechaPendiente().then(function (r) {
        var f = r && r.fecha, p = f && f.split('-').map(Number);
        if (!p || p.length !== 3) return;
        try {
          if (typeof goP === 'function') goP('cal');
          selDay = null; curM = new Date(p[0], p[1] - 1, 1);
          renderCal();
          if (typeof clickDia === 'function') clickDia(p[2], f, (window.TV || {})[f]);
        } catch (e) {}
      }).catch(function () {});
    }
    window.addEventListener('load', function () {
      var orig = window.saveTV;
      if (typeof orig === 'function') window.saveTV = function () { var r = orig.apply(this, arguments); wgPronto(); return r; };
      setTimeout(wgEnviar, 2000);
      // Tras la pantalla de carga (3,5 s), por si se abrió desde «Abrir en TrenTurnos».
      setTimeout(wgIrAFecha, 4600);
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) wgEnviar(); else wgIrAFecha(); });
  }

  // ── 🆕 Aviso de versión nueva (Google Play) ─────────────────
  // Al abrir la app se pregunta a Google Play si hay una versión más nueva. Si la hay,
  // sale un aviso con las novedades (las que el admin escribe en su panel, solo si son
  // de ESA versión) y «Actualizar ahora» / «Más tarde». La descarga va en segundo plano
  // con una barra abajo; al terminar, «Reiniciar» instala. «Más tarde» = hasta mañana.
  var TTAct = P.TTActualizar;
  if (TTAct) {
    var K_MAS_TARDE = 'ttActMasTarde', actCss = false;
    function actHoy() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
    function actEsc(s) { var d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; }
    function actEstilos() {
      if (actCss) return; actCss = true;
      var st = document.createElement('style');
      st.textContent =
        '#tt-act-fondo{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center}' +
        '#tt-act-hoja{width:100%;max-width:520px;background:var(--s1,#0D1B2E);border-top:1px solid var(--div,#1E3350);border-radius:24px 24px 0 0;padding:18px 16px 22px;color:var(--tx,#F8FAFC);font-family:inherit}' +
        '#tt-act-hoja .a-ico{font-size:40px;text-align:center}#tt-act-hoja .a-t1{text-align:center;font-weight:900;font-size:19px;margin-top:4px}' +
        '#tt-act-hoja .a-t2{text-align:center;color:var(--tx2,#94A3B8);font-size:12.5px;margin-top:3px}' +
        '#tt-act-hoja .a-nov{background:var(--s2,#132236);border-radius:14px;padding:10px 12px;margin-top:14px;font-size:12.5px;line-height:1.7}' +
        '#tt-act-hoja .a-nov b{display:block;font-size:10.5px;letter-spacing:.6px;color:var(--tx2,#94A3B8);margin-bottom:2px}' +
        '#tt-act-hoja button{display:block;width:100%;border-radius:14px;padding:14px;font:inherit;font-weight:800;font-size:14.5px;margin-top:12px;cursor:pointer;color:var(--tx,#F8FAFC)}' +
        '#tt-act-hoja .a-si{background:#3B7FFF;border:0}#tt-act-hoja .a-no{background:var(--s2,#132236);border:1px solid var(--div,#1E3350);margin-top:8px;font-size:13.5px}' +
        '#tt-act-hoja .a-pie{text-align:center;color:var(--tx3,#64748B);font-size:11px;margin-top:10px}' +
        '#tt-act-barra{position:fixed;left:12px;right:12px;bottom:86px;z-index:10040;max-width:500px;margin:0 auto;background:var(--s2,#132236);border:1px solid var(--div,#1E3350);border-radius:16px;padding:12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.5);color:var(--tx,#F8FAFC);font-size:13px}' +
        '#tt-act-barra .r{display:flex;align-items:center;gap:10px}#tt-act-barra .r b{flex:1}' +
        '#tt-act-barra .pr{height:6px;border-radius:4px;background:var(--div,#1E3350);margin-top:9px;overflow:hidden}#tt-act-barra .pr i{display:block;height:100%;background:#3B7FFF;transition:width .3s}' +
        '#tt-act-barra button{border:0;background:#16A34A;color:#fff;border-radius:10px;padding:8px 13px;font:inherit;font-weight:800;font-size:12.5px;cursor:pointer}';
      document.head.appendChild(st);
    }
    function actQuitarBarra() { var b = document.getElementById('tt-act-barra'); if (b) b.remove(); }
    function actBarra(html) {
      actEstilos();
      var b = document.getElementById('tt-act-barra');
      if (!b) { b = document.createElement('div'); b.id = 'tt-act-barra'; document.body.appendChild(b); }
      b.innerHTML = html;
      return b;
    }
    function actDescargando(pct) {
      actBarra('<div class="r">⬇️ <b>Descargando actualización…</b><span style="color:var(--tx2,#94A3B8)">' + (pct == null ? '' : pct + ' %') + '</span></div><div class="pr"><i style="width:' + (pct || 3) + '%"></i></div>');
    }
    function actLista() {
      var b = actBarra('<div class="r">✅ <b>Actualización lista</b><button type="button">Reiniciar</button></div>');
      b.querySelector('button').onclick = function () { this.disabled = true; this.textContent = 'Instalando…'; TTAct.completar().catch(function () {}); };
    }
    // Novedades que el admin escribió para ESTA versión (si son de otra, no se enseñan).
    function actNovedades(version) {
      var sb = window.sbAdmin;
      if (!sb || !version) return Promise.resolve([]);
      return sb.from('config_global').select('nombre_servicio,nombre_archivo').eq('tipo', 'novedades_app').maybeSingle().then(function (r) {
        var f = r && r.data;
        if (!f || String(f.nombre_servicio || '').trim() !== version) return [];
        return String(f.nombre_archivo || '').split(/\n+/).map(function (l) { return l.replace(/^\s*[•\-*·]\s*/, '').trim(); }).filter(Boolean).slice(0, 6);
      }, function () { return []; });
    }
    function actHoja(version, lineas) {
      if (document.getElementById('tt-act-fondo')) return;
      actEstilos();
      var f = document.createElement('div'); f.id = 'tt-act-fondo';
      f.innerHTML = '<div id="tt-act-hoja" role="dialog" aria-label="Nueva versión de TrenTurnos">' +
        '<div class="a-ico">🆕</div><div class="a-t1">Nueva versión de TrenTurnos</div>' +
        '<div class="a-t2">' + (version ? 'v' + actEsc(version) + ' · ' : '') + 'disponible en Google Play</div>' +
        (lineas.length ? '<div class="a-nov"><b>NOVEDADES</b>' + lineas.map(function (l) { return '• ' + actEsc(l); }).join('<br>') + '</div>' : '') +
        '<button type="button" class="a-si">⬇️ Actualizar ahora</button><button type="button" class="a-no">Más tarde</button>' +
        '<div class="a-pie">Tus turnos y ajustes no se tocan al actualizar</div></div>';
      document.body.appendChild(f);
      function cerrar() { f.remove(); }
      f.querySelector('.a-no').onclick = function () { try { localStorage.setItem(K_MAS_TARDE, actHoy()); } catch (e) {} cerrar(); };
      f.onclick = function (e) { if (e.target === f) f.querySelector('.a-no').onclick(); };
      f.querySelector('.a-si').onclick = function () {
        cerrar();
        TTAct.iniciar().then(function (r) {
          if (r && r.aceptado) actDescargando(null);
          else { try { localStorage.setItem(K_MAS_TARDE, actHoy()); } catch (e) {} }
        }).catch(function () { if (window.toast) toast('⚠️ No se pudo abrir Google Play'); });
      };
    }
    // auto = al abrir la app: respeta «Más tarde» (hasta mañana).
    function actComprobar(auto) {
      TTAct.comprobar().then(function (r) {
        if (!r) return;
        if (r.estado === 'descargada') return actLista();
        if (r.estado === 'descargando' || r.estado === 'pendiente') return actDescargando(null);
        if (!r.disponible) return;
        var masTarde = null; try { masTarde = localStorage.getItem(K_MAS_TARDE); } catch (e) {}
        if (auto && masTarde === actHoy()) return;
        return actNovedades(r.version).then(function (l) { actHoja(r.version, l); });
      }).catch(function () {});
    }
    window.__actualizacionComprobar = function () { actComprobar(false); };
    TTAct.addListener('estado', function (e) {
      if (!e) return;
      if (e.estado === 'descargando') actDescargando(e.total > 0 ? Math.min(100, Math.round(e.descargado * 100 / e.total)) : null);
      else if (e.estado === 'descargada') actLista();
      else if (e.estado === 'fallo' || e.estado === 'cancelada') { actQuitarBarra(); if (e.estado === 'fallo' && window.toast) toast('⚠️ No se pudo descargar la actualización'); }
    });
    // Tras la pantalla de carga y el portal; y al volver a la app (por si terminó la descarga).
    window.addEventListener('load', function () { setTimeout(function () { actComprobar(true); }, 6500); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) actComprobar(true); });
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
