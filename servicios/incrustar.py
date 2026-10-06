#!/usr/bin/env python3
"""Incrusta servicios/servicios.html en la versión URL (un solo archivo).

Uso:  python3 servicios/incrustar.py [ruta/al/index.html]   (por defecto version-url/index.html)

El módulo va dentro de un <iframe srcdoc> a pantalla completa: sus estilos y
funciones quedan aislados del resto de la app. Se puede ejecutar las veces que
haga falta: sustituye el bloque entre los marcadores SERVICIOS:INICIO/FIN.
"""
import json, os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
destino = sys.argv[1] if len(sys.argv) > 1 else os.path.join(RAIZ, 'version-url', 'index.html')
with open(os.path.join(RAIZ, 'servicios', 'servicios.html'), encoding='utf-8') as fh:
    fuente = fh.read()
# La app nunca lleva el PDF de prueba (tiene nombres de clientes).
fuente = re.sub(r"var EJEMPLO_PDF_B64 = '[^']*';", "var EJEMPLO_PDF_B64 = '';", fuente)

# "<" como \u003c: ni un </script> ni un <!-- del módulo pueden cortar el <script> de la app.
texto = json.dumps(fuente, ensure_ascii=False).replace('<', '\\u003c')
bloque = '''<!-- SERVICIOS:INICIO — generado por servicios/incrustar.py; no editar a mano -->
<div id="servicios-screen" style="display:none;position:fixed;inset:0;z-index:9998;background:#07111F">
  <iframe id="servicios-frame" title="Servicios a bordo" style="border:0;width:100%;height:100%;display:block;background:#07111F"></iframe>
</div>
<script>
var SERVICIOS_HTML = ''' + texto + ''';
// Se carga la primera vez que se abre Servicios (no antes: no pesa en el arranque).
// desdeCal: abierto con el botón 🍽️ del Calendario (sin cambiar de perfil; 📅 vuelve).
window.__svMostrar = function(desdeCal){
  var s = document.getElementById('servicios-screen'), f = document.getElementById('servicios-frame');
  if(!s || !f) return;
  window.__svDesdeCal = desdeCal === true;
  if(!f.getAttribute('srcdoc')) f.setAttribute('srcdoc', SERVICIOS_HTML);
  else { try{ var w = f.contentWindow; if(w && w.svAlMostrar) w.svAlMostrar(window.__svDesdeCal); }catch(e){} }
  s.style.display = 'block';
  window.__svSyncTema();
};
window.__svOcultar = function(){
  var s = document.getElementById('servicios-screen');
  if(s) s.style.display = 'none';
};
window.__svVisible = function(){
  var s = document.getElementById('servicios-screen');
  return !!(s && s.style.display !== 'none');
};
// Botón "atrás": primero decide el módulo (cerrar ficha, volver al mapa…).
window.__svAtras = function(){
  try{ var w = document.getElementById('servicios-frame').contentWindow; return !!(w && w.svAtras && w.svAtras()); }catch(e){ return false; }
};
// Temas de temporada: se pasa al módulo el tema activo de la app (Halloween, Navidad…):
// atributos de <html>, sus estilos (reglas hw-/nv-), los adornos y las opciones para elegir.
// No depende de ningún tema en concreto: si no hay ninguno activo, no se pasa nada.
window.__svTema = function(){
  var root = document.documentElement, attrs = {}, n = 0;
  ['data-estetica','data-navidad'].forEach(function(a){ if(root.hasAttribute(a)){ attrs[a] = root.getAttribute(a); n++; } });
  var hw = typeof hwVigente === 'function' && hwVigente();
  var nvItem = document.getElementById('aj-acc-navidad');
  var nv = !!(nvItem && nvItem.style.display !== 'none');
  if(!hw && !nv) return null;
  var css = [];
  for(var i = 0; i < document.styleSheets.length; i++){
    var reglas; try{ reglas = document.styleSheets[i].cssRules; }catch(e){ continue; }
    for(var j = 0; j < reglas.length; j++){
      var r = reglas[j];
      if(r.type === 1){
        var s = r.selectorText || '';
        // Las de solo color de acento (html[data-…="a"]{--acc…}) no: Servicios conserva su ámbar.
        if(/hw-|nv-|data-estetica|data-navidad/.test(s) && !/^html\\[data-(estetica|navidad)(="?\\w"?)?\\]$/.test(s.trim())) css.push(r.cssText);
      } else if(r.type === 7 && /^(hw|nv)/i.test(r.name)) css.push(r.cssText);
    }
  }
  var t = { attrs: attrs, css: css.join('\\n') };
  if(nv){
    var dn = document.getElementById('nv-decor'), tn = document.querySelector('#aj-acc-navidad .nv-tiles');
    t.color = '#22C55E'; t.decorId = 'nv-decor'; t.decor = dn ? dn.innerHTML : ''; t.emoji = '🎄';
    t.saludo = attrs['data-navidad'] ? '🎄 Feliz Navidad' : ''; t.titulo = 'Estética de Navidad';
    t.opciones = tn ? '<div class="nv-tiles">'+tn.innerHTML+'</div>' : '';
    var cn = document.getElementById('nv-cur'); t.elegida = cn ? cn.textContent : '';
  } else {
    var dh = document.getElementById('hw-decor'), th = document.querySelector('#aj-acc-estetica .hw-tiles');
    t.color = '#FB923C'; t.decorId = 'hw-decor'; t.decor = dh ? dh.innerHTML : ''; t.emoji = '🎃';
    t.saludo = attrs['data-estetica'] ? '🎃 Feliz Halloween' : ''; t.titulo = 'Estética de Halloween';
    t.opciones = th ? '<div class="hw-tiles">'+th.innerHTML+'</div>' : '';
    var ch = document.getElementById('hw-cur'); t.elegida = ch ? ch.textContent : '';
  }
  return t;
};
// 📨 MOL compartido: aviso en el Calendario + punto rojo en 🍽️ cuando un compañero
// comparte un MOL con mi matrícula. Si falta el botón o el aviso, no hace nada.
window.__svAvisos = [];
window.__svComprobarCompartidos = async function(){
  var caja = document.getElementById('sv-aviso'), badge = document.getElementById('hbtn-servicios-badge');
  var mat = (typeof AJ !== 'undefined' && AJ && AJ.matricula) ? String(AJ.matricula).trim() : '';
  if(!caja || typeof sbAdmin === 'undefined' || !sbAdmin || !mat) return;
  var lista = [];
  try{ var r = await sbAdmin.rpc('sv_pendientes', { p_matricula: mat }); if(!r.error) lista = r.data || []; }catch(e){ return; }
  window.__svAvisos = lista;
  if(badge) badge.style.display = lista.length ? 'block' : 'none';
  var t = function(x){ var d = document.createElement('div'); d.textContent = x == null ? '' : String(x); return d.innerHTML; };
  caja.innerHTML = lista.map(function(a, i){
    return '<div class="sv-aviso-item"><span class="sv-aviso-ico">📨</span><div class="sv-aviso-txt"><b>'+t(a.de_matricula)+' te comparte el MOL</b><small>Tren '+(t(a.tren)||'—')+(a.fecha ? ' · '+t(a.fecha) : '')+'</small></div>'+
      '<button class="sv-aviso-ver" onclick="__svAbrirCompartido('+i+')">Ver</button><button class="sv-aviso-no" onclick="__svRechazarCompartido('+i+')" title="Rechazar">✕</button></div>';
  }).join('');
  caja.style.display = lista.length ? 'block' : 'none';
};
window.__svAbrirCompartido = function(i){
  var a = window.__svAvisos[i]; if(!a) return;
  a.para = String(AJ.matricula).trim();
  window.__svPendienteAbrir = a;
  window.__svMostrar(true);
  try{ var w = document.getElementById('servicios-frame').contentWindow;
    if(w && w.svAbrirCompartido && window.__svPendienteAbrir){ window.__svPendienteAbrir = null; w.svAbrirCompartido(a); } }catch(e){}
};
window.__svRechazarCompartido = async function(i){
  var a = window.__svAvisos[i]; if(!a || !confirm('¿Rechazar el MOL de '+a.de_matricula+'?')) return;
  try{ await sbAdmin.rpc('sv_rechazar', { p_id: a.id, p_matricula: String(AJ.matricula).trim() }); }catch(e){}
  window.__svComprobarCompartidos();
};
(function(){
  function mirar(){ if(!document.hidden) window.__svComprobarCompartidos(); }
  setTimeout(mirar, 4000);
  setInterval(mirar, 60000);
  document.addEventListener('visibilitychange', mirar);
})();
window.__svSyncTema = function(){
  try{ var w = document.getElementById('servicios-frame').contentWindow; if(w && w.svAplicarTema) w.svAplicarTema(window.__svTema()); }catch(e){}
};
// Al elegir estética (desde Ajustes o desde Servicios), Servicios se actualiza.
(function(){
  function envolver(nombre){
    var f = window[nombre]; if(typeof f !== 'function' || f.__sv) return;
    window[nombre] = function(){ var r = f.apply(this, arguments); window.__svSyncTema(); return r; };
    window[nombre].__sv = true;
  }
  function enganchar(){ envolver('elegirEstetica'); envolver('nvElegir'); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(enganchar, 0); }); else setTimeout(enganchar, 0);
})();
</script>
<!-- SERVICIOS:FIN -->
'''

with open(destino, encoding='utf-8') as fh:
    html = fh.read()
ini, fin = '<!-- SERVICIOS:INICIO', '<!-- SERVICIOS:FIN -->'
if ini in html:
    a = html.index(ini); b = html.index(fin, a) + len(fin) + 1
    html = html[:a] + bloque + html[b:]
else:
    i = html.rindex('</body>')
    html = html[:i] + bloque + html[i:]
with open(destino, 'w', encoding='utf-8') as fh:
    fh.write(html)
print('Servicios incrustado en', destino, '(%d KB)' % (len(bloque) // 1024))
