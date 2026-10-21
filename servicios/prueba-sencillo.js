/* ═══ PRUEBA · Diseño sencillo ═══
   Capa que solo va en la copia de prueba (Servicios/prueba/). Cambia cómo se VE
   (letra y botones grandes, pocas cosas por pantalla); los datos y lo que hace
   cada botón son los del módulo de siempre. «Más opciones» enseña lo de antes. */
var SX={mas:false, falta:true, resMas:false, full:null, paso:1};
function sxEl(id, antesDe, html){ var e=document.getElementById(id); if(!e){ e=document.createElement('div'); e.id=id; antesDe.parentNode.insertBefore(e, antesDe); } if(html!=null) e.innerHTML=html; return e; }
function sxNombre(){ var t=(document.getElementById('saludo')||{}).textContent||''; var m=t.match(/Hola,\s*([^👋!¿]+)/); if(m) return m[1].trim();
  try{ return (parent.localStorage.getItem('svSoloNombre')||'').split(' ')[0]; }catch(e){ return ''; } }
function sxTotales(){ var t=LISTA.length, s=0, no=0; LISTA.forEach(function(r){ if(servidos[r.sid]) s++; else if(subio[r.sid]==='no') no++; }); return {t:t, s:s, no:no, falta:t-s-no}; }
function sxParadas(){ return Object.keys(ORDEN).sort(function(a,b){ return ORDEN[a]-ORDEN[b]; }); }
function sxParadaIdx(){ try{ var d=JSON.parse(localStorage.getItem(CLAVE+'_parada')||'null'); if(d&&d.c===CARGADO_EN) return d.i||0; }catch(e){} return 0; }

/* ── Inicio ── */
function sxInicio(){
  var pt=document.getElementById('p-tren'); if(!pt) return;
  pt.classList.toggle('sx-oculto', !SX.mas);
  var br=document.getElementById('bar'); if(br&&cargado) br.style.display='none'; // la barra de lectura, solo mientras se lee
  var h, nom=sxNombre();
  if(!cargado){
    h='<h1 class="sx-h1">Hola'+(nom?', '+limpio(nom):'')+' 👋</h1><div class="sx-sub">¿Qué servicio llevas hoy?</div>'+
      '<label class="sx-gbtn sx-or" onclick="precalentarOCR()"><span>📄</span><div>Subir el MOL<small>PDF, foto o captura</small></div>'+
        '<input type="file" accept="application/pdf,.pdf,image/*" style="display:none" onchange="if(this.files[0]) leerArchivo(this.files[0]); this.value=\'\'"></label>'+
      '<button class="sx-gbtn sx-gr" onclick="abrirManual()"><span>✍️</span><div>Hacerlo a mano<small>Sin MOL</small></div></button>'+
      '<div class="err" id="sx-err"></div>';
  } else {
    var T=sxTotales(), P=sxParadas(), i=Math.min(sxParadaIdx(), Math.max(P.length-1,0)), sig=P[i+1];
    var pc=T.t?Math.round(T.s/T.t*100):0, num=valor('i-num');
    h='<div class="sx-tren"><div class="n">'+limpio(tipo)+' '+limpio(num||'')+'</div><div class="r">'+limpio(valor('i-ruta'))+'</div>'+
      '<div class="big">'+T.s+' <small>de '+T.t+' servidos</small></div><div class="sx-bar"><i style="width:'+pc+'%"></i></div>'+
      (T.no?'<div class="r" style="margin-top:8px">🚫 '+T.no+' no subieron</div>':'')+'</div>'+
      '<button class="sx-gbtn sx-or" onclick="abrirMapa()"><span>💺</span><div>Ver los asientos</div></button>'+
      (sig?'<button class="sx-gbtn sx-az" onclick="sxLlegamos()"><span>🚉</span><div>Llegamos a '+limpio(estCorto(sig))+'<small>Toca al llegar a la parada</small></div></button>':
           (P.length?'<div class="sx-sub" style="text-align:center">🏁 Final del recorrido</div>':''));
  }
  h+='<button class="sx-mas" onclick="SX.mas=!SX.mas;sxInicio()">'+(SX.mas?'▲ Menos opciones':'⚙️ Más opciones')+'</button>';
  sxEl('sx-inicio', pt.firstElementChild, h);
}
function sxLlegamos(){
  var P=sxParadas(), i=sxParadaIdx()+1; if(i>=P.length) return;
  try{ localStorage.setItem(CLAVE+'_parada', JSON.stringify({c:CARGADO_EN, i:i})); }catch(e){}
  estFiltro={modo:'sube', est:P[i]}; SX.falta=false; abrirMapa();
  toast('🚉 '+estCorto(P[i])+': ahora ves quién sube aquí');
}

