"""Construye el bloque de la pantalla de inicio de Navidad a partir de maquetas/pantalla-inicio-navidad.html
y lo mete en version-url/index.html y www/index.html justo después del bloque del luto."""
import re, sys
R='/home/user/trenturnos-app/'
m=open(R+'maquetas/pantalla-inicio-navidad.html',encoding='utf-8').read()
css=m[m.index('<style>')+7:m.index('</style>')]
body=m[m.index('<div id="stage">')+len('<div id="stage">'):m.index('<script>')]
body=body[:body.rindex('</div>')]                       # cierra #stage
# fuera: «Jo, jo, jo», «Toca la pantalla…» y el rótulo de maqueta
body=re.sub(r'\s*<div class="ho">.*?</div>','',body)
body=re.sub(r'\s*<div class="tap".*?</div>','',body)
body=re.sub(r'\s*<div class="cap">.*?</div>','',body)
assert 'Jo, jo' not in body and 'Toca la pantalla' not in body
# ids propios (spTb ya lo usa el tren de la pantalla normal, que está oculta → el tren saldría sin color)
for viejo in re.findall(r'id="([^"]+)"',body):
    nuevo='nv'+viejo[0].upper()+viejo[1:]
    body=body.replace('id="'+viejo+'"','id="'+nuevo+'"').replace('#'+viejo+')','#'+nuevo+')').replace('"#'+viejo+'"','"#'+nuevo+'"')
    css=css.replace('#'+viejo+')','#'+nuevo+')')
# animaciones con prefijo para no chocar con las de la app
kf=re.findall(r'@keyframes\s+([\w-]+)',css)
ren={k:'nvs'+k[0].upper()+k[1:] for k in set(kf)}
def _ren_val(mo):   # solo dentro de «animation:» / «animation-name:», no en las clases
    v=mo.group(2)
    for k in sorted(ren,key=len,reverse=True): v=re.sub(r'(?<![\w-])'+re.escape(k)+r'(?![\w-])',ren[k],v)
    return mo.group(1)+v
css=re.sub(r'(animation(?:-name)?\s*:)([^;}]*)',_ren_val,css)
css=re.sub(r'@keyframes\s+([\w-]+)',lambda mo:'@keyframes '+ren[mo.group(1)],css)
# encerrar cada regla bajo #nv-splash
out=[]; i=0; S='#nv-splash'
while i<len(css):
    j=css.find('{',i)
    if j<0: break
    sel=css[i:j].strip(); 
    # bloque con llaves anidadas
    d=0; k=j
    while True:
        if css[k]=='{': d+=1
        elif css[k]=='}':
            d-=1
            if d==0: break
        k+=1
    cuerpo=css[j:k+1]; i=k+1
    sel=re.sub(r'/\*.*?\*/','',sel,flags=re.S).strip()
    if not sel: continue
    if sel.startswith('@keyframes'): out.append(sel+cuerpo); continue
    if sel in ('*','html,body','body'): continue
    partes=[]
    for s in sel.split(','):
        s=s.strip()
        if s=='#stage': partes.append(S)
        elif s.startswith('.run '): partes.append(S+'.run '+s[5:])
        elif s=='.run': partes.append(S+'.run')
        else: partes.append(S+' '+s)
    out.append(','.join(partes)+cuerpo)
