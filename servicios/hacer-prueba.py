# Monta la copia de prueba del diseño sencillo en el repo Servicios (carpeta prueba/).
import re
src=open('servicios.html').read()
css=open('prueba-sencillo.css').read(); js=open('prueba-sencillo.js').read()
a="var CLAVE='trenturnosServiciosAbordo', CARGADO_EN=0;"
assert src.count(a)==1; src=src.replace(a,"var CLAVE='trenturnosServiciosAbordoPRUEBA', CARGADO_EN=0; // copia de prueba: se guarda aparte")
i=src.index('</style>'); src=src[:i]+css+src[i:]
m=list(re.finditer(r'\nrestaurar\(\);\n',src)); assert len(m)==1
src=src[:m[0].start()]+'\n'+js+src[m[0].start():]
open('/home/user/servicios/prueba/servicios.html','w').write(src)
h=open('/home/user/servicios/index.html').read()
h=h.replace('<link rel="manifest" href="manifest.webmanifest">','')
h=re.sub(r"if\('serviceWorker' in navigator\)[^\n]*\n","",h)
h=re.sub(r"servicios\.html\?v=\d+","servicios.html?v=2",h)
h=re.sub(r'(href|src)="(icono-[^"]+)"',r'\1="../\2"',h)
h=re.sub(r'<title>([^<]*)</title>',r'<title>\1 · PRUEBA</title>',h,1)
h=h.replace('<body>','<body><div style="position:fixed;bottom:74px;left:8px;z-index:9999;background:#F59E0B;color:#111;font:900 10px Inter,sans-serif;padding:3px 8px;border-radius:8px;opacity:.9;pointer-events:none">VERSIÓN DE PRUEBA · diseño sencillo</div>',1)
open('/home/user/servicios/prueba/index.html','w').write(h)
print('ok')
