#!/usr/bin/env python3
"""Incrusta privacidad/privacidad.html en un index.html (antes del último </body>).
Uso: python3 privacidad/incrustar.py version-url/index.html www/index.html
Si el bloque PRIVACIDAD:INICIO/FIN ya existe, lo sustituye."""
import os, re, sys
fuente = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'privacidad.html'), encoding='utf-8').read().strip()
for ruta in sys.argv[1:]:
    s = open(ruta, encoding='utf-8').read()
    m = re.search(r'<!-- PRIVACIDAD:INICIO.*?<!-- PRIVACIDAD:FIN -->', s, re.S)
    if m:
        s = s[:m.start()] + fuente + s[m.end():]
    else:
        i = s.rindex('</body>')
        s = s[:i] + fuente + '\n' + s[i:]
    open(ruta, 'w', encoding='utf-8').write(s)
    print('Privacidad incrustada en', ruta)