cssS='\n'.join(out)
cssS+="\n#nv-splash *{box-sizing:border-box;margin:0}\n#splash-screen.sp-nav>*:not(#nv-capa){display:none!important}\n#splash-screen.sp-nav{background:#050c18!important}\n#splash-screen.sp-nav::before{display:none}\n#nv-capa{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;overflow:hidden}\n#nv-splash{flex:none}"
js=r"""
// NUEVO — Navidad: del 2 de noviembre al 6 de enero la pantalla de inicio es la de Navidad (tren congelado,
// Papá Noel y la azafata cantando «It's tiiime!»), para todos. El sonido sale solo al abrir, como el ding-dong
// (si el navegador no deja, suena al primer toque mientras se ve la pantalla). Sin voz: es música generada aquí.
window.NAV_DESDE = '11-02';
window.NAV_HASTA = '01-06';
(function(){
  try{
    if(window.LUTO_ACTIVO) return;
    var d=new Date(), md=('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);
    if(!(md >= window.NAV_DESDE || md <= window.NAV_HASTA)) return;
    var sp=document.getElementById('splash-screen'); if(!sp) return;
    window.NAVIDAD_ACTIVO = true;
    sp.classList.add('sp-nav');
    sp.insertAdjacentHTML('beforeend','<div id="nv-capa" aria-hidden="true"><div id="nv-splash">'+NV_HTML+'</div></div>');
    var st=document.getElementById('nv-splash');
    var esc=Math.min(innerWidth/360, innerHeight/640); st.style.transform='scale('+esc+')';
    var reducir=!!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if(!reducir) st.classList.add('run');
    // ── Sonido (Web Audio, sin archivos): hielo que cruje y se rompe, campanillas y el «It's tiiime!» cantado ──
    if(reducir || sessionStorage.getItem('dingDongSonado')) return;
    var AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
    var ctx=new AC(), hecho=false, t0=performance.now();
    function ruido(t,dur,vol,fc){ var n=Math.floor(ctx.sampleRate*dur), b=ctx.createBuffer(1,n,ctx.sampleRate), dd=b.getChannelData(0);
      for(var i=0;i<n;i++) dd[i]=(Math.random()*2-1)*Math.pow(1-i/n,3);
      var s=ctx.createBufferSource(); s.buffer=b; var f=ctx.createBiquadFilter(); f.type='highpass'; f.frequency.value=fc;
      var g=ctx.createGain(); g.gain.value=vol; s.connect(f); f.connect(g); g.connect(ctx.destination); s.start(t); }
    function campana(t,fr,vol){ var o=ctx.createOscillator(), g=ctx.createGain(); o.type='sine'; o.frequency.value=fr;
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(vol,t+.01); g.gain.exponentialRampToValueAtTime(.0001,t+1.2);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t+1.3); }
    function cantar(t){ var src=ctx.createOscillator(); src.type='sawtooth';
      var lfo=ctx.createOscillator(), ld=ctx.createGain(); lfo.frequency.value=5.6; ld.gain.value=0; lfo.connect(ld); ld.connect(src.frequency);
      var out=ctx.createGain(); out.gain.value=0; out.connect(ctx.destination);
      [[850,1.0,9],[1220,.6,10],[2810,.35,12]].forEach(function(f){ var bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=f[0]; bp.Q.value=f[2];
        var g=ctx.createGain(); g.gain.value=f[1]*3; src.connect(bp); bp.connect(g); g.connect(out); });
      [[0,659],[.18,784],[.42,880],[.62,988],[.80,880],[.95,988],[1.12,1175]].forEach(function(n){ src.frequency.setTargetAtTime(n[1],t+n[0],.025); });
      src.frequency.setValueAtTime(659,t);
      out.gain.setValueAtTime(0,t); out.gain.linearRampToValueAtTime(.22,t+.06); out.gain.setValueAtTime(.22,t+.14);
      out.gain.linearRampToValueAtTime(.06,t+.17); out.gain.linearRampToValueAtTime(.24,t+.22);
      out.gain.setValueAtTime(.24,t+1.5); out.gain.exponentialRampToValueAtTime(.0001,t+1.9);
      ld.gain.setValueAtTime(0,t+.5); ld.gain.linearRampToValueAtTime(18,t+1.1);
      src.start(t); lfo.start(t); src.stop(t+2); lfo.stop(t+2); }
    function sonar(){
      if(hecho || ctx.state!=='running' || !document.getElementById('nv-splash')) return;
      hecho=true; quitar(); try{ sessionStorage.setItem('dingDongSonado','1'); }catch(e){}
      // se cuadra con la animación aunque empiece un poco tarde
      var ya=(performance.now()-t0)/1000, t=ctx.currentTime+.02-Math.min(ya,0);
      var at=function(s){ return t+Math.max(0,s-ya); };
      if(ya<.8) ruido(at(.8),.12,.5,1800); if(ya<1.4) ruido(at(1.4),.16,.7,1400); if(ya<2.0) ruido(at(2.0),.22,.9,1000);
      if(ya<2.4){ ruido(at(2.4),.7,1.0,600); [2093,2637,3136,2349,2794].forEach(function(f,i){ campana(at(2.42+i*.05),f,.08); }); }
      if(ya<2.6) [784,988,1175,1568,1175,1568].forEach(function(f,i){ campana(at(2.6+i*.14),f,.18); });
      if(ya<3.0){ ruido(at(3.0),.9,.25,300); for(var k=0;k<14;k++){ campana(at(2.7+k*.12),2600+(k%3)*350,.05); ruido(at(2.7+k*.12),.05,.12,4000); } }
      cantar(at(3.0));
    }
    function alTocar(){ if(hecho || !document.getElementById('nv-splash')){ quitar(); return; } ctx.resume().then(sonar).catch(function(){}); }
    function quitar(){ ['pointerdown','touchstart','keydown'].forEach(function(ev){ document.removeEventListener(ev, alTocar, true); }); }
    ['pointerdown','touchstart','keydown'].forEach(function(ev){ document.addEventListener(ev, alTocar, true); });
    if(ctx.state==='running') sonar(); else ctx.resume().then(sonar).catch(function(){});
  }catch(e){}
})();
"""
html=re.sub(r'\n\s*',' ',body.strip())
import json
bloque=('<!-- NAVIDAD:INICIO — pantalla de inicio de Navidad. FUENTE: maquetas/pantalla-inicio-navidad.html, '
        'se genera con maquetas/navidad_incrustar.py (sin «Jo, jo, jo» ni «Toca la pantalla»). -->\n'
        '<style>\n'+cssS+'\n</style>\n<script>\nvar NV_HTML = '+json.dumps(html,ensure_ascii=False).replace('<','\\u003c')+';'+js+'</script>\n<!-- NAVIDAD:FIN -->')
for p in sys.argv[1:]:
    s=open(p,encoding='utf-8').read()
    a=re.search(r'<!-- NAVIDAD:INICIO.*?<!-- NAVIDAD:FIN -->',s,re.S)
    if a: s=s[:a.start()]+bloque+s[a.end():]
    else:
        ancla="window.LUTO_HASTA = '2026-11-01';"
        i=s.index(ancla); j=s.index('</script>',i)+len('</script>')
        s=s[:j]+'\n'+bloque+s[j:]
    # el ding-dong no suena en Navidad (ya suena la música de Navidad)
    o="if(window.LUTO_ACTIVO || sessionStorage.getItem('dingDongSonado')) return; // en luto, sin sonido"
    if o in s: s=s.replace(o,"if(window.LUTO_ACTIVO || window.NAVIDAD_ACTIVO || sessionStorage.getItem('dingDongSonado')) return; // en luto, sin sonido; en Navidad, su música")
    o2="var duracionSplash = reducirMov ? 1000 : 3500;"
    if o2 in s: s=s.replace(o2,"var duracionSplash = reducirMov ? 1000 : (window.NAVIDAD_ACTIVO ? 5300 : 3500); // Navidad: deja acabar la animación")
    open(p,'w',encoding='utf-8').write(s); print('Navidad incrustada en',p)
