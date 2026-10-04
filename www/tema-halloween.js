/*
 * Tema de temporada: HALLOWEEN (del 1 de octubre al 5 de noviembre).
 *
 * Todo lo de Halloween vive en este archivo; index.html solo lo carga con
 * <script src="tema-halloween.js"></script>. Fuera de las fechas no hace
 * nada. Cuando acabe la temporada se puede borrar este archivo y esa línea.
 *
 * Contenido sacado tal cual de la versión de Halloween del HTML:
 * estilos, adornos, aviso, saludo, tarjeta de Ajustes, funciones y la
 * calabaza del 31 de octubre.
 */
(function () {
// NUEVO — TEMAS DE HALLOWEEN (cada persona elige el suyo en Ajustes →
// Estética de la app). Este bloque va AQUÍ, antes de que se pinte nada,
// para que el tema elegido ya esté aplicado cuando sale la pantalla de
// carga (si no, se vería un instante el aspecto normal y luego el tema).
// Las fechas de vigencia son las ÚNICAS que mandan: fuera de ese rango
// no se aplica ningún tema y la tarjeta de Ajustes desaparece, sin
// tener que subir nada. La opción elegida se guarda en AJ.estetica
// ('a' Brasas · 'b' Niebla y fantasmas · 'c' Murciélagos · 'n' Normal).
window.HW_DESDE = '2026-10-01';
window.HW_HASTA = '2026-11-05'; // último día incluido; el 6 de noviembre vuelve solo a lo normal
(function(){
  try{
    var d = new Date();
    var h = d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
    if(h < window.HW_DESDE || h > window.HW_HASTA) return;
    var aj = JSON.parse(localStorage.getItem('aj5') || '{}') || {};
    var e = aj.estetica;
    if(e === 'a' || e === 'b' || e === 'c') document.documentElement.setAttribute('data-estetica', e);
  }catch(x){}
})();

  // Fuera de fechas, el tema no existe: ni estilos, ni adornos, ni tarjeta.
  var _d = new Date();
  var _hoy = _d.getFullYear() + '-' + ('0' + (_d.getMonth() + 1)).slice(-2) + '-' + ('0' + _d.getDate()).slice(-2);
  if (_hoy < window.HW_DESDE || _hoy > window.HW_HASTA) return;

  // ── Estilos ───────────────────────────────────────────────
  var CSS = "\n/* ═══════════════════════════════════════════════════════════\n   NUEVO — TEMAS DE HALLOWEEN (cada persona elige el suyo en Ajustes →\n   Estética de la app; por defecto, todo normal). Se activan con\n   <html data-estetica=\"a|b|c\"> (ver el script del <head> y\n   aplicarEstetica()). Solo recolorean el ACENTO (--acc*) y el fondo;\n   los colores con significado (--c-*: tren, descanso, baja...) NO se\n   tocan. Como body.modo-admin / modo-interventor redefinen --acc más\n   adentro, el rojo de administrador sigue mandando sobre cualquier tema.\n═══════════════════════════════════════════════════════════ */\nhtml[data-estetica=\"a\"]{--acc:#C2410C;--acc2:#F97316;--acc3:#FDBA74;--sh-btn:0 4px 16px rgba(249,115,22,.4)}\nhtml[data-estetica=\"b\"]{--acc:#4D7C0F;--acc2:#84CC16;--acc3:#BEF264;--sh-btn:0 4px 16px rgba(132,204,22,.35)}\nhtml[data-estetica=\"c\"]{--acc:#C2410C;--acc2:#FB923C;--acc3:#FDBA74;--sh-btn:0 4px 16px rgba(251,146,60,.4)}\nhtml[data-estetica=\"b\"] .bni.on{color:#BEF264}\nhtml[data-estetica=\"a\"] .ph{background-image:linear-gradient(170deg,#140a22,#241033 62%,#2a1209);background-size:100% 100%;animation:none}\nhtml[data-estetica=\"b\"] .ph{background-image:linear-gradient(170deg,#08121f,#0b1d27 70%,#0a1a1c);background-size:100% 100%;animation:none}\nhtml[data-estetica=\"c\"] .ph{background-image:linear-gradient(170deg,#12081f,#1d0b2f 65%,#220d1d);background-size:100% 100%;animation:none}\nhtml[data-estetica] .ph::before{display:none} /* las estrellas de siempre dejan paso al tema */\n\n#hw-decor{display:none;position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0}\nhtml[data-estetica] #hw-decor{display:block}\n.hw-dA,.hw-dB,.hw-dC{display:none;position:absolute;inset:0}\nhtml[data-estetica=\"a\"] .hw-dA,html[data-estetica=\"b\"] .hw-dB,html[data-estetica=\"c\"] .hw-dC{display:block}\n\n/* A · Brasas */\n.hw-dA::before{content:'';position:absolute;left:-20%;right:-20%;bottom:-25%;height:50%;background:radial-gradient(ellipse at 50% 100%,rgba(249,115,22,.32),transparent 65%)}\n.hw-em{position:absolute;bottom:-8px;border-radius:50%;background:#fb923c;box-shadow:0 0 6px 2px rgba(251,146,60,.8);opacity:0;animation:hwRise 18s linear infinite}\n@keyframes hwRise{0%{transform:translateY(0) scale(1);opacity:0}8%{opacity:.95}100%{transform:translateY(-105vh) translateX(18px) scale(.4);opacity:0}}\n/* B · Niebla y fantasmas */\n.hw-moon{position:absolute;border-radius:50%}\n.hw-dB .hw-moon{top:70px;right:16px;width:42px;height:42px;background:radial-gradient(circle at 35% 35%,#fffbe0,#f3d56b);box-shadow:0 0 28px 8px rgba(243,213,107,.28);opacity:.85}\n.hw-fog{position:absolute;bottom:-30px;left:-40%;width:200%;height:200px;background:radial-gradient(ellipse at 40% 60%,rgba(190,215,255,.16),transparent 62%);animation:hwFog 24s linear infinite alternate}\n.hw-fog.f2{bottom:90px;height:150px;animation-duration:32s;animation-direction:alternate-reverse;opacity:.7}\n@keyframes hwFog{from{transform:translateX(-12%)}to{transform:translateX(12%)}}\n.hw-gh{position:absolute;opacity:.2;animation:hwGh 9s ease-in-out infinite alternate}\n@keyframes hwGh{0%{transform:translate(0,0)}50%{transform:translate(14px,-22px)}100%{transform:translate(-10px,-44px)}}\n/* C · Murciélagos */\n.hw-dC .hw-moon{top:-90px;right:-80px;width:230px;height:230px;background:radial-gradient(circle at 40% 40%,#fb923c,#c2410c 70%);box-shadow:0 0 70px 12px rgba(249,115,22,.25);opacity:.5}\n.hw-bat{position:absolute;left:-40px;animation:hwBat 13s linear infinite,hwBob 2s ease-in-out infinite alternate}\n.hw-bat i{display:inline-block;font-style:normal;animation:hwFlap .22s ease-in-out infinite alternate;filter:brightness(.55)}\n@keyframes hwBat{from{left:-40px}to{left:calc(100% + 40px)}}\n@keyframes hwBob{from{margin-top:0}to{margin-top:16px}}\n@keyframes hwFlap{from{transform:scaleY(1)}to{transform:scaleY(.5)}}\n.hw-web{position:absolute;top:0;left:0}\n.hw-sp{position:absolute;top:0;left:62%;text-align:center}\n.hw-thr{width:1px;margin:0 auto;background:rgba(255,255,255,.5);height:20px;animation:hwThr 8s ease-in-out infinite alternate}\n@keyframes hwThr{from{height:18px}to{height:90px}}\n.hw-sp span{font-size:16px;display:block;margin-top:-2px}\n\n/* saludo, aviso de primera vez y calabaza del 31 */\n.hw-saludo{display:none;padding:0 14px;margin-top:-2px;font-size:12px;font-weight:800;color:var(--acc3)}\nhtml[data-estetica] .hw-saludo{display:block}\n.hw-aviso{display:none;margin:8px 14px 0;align-items:center;gap:8px;background:rgba(0,0,0,.4);border:1px solid #FB923C;border-radius:12px;padding:8px 10px;font-size:12px;font-weight:700;color:var(--tx)}\n.hw-aviso.on{display:flex}\n.hw-aviso span{flex:1}\n.hw-aviso button{all:unset;cursor:pointer;font-weight:800;color:#FDBA74;padding:2px 6px}\n.hw-aviso button.x{opacity:.7}\n.dc-calabaza{position:absolute;top:1px;left:2px;font-size:9px;line-height:1;z-index:2;filter:drop-shadow(0 0 4px rgba(249,115,22,.9))}\n.dc-hw31{box-shadow:0 0 10px rgba(249,115,22,.65)}\n\n/* tarjeta de Ajustes: las cuatro opciones */\n.hw-sub{font-size:12px;color:var(--tx2);margin:0 0 10px}\n.hw-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n.hw-tile{all:unset;box-sizing:border-box;cursor:pointer;display:block;border:2px solid var(--div);border-radius:14px;overflow:hidden;background:var(--s1)}\n.hw-tile.sel{border-color:#FB923C;box-shadow:0 0 0 2px rgba(251,146,60,.25)}\n.hw-mv{position:relative;height:62px;overflow:hidden}\n.hw-lb{display:flex;align-items:center;gap:6px;padding:7px 8px;font-size:11.5px;font-weight:700;color:var(--tx)}\n.hw-ck{width:14px;height:14px;border-radius:50%;border:2px solid var(--div);flex:none;box-sizing:border-box}\n.hw-tile.sel .hw-ck{background:#FB923C;border-color:#FB923C;box-shadow:inset 0 0 0 2px var(--s1)}\n.hw-cur{margin-top:10px;font-size:11.5px;color:var(--tx2)}\n.hw-cur b{color:var(--tx)}\n.hw-mA{background:linear-gradient(170deg,#140a22,#2a1209)}\n.hw-mB{background:linear-gradient(170deg,#08121f,#0a1a1c)}\n.hw-mC{background:linear-gradient(170deg,#12081f,#220d1d)}\n.hw-mN{background:linear-gradient(170deg,#1a1a2e,#0f3460)}\n.hw-mv .hw-em{animation-name:hwRiseS;animation-duration:5s}\n@keyframes hwRiseS{0%{transform:translateY(0);opacity:0}20%{opacity:.95}100%{transform:translateY(-60px);opacity:0}}\n.hw-mB .hw-moon{top:8px;right:10px;width:16px;height:16px;background:radial-gradient(circle at 35% 35%,#fffbe0,#f3d56b);box-shadow:0 0 12px 3px rgba(243,213,107,.3)}\n.hw-mB .hw-fog{height:60px;bottom:-12px}\n.hw-mB .hw-gh{opacity:.3}\n.hw-mC .hw-moon{top:-20px;right:-16px;width:62px;height:62px;background:radial-gradient(circle at 40% 40%,#fdba74,#f97316 70%);box-shadow:0 0 22px 4px rgba(249,115,22,.35);opacity:1}\n.hw-mC .hw-bat{animation-name:hwBatS,hwBob}\n@keyframes hwBatS{from{left:-20px}to{left:140px}}\n.hw-mN .hw-stars{position:absolute;inset:-10%;width:120%;height:120%;background-image:radial-gradient(2px 2px at 20px 20px,#fff,transparent),radial-gradient(2px 2px at 70px 40px,rgba(196,181,253,1),transparent),radial-gradient(2px 2px at 100px 12px,#fff,transparent);background-size:120px 70px;animation:hwStS 9s linear infinite}\n@keyframes hwStS{to{transform:translate(-120px,-70px)}}\n\n/* pantalla de carga: el neón y el fondo se tiñen según el tema elegido (solo si hay tema) */\nhtml[data-estetica=\"a\"] #splash-screen,html[data-estetica=\"c\"] #splash-screen{--neon:#fb923c;--neon2:#fed7aa;background:radial-gradient(ellipse at 50% 42%,#4a1d0a 0%,#2a1209 55%,#140a22 100%)}\nhtml[data-estetica=\"b\"] #splash-screen{--neon:#84cc16;--neon2:#d9f99d;background:radial-gradient(ellipse at 50% 42%,#14532d 0%,#0a2a24 55%,#08121f 100%)}\n\n@media (prefers-reduced-motion: reduce){\n  #hw-decor *,.hw-mv *{animation:none!important}\n  .hw-bat{display:none}\n  .hw-em{opacity:.5}\n}";
  var st = document.createElement('style');
  st.id = 'tema-halloween-css';
  st.textContent = CSS;
  (document.head || document.documentElement).appendChild(st);

  // ── Piezas de la página (se insertan cuando el HTML ya está cargado) ──
  var DECOR = "<!-- NUEVO — Adornos de los temas de Halloween (solo se ven si la persona\n     ha elegido uno en Ajustes → Estética de la app, y solo hasta el\n     5 de noviembre). Van detrás de todo el contenido y no reciben toques. -->\n<div id=\"hw-decor\" aria-hidden=\"true\">\n  <div class=\"hw-dA\"><b class=\"hw-em\" style=\"left:6%;width:3px;height:3px;animation-delay:0s;animation-duration:16s\"></b><b class=\"hw-em\" style=\"left:15%;width:4px;height:4px;animation-delay:3s;animation-duration:19s\"></b><b class=\"hw-em\" style=\"left:25%;width:3px;height:3px;animation-delay:7s;animation-duration:15s\"></b><b class=\"hw-em\" style=\"left:34%;width:3px;height:3px;animation-delay:1s;animation-duration:21s\"></b><b class=\"hw-em\" style=\"left:44%;width:4px;height:4px;animation-delay:9s;animation-duration:17s\"></b><b class=\"hw-em\" style=\"left:53%;width:3px;height:3px;animation-delay:4s;animation-duration:22s\"></b><b class=\"hw-em\" style=\"left:62%;width:3px;height:3px;animation-delay:12s;animation-duration:16s\"></b><b class=\"hw-em\" style=\"left:71%;width:4px;height:4px;animation-delay:6s;animation-duration:20s\"></b><b class=\"hw-em\" style=\"left:80%;width:3px;height:3px;animation-delay:2s;animation-duration:18s\"></b><b class=\"hw-em\" style=\"left:88%;width:3px;height:3px;animation-delay:10s;animation-duration:15s\"></b><b class=\"hw-em\" style=\"left:20%;width:3px;height:3px;animation-delay:13s;animation-duration:21s\"></b><b class=\"hw-em\" style=\"left:57%;width:4px;height:4px;animation-delay:15s;animation-duration:19s\"></b></div>\n  <div class=\"hw-dB\"><div class=\"hw-moon\"></div><div class=\"hw-fog f2\"></div><div class=\"hw-fog\"></div><span class=\"hw-gh\" style=\"left:8%;top:30%;animation-delay:0s;font-size:26px\">👻</span><span class=\"hw-gh\" style=\"left:72%;top:48%;animation-delay:2s;font-size:20px\">👻</span><span class=\"hw-gh\" style=\"left:40%;top:66%;animation-delay:4s;font-size:30px\">👻</span><span class=\"hw-gh\" style=\"left:80%;top:78%;animation-delay:6s;font-size:22px\">👻</span></div>\n  <div class=\"hw-dC\"><div class=\"hw-moon\"></div><svg class=\"hw-web\" viewBox=\"0 0 80 80\" width=\"110\" height=\"110\" fill=\"none\" stroke=\"rgba(255,255,255,.3)\" stroke-width=\"1\"><path d=\"M0 0 L80 0 M0 0 L0 80 M0 0 L68 68 M0 0 L80 30 M0 0 L30 80\"/><path d=\"M22 0 Q18 18 0 22 M44 0 Q36 36 0 44 M66 0 Q54 54 0 66\"/></svg><div class=\"hw-sp\"><div class=\"hw-thr\"></div><span>🕷️</span></div><span class=\"hw-bat\" style=\"top:9%;animation-delay:0s,0s;animation-duration:13s,2s;font-size:18px\"><i>🦇</i></span><span class=\"hw-bat\" style=\"top:22%;animation-delay:5s,5s;animation-duration:11s,2s;font-size:15px\"><i>🦇</i></span><span class=\"hw-bat\" style=\"top:38%;animation-delay:9s,9s;animation-duration:15s,2s;font-size:20px\"><i>🦇</i></span></div>\n</div>\n";
  var AVISO = "  <!-- NUEVO — Aviso de una sola vez: \"Elige tu estética\". Solo sale en las\n       semanas de Halloween y solo a quien aún no ha elegido nada. -->\n  <div class=\"hw-aviso\" id=\"hw-aviso\">\n    <span>🎃 ¡Halloween! Puedes elegir cómo ver la app.</span>\n    <button type=\"button\" onclick=\"hwAbrirSelector()\">Elegir</button>\n    <button type=\"button\" class=\"x\" aria-label=\"Cerrar aviso\" onclick=\"hwCerrarAviso(true)\">✕</button>\n  </div>";
  var SALUDO = "  <div class=\"hw-saludo\">🎃 Feliz Halloween</div>";
  var AJUSTES = "      <!-- ── ACORDEÓN: Estética de la app (Halloween) ──\n           Solo visible mientras dura Halloween (ver aplicarEstetica()).\n           Cada persona elige la suya; por defecto, todo normal. -->\n      <div class=\"aj-acc-item\" id=\"aj-acc-estetica\" style=\"display:none\">\n        <div class=\"aj-acc-hdr\" onclick=\"toggleAjAcc('aj-acc-estetica')\">\n          <span class=\"aj-acc-hdr-ico\">🎃</span>\n          <span class=\"aj-acc-hdr-tit\">Estética de la app</span>\n          <span class=\"aj-acc-hdr-arr\">›</span>\n        </div>\n        <div class=\"aj-acc-body\">\n<div class=\"aj-card\">\n        <div class=\"aj-card-hdr c-amber\">\n          <div class=\"aj-card-hdr-ico\">🎨</div>\n          <div class=\"aj-card-hdr-txt\">\n            <div class=\"aj-card-hdr-tit\">Estética de Halloween</div>\n            <div class=\"aj-card-hdr-sub\">Hasta el 5 de noviembre</div>\n          </div>\n        </div>\n        <div class=\"aj-card-body\">\n          <div class=\"hw-sub\">Elige cómo quieres ver TrenTurnos. El cambio se ve al instante, y es solo para ti.</div>\n          <div class=\"hw-tiles\">\n            <button type=\"button\" class=\"hw-tile\" data-k=\"a\" aria-pressed=\"false\" onclick=\"elegirEstetica('a')\"><div class=\"hw-mv hw-mA\"><b class=\"hw-em\" style=\"left:20%;width:3px;height:3px;animation-delay:0s\"></b><b class=\"hw-em\" style=\"left:50%;width:2px;height:2px;animation-delay:1.6s\"></b><b class=\"hw-em\" style=\"left:76%;width:3px;height:3px;animation-delay:3s\"></b></div><div class=\"hw-lb\"><i class=\"hw-ck\"></i>Brasas</div></button>\n            <button type=\"button\" class=\"hw-tile\" data-k=\"b\" aria-pressed=\"false\" onclick=\"elegirEstetica('b')\"><div class=\"hw-mv hw-mB\"><div class=\"hw-moon\"></div><div class=\"hw-fog\"></div><span class=\"hw-gh\" style=\"left:20%;top:38%;font-size:16px\">👻</span></div><div class=\"hw-lb\"><i class=\"hw-ck\"></i>Niebla y fantasmas</div></button>\n            <button type=\"button\" class=\"hw-tile\" data-k=\"c\" aria-pressed=\"false\" onclick=\"elegirEstetica('c')\"><div class=\"hw-mv hw-mC\"><div class=\"hw-moon\"></div><span class=\"hw-bat\" style=\"top:36%;font-size:13px;animation-duration:5s,2s\"><i>🦇</i></span></div><div class=\"hw-lb\"><i class=\"hw-ck\"></i>Murciélagos</div></button>\n            <button type=\"button\" class=\"hw-tile sel\" data-k=\"n\" aria-pressed=\"true\" onclick=\"elegirEstetica('n')\"><div class=\"hw-mv hw-mN\"><div class=\"hw-stars\"></div></div><div class=\"hw-lb\"><i class=\"hw-ck\"></i>Normal (sin Halloween)</div></button>\n          </div>\n          <div class=\"hw-cur\">Elegida: <b id=\"hw-cur\">Normal (sin Halloween)</b></div>\n        </div>\n      </div>\n        </div>\n      </div>\n";

  // ── Funciones (globales: los botones del tema las llaman con onclick) ──
/* ═══════════════════════════════════════════════════════════
   NUEVO — TEMAS DE HALLOWEEN. Cada persona elige el suyo en Ajustes →
   Estética de la app (a=Brasas, b=Niebla y fantasmas, c=Murciélagos,
   n=Normal). Por defecto (sin elegir) todo se ve normal. Solo existen
   entre window.HW_DESDE y window.HW_HASTA (definidas en el <head>):
   fuera de ese rango no se aplica nada y la tarjeta de Ajustes se
   oculta sola — el 6 de noviembre no hay que subir nada.
═══════════════════════════════════════════════════════════ */
var HW_NOMBRES = {a:'Brasas', b:'Niebla y fantasmas', c:'Murciélagos', n:'Normal (sin Halloween)'};
function hwFechaHoy(){ var d=new Date(); return d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2); }
function hwVigente(){ var h=hwFechaHoy(); return h>=window.HW_DESDE && h<=window.HW_HASTA; }
function esteticaActiva(){
  if(!hwVigente()) return '';
  var e = (typeof AJ!=='undefined' && AJ) ? AJ.estetica : '';
  return (e==='a'||e==='b'||e==='c') ? e : '';
}
function aplicarEstetica(){
  var e = esteticaActiva(), root = document.documentElement;
  if(e) root.setAttribute('data-estetica', e); else root.removeAttribute('data-estetica');
  var item = document.getElementById('aj-acc-estetica');
  if(item) item.style.display = hwVigente() ? '' : 'none';
  var sel = e || 'n';
  var tiles = document.querySelectorAll('.hw-tile');
  for(var i=0;i<tiles.length;i++){
    var on = tiles[i].getAttribute('data-k') === sel;
    tiles[i].classList.toggle('sel', on);
    tiles[i].setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  var cur = document.getElementById('hw-cur'); if(cur) cur.textContent = HW_NOMBRES[sel];
  if(!hwVigente()) hwCerrarAviso(false);
}
function elegirEstetica(k){
  AJ.estetica = (k==='a'||k==='b'||k==='c') ? k : 'n';
  try{ localStorage.setItem('aj5', JSON.stringify(AJ)); }catch(e){}
  aplicarEstetica();
  hwCerrarAviso(true); // quien ya ha elegido (aunque sea "Normal") no necesita el aviso
  if(typeof renderCal==='function') renderCal(); // para que salga/desaparezca la calabaza del 31
  if(typeof _autoGuardarNubeDebounced==='function') _autoGuardarNubeDebounced();
}
function hwMostrarAviso(){
  var el = document.getElementById('hw-aviso'); if(!el) return;
  var visto = ''; try{ visto = localStorage.getItem('hw_aviso_visto') || ''; }catch(e){}
  var yaEligio = !!(AJ && AJ.estetica);
  el.classList.toggle('on', hwVigente() && !visto && !yaEligio);
}
function hwCerrarAviso(marcar){
  var el = document.getElementById('hw-aviso'); if(el) el.classList.remove('on');
  if(marcar){ try{ localStorage.setItem('hw_aviso_visto','1'); }catch(e){} }
}
function hwAbrirSelector(){
  hwCerrarAviso(true);
  if(typeof goP==='function') goP('ajustes');
  setTimeout(function(){
    var it = document.getElementById('aj-acc-estetica');
    if(!it) return;
    if(!it.classList.contains('aj-acc-open') && typeof toggleAjAcc==='function') toggleAjAcc('aj-acc-estetica');
    if(it.scrollIntoView) it.scrollIntoView({block:'start', behavior:'smooth'});
  }, 80);
}
// Si la app se queda abierta y cambia el día (p. ej. pasa del 5 al 6 de noviembre), al volver a ella se revisa.
document.addEventListener('visibilitychange', function(){ if(!document.hidden) aplicarEstetica(); });

  window.HW_NOMBRES = HW_NOMBRES; window.hwFechaHoy = hwFechaHoy; window.hwVigente = hwVigente;
  window.esteticaActiva = esteticaActiva; window.aplicarEstetica = aplicarEstetica;
  window.elegirEstetica = elegirEstetica; window.hwMostrarAviso = hwMostrarAviso;
  window.hwCerrarAviso = hwCerrarAviso; window.hwAbrirSelector = hwAbrirSelector;

  // Calabaza del 31 de octubre: se añade a la celda del calendario
  // después de que la app lo pinte.
  function hwCalabaza31() {
    var cells = document.querySelectorAll('.dc[data-k$="-10-31"]');
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (!esteticaActiva() || c.querySelector('.dc-calabaza')) continue;
      c.classList.add('dc-hw31');
      var s = document.createElement('span');
      s.className = 'dc-calabaza';
      s.textContent = '🎃';
      c.insertBefore(s, c.firstChild);
    }
  }

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

    if (typeof window.renderCal === 'function') {
      var renderCalOriginal = window.renderCal;
      window.renderCal = function () {
        var r = renderCalOriginal.apply(this, arguments);
        hwCalabaza31();
        return r;
      };
    }
    aplicarEstetica();
    hwMostrarAviso();
    hwCalabaza31();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