/* ── Mapa ── */
function sxCoche(d){ var l=COCHES, i=l.indexOf(coche); if(i<0) i=0; i=(i+d+l.length)%l.length; coche=l[i]; pintarMapa(); }
function sxSeatsPost(){
  var w=document.getElementById('wagon'); if(!w) return;
  var editando=MANUAL&&MANUAL.editando;
  w.querySelectorAll('.seat').forEach(function(b){
    var m=(b.getAttribute('onclick')||'').match(/'([^']+)'/); if(!m) return;
    var sv=(ASIENTOS[m[1]]||[]).filter(pasaEst), viv=sv.filter(function(r){ return subio[r.sid]!=='no'; }), pend=viv.filter(function(r){ return !servidos[r.sid]; });
    if(sv.length&&!editando){
      if(!viv.length) b.insertAdjacentHTML('beforeend','<span class="sx-t">NO SUBIÓ</span>');
      else if(!pend.length){ b.classList.add('sx-ok'); b.insertAdjacentHTML('beforeend','<span class="sx-t">✓ HECHO</span>'); }
    }
    if(SX.falta&&!editando&&!pend.length) b.classList.add('dim');
  });
}
function sxMapa(){
  var pm=document.getElementById('p-mapa'), co=document.getElementById('coches'); if(!pm||!co) return;
  pm.classList.toggle('sx-oculto', !SX.mas);
  var enC=LISTA.filter(function(r){ return r.coche===coche; }), falta=enC.filter(function(r){ return !servidos[r.sid]&&subio[r.sid]!=='no'; }).length;
  var editando=MANUAL&&MANUAL.editando;
  var h='<div class="sx-coche"><button onclick="sxCoche(-1)">◀</button><div class="c">Coche '+cocheVer(coche)+(esAcop(coche)?' <small style="display:inline;color:#7DD3FC">🔗</small>':'')+
    '<small>'+(editando?enC.length+' puestos':falta?'faltan '+falta+' por servir':'✓ todo servido')+'</small></div><button onclick="sxCoche(1)">▶</button></div>'+
    (editando?'<button class="sx-mini" onclick="abrirAnadirCoche()">＋ Añadir otro coche</button>':
      '<div class="sx-tog"><button class="'+(SX.falta?'on':'')+'" onclick="SX.falta=true;pintarMapa()">Lo que falta</button><button class="'+(!SX.falta?'on':'')+'" onclick="SX.falta=false;pintarMapa()">Todos</button></div>')+
    (estFiltro.est?'<div class="sx-aviso">🚉 Solo los que '+(estFiltro.modo==='sube'?'suben':'bajan')+' en <b>'+limpio(estCorto(estFiltro.est))+'</b> <button onclick="setEst(estFiltro.modo,null)">Ver todos</button></div>':'');
  sxEl('sx-mapa', co, h);
  var mb=document.getElementById('sx-mapa-mas'); if(!mb){ mb=document.createElement('button'); mb.id='sx-mapa-mas'; mb.className='sx-mas'; pm.appendChild(mb); }
  mb.textContent=SX.mas?'▲ Menos opciones':'⚙️ Más opciones (filtros, embarque, plano…)'; mb.onclick=function(){ SX.mas=!SX.mas; pintarMapa(); };
  sxSeatsPost();
}

