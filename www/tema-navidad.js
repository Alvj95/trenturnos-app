/*
 * Tema de temporada: NAVIDAD (del 1 de diciembre al 6 de enero).
 *
 * Mismo funcionamiento que tema-halloween.js: cada persona elige su estética
 * en Ajustes → Estética de la app (por defecto, todo normal). Fuera de las
 * fechas no hace nada. Para activarlo, index.html lo carga con
 * <script src="tema-navidad.js"></script>; para quitarlo, se borra esa línea
 * y este archivo.
 *
 * Estéticas: a = Nieve · b = Luces de Navidad · c = Noche dorada · n = Normal.
 * Se guarda en AJ.esteticaNavidad (aparte de la de Halloween) y se aplica con
 * <html data-navidad="a|b|c">.
 */
(function () {
  // Del 1 de diciembre al 6 de enero, ambos incluidos (cruza el cambio de año).
  window.NV_DESDE = '12-01';
  window.NV_HASTA = '01-06';

  function nvMesDia() {
    var d = new Date();
    return ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function nvVigente() {
    var md = nvMesDia();
    return md >= window.NV_DESDE || md <= window.NV_HASTA;
  }
  if (!nvVigente()) return;

  // Aplica el tema elegido antes de que se pinte nada (también la pantalla de carga).
  try {
    var aj0 = JSON.parse(localStorage.getItem('aj5') || '{}') || {};
    var e0 = aj0.esteticaNavidad;
    if (e0 === 'a' || e0 === 'b' || e0 === 'c') document.documentElement.setAttribute('data-navidad', e0);
  } catch (x) {}

  // ── Estilos ───────────────────────────────────────────────
  // Solo recolorean el ACENTO (--acc*) y el fondo; los colores con significado
  // (tren, descanso, baja...) no se tocan, y el rojo de administrador sigue mandando.
  var CSS = [
    'html[data-navidad="a"]{--acc:#0369A1;--acc2:#38BDF8;--acc3:#BAE6FD;--sh-btn:0 4px 16px rgba(56,189,248,.4)}',
    'html[data-navidad="b"]{--acc:#B91C1C;--acc2:#EF4444;--acc3:#FCA5A5;--sh-btn:0 4px 16px rgba(239,68,68,.4)}',
    'html[data-navidad="c"]{--acc:#B45309;--acc2:#F59E0B;--acc3:#FDE68A;--sh-btn:0 4px 16px rgba(245,158,11,.4)}',
    'html[data-navidad="a"] .ph{background-image:linear-gradient(170deg,#0b1a2e,#12304f 60%,#1b3a5c);background-size:100% 100%;animation:none}',
    'html[data-navidad="b"] .ph{background-image:linear-gradient(170deg,#1a0a0e,#24101a 55%,#0d2016);background-size:100% 100%;animation:none}',
    'html[data-navidad="c"] .ph{background-image:linear-gradient(170deg,#0a0f1f,#141a3a 60%,#1f1a0d);background-size:100% 100%;animation:none}',
    'html[data-navidad] .ph::before{display:none}',

    '#nv-decor{display:none;position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0}',
    'html[data-navidad] #nv-decor{display:block}',
    '.nv-dA,.nv-dB,.nv-dC{display:none;position:absolute;inset:0}',
    'html[data-navidad="a"] .nv-dA,html[data-navidad="b"] .nv-dB,html[data-navidad="c"] .nv-dC{display:block}',

    /* A · Nieve */
    '.nv-fl{position:absolute;top:-24px;color:#fff;opacity:.85;text-shadow:0 0 6px rgba(255,255,255,.7);animation:nvFall 14s linear infinite}',
    '@keyframes nvFall{0%{transform:translateY(0) translateX(0) rotate(0)}50%{transform:translateY(52vh) translateX(14px) rotate(160deg)}100%{transform:translateY(106vh) translateX(-8px) rotate(320deg)}}',
    '.nv-dA::after{content:"";position:absolute;left:-10%;right:-10%;bottom:-40px;height:120px;background:radial-gradient(ellipse at 50% 100%,rgba(226,240,255,.22),transparent 70%)}',

    /* B · Luces de Navidad */
    '.nv-wire{position:absolute;top:0;left:0;width:100%;height:46px}',
    '.nv-bulb{position:absolute;width:9px;height:13px;border-radius:50% 50% 45% 45%;animation:nvBlink 1.6s ease-in-out infinite alternate}',
    '.nv-bulb.r{background:#ef4444;box-shadow:0 0 10px 3px rgba(239,68,68,.75)}',
    '.nv-bulb.g{background:#22c55e;box-shadow:0 0 10px 3px rgba(34,197,94,.7)}',
    '.nv-bulb.y{background:#facc15;box-shadow:0 0 10px 3px rgba(250,204,21,.75)}',
    '.nv-bulb.b{background:#38bdf8;box-shadow:0 0 10px 3px rgba(56,189,248,.7)}',
    '@keyframes nvBlink{from{opacity:1}to{opacity:.35}}',
    '.nv-glow{position:absolute;left:-20%;right:-20%;bottom:-30%;height:55%;background:radial-gradient(ellipse at 50% 100%,rgba(34,197,94,.16),transparent 65%)}',

    /* C · Noche dorada */
    '.nv-dC .nv-star{position:absolute;top:104px;right:22px;font-size:26px;filter:drop-shadow(0 0 14px rgba(250,204,21,.85));animation:nvPulse 3s ease-in-out infinite alternate}',
    '@keyframes nvPulse{from{transform:scale(1);opacity:.9}to{transform:scale(1.12);opacity:1}}',
    '.nv-tw{position:absolute;border-radius:50%;background:#fde68a;box-shadow:0 0 6px 2px rgba(253,230,138,.7);animation:nvTw 2.4s ease-in-out infinite alternate}',
    '@keyframes nvTw{from{opacity:.15}to{opacity:.95}}',
    '.nv-sp{position:absolute;top:-10px;width:3px;height:3px;border-radius:50%;background:#fcd34d;box-shadow:0 0 6px 2px rgba(252,211,77,.8);animation:nvFall 11s linear infinite}',

    /* saludo, aviso de primera vez y marcas del calendario */
    '.nv-saludo{display:none;padding:0 14px;margin-top:-2px;font-size:12px;font-weight:800;color:var(--acc3)}',
    'html[data-navidad] .nv-saludo{display:block}',
    '.nv-aviso{display:none;margin:8px 14px 0;align-items:center;gap:8px;background:rgba(0,0,0,.4);border:1px solid #22c55e;border-radius:12px;padding:8px 10px;font-size:12px;font-weight:700;color:var(--tx)}',
    '.nv-aviso.on{display:flex}',
    '.nv-aviso span{flex:1}',
    '.nv-aviso button{all:unset;cursor:pointer;font-weight:800;color:#86efac;padding:2px 6px}',
    '.nv-aviso button.x{opacity:.7}',
    '.dc-nv-mark{position:absolute;top:1px;left:2px;font-size:9px;line-height:1;z-index:2;filter:drop-shadow(0 0 4px rgba(250,204,21,.9))}',
    '.dc-nv-dia{box-shadow:0 0 10px rgba(250,204,21,.55)}',

    /* tarjeta de Ajustes: las cuatro opciones */
    '.nv-sub{font-size:12px;color:var(--tx2);margin:0 0 10px}',
    '.nv-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
    '.nv-tile{all:unset;box-sizing:border-box;cursor:pointer;display:block;border:2px solid var(--div);border-radius:14px;overflow:hidden;background:var(--s1)}',
    '.nv-tile.sel{border-color:#22c55e;box-shadow:0 0 0 2px rgba(34,197,94,.25)}',
    '.nv-mv{position:relative;height:62px;overflow:hidden}',
    '.nv-lb{display:flex;align-items:center;gap:6px;padding:7px 8px;font-size:11.5px;font-weight:700;color:var(--tx)}',
    '.nv-ck{width:14px;height:14px;border-radius:50%;border:2px solid var(--div);flex:none;box-sizing:border-box}',
    '.nv-tile.sel .nv-ck{background:#22c55e;border-color:#22c55e;box-shadow:inset 0 0 0 2px var(--s1)}',
    '.nv-cur{margin-top:10px;font-size:11.5px;color:var(--tx2)}',
    '.nv-cur b{color:var(--tx)}',
    '.nv-mA{background:linear-gradient(170deg,#0b1a2e,#1b3a5c)}',
    '.nv-mB{background:linear-gradient(170deg,#1a0a0e,#0d2016)}',
    '.nv-mC{background:linear-gradient(170deg,#0a0f1f,#1f1a0d)}',
    '.nv-mN{background:linear-gradient(170deg,#1a1a2e,#0f3460)}',
    '.nv-mv .nv-fl{animation-duration:4s;font-size:11px}',
    '.nv-mv .nv-bulb{top:12px;width:7px;height:10px}',
    '.nv-mv .nv-star{position:absolute;top:10px;right:12px;font-size:20px;filter:drop-shadow(0 0 8px rgba(250,204,21,.85))}',
    '.nv-mN i{position:absolute;width:2px;height:2px;border-radius:50%;background:#fff;opacity:.8}',

    /* pantalla de carga: el neón y el fondo se tiñen según el tema elegido */
    'html[data-navidad="a"] #splash-screen{--neon:#38bdf8;--neon2:#e0f2fe;background:radial-gradient(ellipse at 50% 42%,#1e4a75 0%,#12304f 55%,#0b1a2e 100%)}',
    'html[data-navidad="b"] #splash-screen{--neon:#ef4444;--neon2:#fecaca;background:radial-gradient(ellipse at 50% 42%,#4c1018 0%,#24101a 55%,#0d2016 100%)}',
    'html[data-navidad="c"] #splash-screen{--neon:#f59e0b;--neon2:#fde68a;background:radial-gradient(ellipse at 50% 42%,#3b2a0a 0%,#141a3a 55%,#0a0f1f 100%)}',

    '@media (prefers-reduced-motion: reduce){#nv-decor *,.nv-mv *{animation:none!important}.nv-fl,.nv-sp{display:none}}'
  ].join('\n');
  var st = document.createElement('style');
  st.id = 'tema-navidad-css';
  st.textContent = CSS;
  (document.head || document.documentElement).appendChild(st);

  // ── Piezas de la página ───────────────────────────────────
  function copos(n, conTamano) {
    var h = '';
    for (var i = 0; i < n; i++) {
      var left = Math.round((i + 0.5) * 100 / n + (i % 2 ? 3 : -3));
      var size = conTamano ? (12 + (i * 7) % 14) : 11;
      var dur = 11 + (i * 5) % 9, delay = -((i * 4.3) % dur);
      h += '<span class="nv-fl" style="left:' + left + '%;font-size:' + size + 'px;animation-duration:' + dur + 's;animation-delay:' + delay.toFixed(1) + 's">❄</span>';
    }
    return h;
  }
  function bombillas(n, top) {
    var cols = ['r', 'g', 'y', 'b'], h = '';
    for (var i = 0; i < n; i++) {
      var left = (i + 0.5) * 100 / n;
      var y = top + Math.round(10 * Math.sin(Math.PI * ((i + 0.5) / n * 4)));
      h += '<i class="nv-bulb ' + cols[i % 4] + '" style="left:calc(' + left.toFixed(1) + '% - 4px);top:' + y + 'px;animation-delay:' + ((i % 5) * 0.3).toFixed(1) + 's"></i>';
    }
    return h;
  }
  function destellos(n) {
    var h = '';
    for (var i = 0; i < n; i++) {
      var s = 2 + (i % 2);
      h += '<b class="nv-tw" style="left:' + ((i * 37) % 96 + 2) + '%;top:' + ((i * 53) % 70 + 8) + '%;width:' + s + 'px;height:' + s + 'px;animation-delay:' + ((i % 6) * 0.4).toFixed(1) + 's"></b>';
    }
    for (var j = 0; j < 6; j++) {
      h += '<b class="nv-sp" style="left:' + (8 + j * 16) + '%;animation-duration:' + (10 + j * 2) + 's;animation-delay:-' + (j * 2.3).toFixed(1) + 's"></b>';
    }
    return h;
  }
  var WIRE = '<svg class="nv-wire" viewBox="0 0 100 46" preserveAspectRatio="none"><path d="M0 8 Q12.5 30 25 8 T50 8 T75 8 T100 8" fill="none" stroke="rgba(255,255,255,.35)" stroke-width=".6"/></svg>';

  var DECOR =
    '<div id="nv-decor" aria-hidden="true">' +
      '<div class="nv-dA">' + copos(26, true) + '</div>' +
      '<div class="nv-dB"><div class="nv-glow"></div>' + WIRE + bombillas(12, 6) + '</div>' +
      '<div class="nv-dC"><span class="nv-star">⭐</span>' + destellos(18) + '</div>' +
    '</div>';

  var AVISO =
    '<div class="nv-aviso" id="nv-aviso">' +
      '<span>🎄 ¡Navidad! Puedes elegir cómo ver la app.</span>' +
      '<button type="button" onclick="nvAbrirSelector()">Elegir</button>' +
      '<button type="button" class="x" aria-label="Cerrar aviso" onclick="nvCerrarAviso(true)">✕</button>' +
    '</div>';

  var SALUDO = '<div class="nv-saludo" id="nv-saludo"></div>';

  var NV_NOMBRES = { a: 'Nieve', b: 'Luces de Navidad', c: 'Noche dorada', n: 'Normal (sin Navidad)' };
  function tile(k, preview) {
    return '<button type="button" class="nv-tile" data-k="' + k + '" aria-pressed="false" onclick="nvElegir(\'' + k + '\')">' +
      '<div class="nv-mv nv-m' + k.toUpperCase() + '">' + preview + '</div>' +
      '<div class="nv-lb"><i class="nv-ck"></i>' + NV_NOMBRES[k] + '</div></button>';
  }
  var AJUSTES =
    '<div class="aj-acc-item" id="aj-acc-navidad">' +
      '<div class="aj-acc-hdr" onclick="toggleAjAcc(\'aj-acc-navidad\')">' +
        '<span class="aj-acc-hdr-ico">🎄</span>' +
        '<span class="aj-acc-hdr-tit">Estética de la app</span>' +
        '<span class="aj-acc-hdr-arr">›</span>' +
      '</div>' +
      '<div class="aj-acc-body"><div class="aj-card">' +
        '<div class="aj-card-hdr c-green">' +
          '<div class="aj-card-hdr-ico">🎨</div>' +
          '<div class="aj-card-hdr-txt">' +
            '<div class="aj-card-hdr-tit">Estética de Navidad</div>' +
            '<div class="aj-card-hdr-sub">Hasta el 6 de enero</div>' +
          '</div>' +
        '</div>' +
        '<div class="aj-card-body">' +
          '<div class="nv-sub">Elige cómo quieres ver TrenTurnos. El cambio se ve al instante, y es solo para ti.</div>' +
          '<div class="nv-tiles">' +
            tile('a', copos(9, false)) +
            tile('b', WIRE + bombillas(6, 4)) +
            tile('c', '<span class="nv-star">⭐</span><b class="nv-tw" style="left:20%;top:40%;width:2px;height:2px"></b><b class="nv-tw" style="left:45%;top:22%;width:3px;height:3px;animation-delay:.8s"></b><b class="nv-tw" style="left:60%;top:60%;width:2px;height:2px;animation-delay:1.4s"></b>') +
            tile('n', '<i style="left:15%;top:30%"></i><i style="left:40%;top:65%"></i><i style="left:70%;top:25%"></i><i style="left:85%;top:55%"></i>') +
          '</div>' +
          '<div class="nv-cur">Elegida: <b id="nv-cur">' + NV_NOMBRES.n + '</b></div>' +
        '</div>' +
      '</div></div>' +
    '</div>';

  // ── Funciones (globales: los botones del tema las llaman con onclick) ──
  function nvActiva() {
    if (!nvVigente()) return '';
    var e = (typeof AJ !== 'undefined' && AJ) ? AJ.esteticaNavidad : '';
    return (e === 'a' || e === 'b' || e === 'c') ? e : '';
  }
  // Saludo según el día: Nochevieja/Año Nuevo y Reyes tienen el suyo.
  function nvTextoSaludo() {
    var md = nvMesDia();
    if (md === '12-31' || md === '01-01') return '🥂 Feliz Año Nuevo';
    if (md === '01-05' || md === '01-06') return '👑 Felices Reyes';
    return '🎄 Feliz Navidad';
  }
  // Días con marca en el calendario (solo con un tema elegido).
  var NV_MARCAS = { '12-24': '🎄', '12-25': '🎄', '12-31': '🥂', '01-06': '👑' };

  function nvAplicar() {
    var e = nvActiva(), root = document.documentElement;
    if (e) root.setAttribute('data-navidad', e); else root.removeAttribute('data-navidad');
    var item = document.getElementById('aj-acc-navidad');
    if (item) item.style.display = nvVigente() ? '' : 'none';
    var sel = e || 'n';
    var tiles = document.querySelectorAll('.nv-tile');
    for (var i = 0; i < tiles.length; i++) {
      var on = tiles[i].getAttribute('data-k') === sel;
      tiles[i].classList.toggle('sel', on);
      tiles[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    var cur = document.getElementById('nv-cur'); if (cur) cur.textContent = NV_NOMBRES[sel];
    var sal = document.getElementById('nv-saludo'); if (sal) sal.textContent = nvTextoSaludo();
    if (!nvVigente()) nvCerrarAviso(false);
    nvMarcarCalendario();
  }
  function nvElegir(k) {
    AJ.esteticaNavidad = (k === 'a' || k === 'b' || k === 'c') ? k : 'n';
    try { localStorage.setItem('aj5', JSON.stringify(AJ)); } catch (e) {}
    nvAplicar();
    nvCerrarAviso(true); // quien ya ha elegido (aunque sea "Normal") no necesita el aviso
    if (typeof _autoGuardarNubeDebounced === 'function') _autoGuardarNubeDebounced();
  }
  function nvMostrarAviso() {
    var el = document.getElementById('nv-aviso'); if (!el) return;
    var visto = ''; try { visto = localStorage.getItem('nv_aviso_visto') || ''; } catch (e) {}
    var yaEligio = !!(typeof AJ !== 'undefined' && AJ && AJ.esteticaNavidad);
    el.classList.toggle('on', nvVigente() && !visto && !yaEligio);
  }
  function nvCerrarAviso(marcar) {
    var el = document.getElementById('nv-aviso'); if (el) el.classList.remove('on');
    if (marcar) { try { localStorage.setItem('nv_aviso_visto', '1'); } catch (e) {} }
  }
  function nvAbrirSelector() {
    nvCerrarAviso(true);
    if (typeof goP === 'function') goP('ajustes');
    setTimeout(function () {
      var it = document.getElementById('aj-acc-navidad');
      if (!it) return;
      if (!it.classList.contains('aj-acc-open') && typeof toggleAjAcc === 'function') toggleAjAcc('aj-acc-navidad');
      if (it.scrollIntoView) it.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }, 80);
  }
  function nvMarcarCalendario() {
    var viejas = document.querySelectorAll('.dc-nv-mark');
    for (var v = 0; v < viejas.length; v++) {
      var p = viejas[v].parentNode; p.classList.remove('dc-nv-dia'); p.removeChild(viejas[v]);
    }
    if (!nvActiva()) return;
    var cells = document.querySelectorAll('.dc[data-k]');
    for (var i = 0; i < cells.length; i++) {
      var marca = NV_MARCAS[cells[i].getAttribute('data-k').slice(5)];
      if (!marca) continue;
      cells[i].classList.add('dc-nv-dia');
      var s = document.createElement('span');
      s.className = 'dc-nv-mark';
      s.textContent = marca;
      cells[i].insertBefore(s, cells[i].firstChild);
    }
  }
  window.nvElegir = nvElegir; window.nvAbrirSelector = nvAbrirSelector;
  window.nvCerrarAviso = nvCerrarAviso; window.nvAplicar = nvAplicar;

  function montar() {
    var ph = document.getElementById('ph');
    if (ph) ph.insertAdjacentHTML('afterbegin', DECOR);
    var saludo = document.getElementById('saludo-personal');
    if (saludo) {
      saludo.insertAdjacentHTML('beforebegin', AVISO);
      saludo.insertAdjacentHTML('afterend', SALUDO);
    }
    var perfil = document.getElementById('aj-acc-perfil');
    if (perfil) perfil.insertAdjacentHTML('beforebegin', AJUSTES);

    // Las marcas del calendario se vuelven a poner cada vez que la app lo repinta.
    if (typeof window.renderCal === 'function') {
      var renderCalOriginal = window.renderCal;
      window.renderCal = function () {
        var r = renderCalOriginal.apply(this, arguments);
        nvMarcarCalendario();
        return r;
      };
    }
    nvAplicar();
    nvMostrarAviso();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();

  // Si la app se queda abierta y cambia el día (p. ej. del 6 al 7 de enero), al volver a ella se revisa.
  document.addEventListener('visibilitychange', function () { if (!document.hidden) nvAplicar(); });
})();
