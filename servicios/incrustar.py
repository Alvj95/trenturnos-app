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
fuente = open(os.path.join(RAIZ, 'servicios', 'servicios.html'), encoding='utf-8').read()
# La app nunca lleva el PDF de prueba (tiene nombres de clientes).
fuente = re.sub(r"var EJEMPLO_PDF_B64 = '[^']*';", "var EJEMPLO_PDF_B64 = '';", fuente)

texto = json.dumps(fuente, ensure_ascii=False).replace('</', '<\\/')
bloque = '''<!-- SERVICIOS:INICIO — generado por servicios/incrustar.py; no editar a mano -->
<div id="servicios-screen" style="display:none;position:fixed;inset:0;z-index:9998;background:#07111F">
  <iframe id="servicios-frame" title="Servicios a bordo" style="border:0;width:100%;height:100%;display:block;background:#07111F"></iframe>
</div>
<script>
var SERVICIOS_HTML = ''' + texto + ''';
// Se carga la primera vez que se abre Servicios (no antes: no pesa en el arranque).
window.__svMostrar = function(){
  var s = document.getElementById('servicios-screen'), f = document.getElementById('servicios-frame');
  if(!s || !f) return;
  if(!f.getAttribute('srcdoc')) f.setAttribute('srcdoc', SERVICIOS_HTML);
  s.style.display = 'block';
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
</script>
<!-- SERVICIOS:FIN -->
'''

html = open(destino, encoding='utf-8').read()
ini, fin = '<!-- SERVICIOS:INICIO', '<!-- SERVICIOS:FIN -->'
if ini in html:
    a = html.index(ini); b = html.index(fin, a) + len(fin) + 1
    html = html[:a] + bloque + html[b:]
else:
    i = html.rindex('</body>')
    html = html[:i] + bloque + html[i:]
open(destino, 'w', encoding='utf-8').write(html)
print('Servicios incrustado en', destino, '(%d KB)' % (len(bloque) // 1024))