/* ── Ficha del asiento ── */
var _fichaOrig=ficha;
ficha=function(key){
  if(SX.full===key) return _fichaOrig(key);
  fichaAbierta=key; hoja='sx-ficha';
  var p=key.split('-'), c=+p[0], sv=ASIENTOS[key]||[];
  var h='<div class="sh-handle"></div><div class="sx-hoja"><div class="sx-as">Asiento '+p[1]+' <small>· coche '+cocheVer(c)+'</small></div>';
  if(!sv.length) h+='<div class="sx-sub">Este asiento no tiene servicio.</div><button class="sx-gbtn sx-gr" onclick="abrirExtra(\''+key+'\')"><span>➕</span><div>Añadir pasajero</div></button>';
  sv.forEach(function(r){
    var m=COMIDAS[r.k], me=menuElegido(r), su=subio[r.sid], hecho=!!servidos[r.sid];
    var men=me&&!me.esp?me.t:(/SIN ELEC|SIN POSIB/i.test(sinAcento(r.menu||''))?'SIN ELECCIÓN':capital(r.menu||''));
    h+='<div class="sx-menu" style="background:'+m.c+'">'+m.e+' '+nombreTipo(r)+(men?' · '+limpio(men):'')+'<small>De '+limpio(estCorto(r.origen))+' a '+limpio(estCorto(r.destino))+(r.nombre?' · '+limpio(r.nombre):'')+'</small></div>'+
      (r.especial?'<div class="sx-alerta">⚠️ '+limpio(String(r.especial).toUpperCase())+'</div>':'')+
      '<div class="sx-dos"><button class="si'+(su==='si'?' on':'')+'" onclick="setSube('+r.sid+',\'si\');refrescar()">🧍 Ha subido'+(su==='si'?' ✓':'')+'</button>'+
      '<button class="nn'+(su==='no'?' on':'')+'" onclick="setSube('+r.sid+',\'no\');refrescar()">🚫 No ha subido'+(su==='no'?' ✓':'')+'</button></div>'+
      (su==='no'?'':'<button class="sx-ok1'+(hecho?' des':'')+'" onclick="toggleServido('+r.sid+');refrescar()">'+(hecho?'↩︎ Quitar «servido»':'✓ SERVIDO')+'</button>');
  });
  h+='<button class="sx-mas" onclick="SX.full=\''+key+'\';ficha(\''+key+'\')">✏️ Más opciones (cambiar de asiento, menú…)</button>'+
     '<button class="sx-cerrar" onclick="cerrar()">Cerrar</button></div>';
  document.getElementById('sh-asiento').innerHTML=h;
  document.getElementById('ov-asiento').classList.add('on');
};
var _cerrarOrig=cerrar; cerrar=function(){ SX.full=null; document.getElementById('sh-asiento').classList.remove('sx-setup'); _cerrarOrig(); };

/* ── Resumen ── */
var _resOrig=pintarResumen;
pintarResumen=function(){
  _resOrig();
  var pr=document.getElementById('p-resumen'), T=sxTotales();
  pr.classList.toggle('sx-oculto', !SX.resMas);
  sxEl('sx-res', pr.firstElementChild, '<h1 class="sx-h1">'+limpio(tipo)+' '+limpio(valor('i-num')||'')+'</h1><div class="sx-sub">'+limpio(valor('i-ruta'))+'</div>'+
    '<div class="sx-res v">✓ Servidos <b>'+T.s+'</b></div><div class="sx-res a">⏳ Faltan <b>'+T.falta+'</b></div><div class="sx-res r">🚫 No subieron <b>'+T.no+'</b></div>'+
    '<button class="sx-mas" onclick="SX.resMas=!SX.resMas;pintarResumen()">'+(SX.resMas?'▲ Menos detalles':'📋 Ver más detalles')+'</button>');
};

/* ── Servicio a mano: preguntas de una en una ── */
var _setupOrig=pintarSetup, _abrirManOrig=abrirManual;
abrirManual=async function(){ SX.paso=1; await _abrirManOrig(); };
pintarSetup=function(){
  _setupOrig();
  var sh=document.getElementById('sh-asiento'), body=sh.querySelector('.sh-body'); if(!body) return;
  sh.classList.add('sx-setup');
  var bloques=[], cur=null;
  Array.prototype.slice.call(body.children).forEach(function(n){ if(n.classList.contains('card-t')&&/Sale de|cuántos/i.test(n.textContent)){ cur=[]; bloques.push(cur); } if(!cur){ cur=[]; bloques.push(cur); } cur.push(n); });
  // bloques: 0 = tren · 1 = recorrido · 2 = servicios
  var paso=SX.paso;
  bloques.forEach(function(b,i){ b.forEach(function(n){ n.style.display=(i===paso-1||n.id==='m-err')?'':'none'; }); });
  var tit=['¿Qué tren es?','¿De dónde a dónde?','¿Qué servicios hay?'][paso-1];
  body.insertAdjacentHTML('afterbegin','<div class="sx-pasos">'+[1,2,3].map(function(i){ return '<i class="'+(i<=paso?'on':'')+'"></i>'; }).join('')+'</div><div class="sx-q">'+tit+'</div>');
  var pie=sh.querySelector('.mfoot');
  if(pie) pie.innerHTML='<button class="m-sec" onclick="'+(paso>1?'SX.paso--;pintarSetup()':'cerrar()')+'">'+(paso>1?'‹ Atrás':'Cancelar')+'</button>'+
    (paso<3?'<button class="m-ok" onclick="sxSiguiente()">Siguiente ›</button>':'<button class="m-ok" onclick="empezarManual()">✓ Empezar</button>');
};
function sxSiguiente(){
  var err=document.getElementById('m-err'), n=document.getElementById('m-num'); if(n) SETUP.num=(n.value||'').replace(/\D/g,'').slice(0,5);
  if(SX.paso===2&&(!SETUP.a||!SETUP.b||SETUP.a===SETUP.b)){ if(err) err.textContent='Elige de dónde sale y a dónde llega.'; return; }
  SX.paso++; pintarSetup(); var b=document.querySelector('#sh-asiento .sh-body'); if(b) b.scrollTop=0;
}

/* ── Poniendo asientos a mano: tarjeta grande ── */
var _manOrig=pintarManual;
pintarManual=function(){
  _manOrig();
  var el=document.getElementById('manual-bar'); if(!el||!MANUAL||!MANUAL.editando) return;
  var k=MANUAL.svs[MANUAL.act], t=MANUAL.tramo[k], R=MANUAL.ruta, ops=MENUS_MAN[k];
  el.innerHTML='<div class="sx-pone" style="background:'+COMIDAS[k].c+'"><div class="t">ESTÁS PONIENDO</div>'+
    (MANUAL.svs.length>1?'<div class="sx-tabs">'+MANUAL.svs.map(function(x,i){ return '<button class="'+(i===MANUAL.act?'on':'')+'" onclick="actManual('+i+')">'+COMIDAS[x].e+' '+COMIDAS[x].n+'</button>'; }).join('')+'</div>':
      '<div class="m">'+COMIDAS[k].e+' '+COMIDAS[k].n+'</div>')+
    '<div class="tr">'+limpio(estCorto(R[t[0]]))+' → '+limpio(estCorto(R[t[1]]))+' <button onclick="sxTramo()">Cambiar</button></div></div>'+
    '<div class="sx-toques">'+ops.map(function(m,i){ return '<span>'+(i?(i+1)+':':'1 toque:')+' '+m+'</span>'; }).join('')+'<span>'+(ops.length+1)+': quitar</span></div>'+
    '<button class="sx-gbtn sx-gr" style="padding:12px 16px;font-size:17px" onclick="terminarManual()"><span style="font-size:22px">✓</span><div>Listo, a servir</div></button>';
};
function sxTramo(){
  var k=MANUAL.svs[MANUAL.act], t=MANUAL.tramo[k], R=MANUAL.ruta;
  SX.tr=[t[0],t[1]]; hoja='sx-tramo'; fichaAbierta=null; sxPintaTramo();
  document.getElementById('ov-asiento').classList.add('on');
}
function sxPintaTramo(){
  var R=MANUAL.ruta, a=SX.tr[0], b=SX.tr[1];
  var h='<div class="sh-handle"></div><div class="sx-hoja"><div class="sx-as" style="font-size:24px">¿De dónde a dónde?</div><div class="sx-sub">Para los asientos que toques ahora</div>'+
    '<div class="sx-col2"><div><div class="h">🟢 Sube en</div>'+R.slice(0,-1).map(function(e,i){ return '<button class="'+(i===a?'s':'')+'" onclick="SX.tr[0]='+i+';if(SX.tr[1]<='+i+')SX.tr[1]='+(i+1)+';sxPintaTramo()">'+limpio(estCorto(e))+'</button>'; }).join('')+'</div>'+
    '<div><div class="h">🔴 Baja en</div>'+R.map(function(e,i){ return i?'<button class="'+(i===b?'b':'')+(i<=a?' x':'')+'"'+(i<=a?' disabled':' onclick="SX.tr[1]='+i+';sxPintaTramo()"')+'>'+limpio(estCorto(e))+'</button>':''; }).join('')+'</div></div>'+
    '<button class="sx-ok1" onclick="sxTramoOk()">✓ '+limpio(estCorto(R[a]))+' → '+limpio(estCorto(R[b]))+'</button><button class="sx-cerrar" onclick="cerrar()">Cancelar</button></div>';
  document.getElementById('sh-asiento').innerHTML=h;
}
function sxTramoOk(){ var k=MANUAL.svs[MANUAL.act]; MANUAL.tramo[k]=[SX.tr[0],SX.tr[1]]; MANUAL.paso=0; guardar(); cerrar(); pintarMapa(); }

/* ── Enganches ── */
var _pintarMapaOrig=pintarMapa;
pintarMapa=function(){ _pintarMapaOrig(); sxMapa(); };
var _goPOrig=goP;
goP=function(p){ _goPOrig(p); if(p==='tren') sxInicio(); };
var _montarOrig=montar; montar=function(l){ _montarOrig(l); sxInicio(); };
setTimeout(function(){ sxInicio(); if(document.getElementById('p-mapa').classList.contains('on')) pintarMapa(); }, 60);
