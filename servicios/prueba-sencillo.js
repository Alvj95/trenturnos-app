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
      (T.no?'<div class="r" style="margin-top:8px">🚫 '+T.no+' no subieron</div>':'')+
      (MANUAL&&MANUAL.svs.length>1?'<div class="sx-mini2">'+MANUAL.svs.map(function(k){ var l=LISTA.filter(function(r){ return r.k===k&&subio[r.sid]!=='no'; }), sv=l.filter(function(r){ return servidos[r.sid]; }).length;
        return '<div style="background:'+COMIDAS[k].c+'">'+limpio(COMIDAS[k].n)+'<b>'+sv+'/'+l.length+'</b></div>'; }).join('')+'</div>':'')+'</div>'+
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
      else if(pend.some(function(r){ return subio[r.sid]==='si'; })) b.insertAdjacentHTML('beforeend','<span class="sx-t">🧍 SUBIÓ</span>');
    }
    if(SX.falta&&!editando&&!pend.length) b.classList.add('dim');
  });
}
function sxMapa(){
  var pm=document.getElementById('p-mapa'), co=document.getElementById('coches'); if(!pm||!co) return;
  pm.classList.toggle('sx-oculto', !SX.mas);
  var enC=LISTA.filter(function(r){ return r.coche===coche; }), falta=enC.filter(function(r){ return !servidos[r.sid]&&subio[r.sid]!=='no'; }).length;
  var editando=MANUAL&&MANUAL.editando;
  var P=sxParadas(), sig=P[Math.min(sxParadaIdx(), Math.max(P.length-1,0))+1];
  var h=(editando?'':
      '<button class="sx-clip'+(modoClip?' on':'')+'" onclick="modoClip=!modoClip;pintarMapa()">🧍 Comprobar quién sube: <b>'+(modoClip?'SÍ':'NO')+'</b>'+
        '<small>'+(modoClip?'Toca un asiento: 1 vez ✓ subió · 2 veces 🚫 no subió · 3 veces sin comprobar':'Actívalo cuando te dicten los asientos: marcas de un toque')+'</small></button>'+
      '<div class="sx-tog"><button class="'+(SX.falta?'on':'')+'" onclick="SX.falta=true;pintarMapa()">Lo que falta</button><button class="'+(!SX.falta?'on':'')+'" onclick="SX.falta=false;pintarMapa()">Todos</button></div>')+
    sxMapaDos()+(estFiltro.est?'<div class="sx-aviso">🚉 Solo los que '+(estFiltro.modo==='sube'?'suben':'bajan')+' en <b>'+limpio(estCorto(estFiltro.est))+'</b> <button onclick="setEst(estFiltro.modo,null)">Ver todos</button></div>':'')+
    (!editando&&sig?'<button class="sx-gbtn sx-az sx-lleg" onclick="sxLlegamos()"><span>🚉</span><div>Llegamos a '+limpio(estCorto(sig))+'<small>Toca al llegar a la parada</small></div></button>':'');
  sxEl('sx-mapa', co.nextElementSibling, h);
  var mb=document.getElementById('sx-mapa-mas'); if(!mb){ mb=document.createElement('button'); mb.id='sx-mapa-mas'; mb.className='sx-mas'; pm.appendChild(mb); }
  mb.textContent=SX.mas?'▲ Menos opciones':'⚙️ Más opciones (filtros, embarque, plano…)'; mb.onclick=function(){ SX.mas=!SX.mas; pintarMapa(); };
  sxSeatsPost(); sxSeatsDos();
}

/* ── Ficha del asiento ── */
var _fichaOrig=ficha;
ficha=function(key){
  if(SX.full===key) return _fichaOrig(key);
  fichaAbierta=key; hoja='sx-ficha';
  var p=key.split('-'), c=+p[0], sv=ASIENTOS[key]||[];
  var h='<div class="sh-handle"></div><div class="sx-hoja"><div class="sx-as">Asiento '+p[1]+' <small>· coche '+cocheVer(c)+'</small></div>';
  if(!sv.length) h+='<div class="sx-sub">Este asiento no tiene servicio.</div><button class="sx-gbtn sx-gr" onclick="abrirExtra(\''+key+'\')"><span>➕</span><div>Añadir pasajero</div></button>';
  function bloque(r){
    var m=COMIDAS[r.k], me=menuElegido(r), su=subio[r.sid], hecho=!!servidos[r.sid];
    var men=me&&!me.esp?me.t:(/SIN ELEC|SIN POSIB/i.test(sinAcento(r.menu||''))?'SIN ELECCIÓN':capital(r.menu||''));
    return '<div class="sx-menu" style="background:'+m.c+'">'+m.e+' '+nombreTipo(r)+(men?' · '+limpio(men):'')+'<small>De '+limpio(estCorto(r.origen))+' a '+limpio(estCorto(r.destino))+(r.nombre?' · '+limpio(r.nombre):'')+'</small></div>'+
      (r.especial?'<div class="sx-alerta">⚠️ '+limpio(String(r.especial).toUpperCase())+'</div>':'')+
      '<div class="sx-dos"><button class="si'+(su==='si'?' on':'')+'" onclick="setSube('+r.sid+',\'si\');refrescar()">🧍 Ha subido'+(su==='si'?' ✓':'')+'</button>'+
      '<button class="nn'+(su==='no'?' on':'')+'" onclick="setSube('+r.sid+',\'no\');refrescar()">🚫 No ha subido'+(su==='no'?' ✓':'')+'</button></div>'+
      (su==='no'?'':'<button class="sx-ok1'+(hecho?' des':'')+'" onclick="toggleServido('+r.sid+');refrescar()">'+(hecho?'↩︎ Quitar «servido»':'✓ SERVIDO')+'</button>');
  }
  // Primero el servicio que se está dando ahora; lo demás (p. ej. el aperitivo que ya bajó en Zaragoza), abajo y plegado.
  var ahora=sxAhora(sv), antes=sv.filter(function(r){ return ahora.indexOf(r)<0; });
  ahora.forEach(function(r){ h+=bloque(r); });
  antes.forEach(function(r){
    var m=COMIDAS[r.k], fin=ahora.length&&ORDEN[r.destino]<=ORDEN[ahora[0].origen], est=subio[r.sid]==='no'?'🚫 no subió':servidos[r.sid]?'✓ servido':'sin servir';
    h+='<details class="sx-antes"'+(SX.antesAb===key?' open':'')+' ontoggle="SX.antesAb=this.open?\''+key+'\':null"><summary>'+(fin?'Servicio anterior':ahora.length&&ORDEN[r.origen]>=ORDEN[ahora[0].destino]?'Siguiente servicio':'Otro servicio')+' · '+m.e+' '+limpio(nombreTipo(r))+' · '+est+
      '<small>'+limpio(estCorto(r.origen))+' → '+limpio(estCorto(r.destino))+' · toca para verlo</small></summary>'+bloque(r)+'</details>';
  });
  h+='<button class="sx-mas" onclick="SX.full=\''+key+'\';ficha(\''+key+'\')">✏️ Más opciones (cambiar de asiento, menú…)</button>'+
     '<button class="sx-cerrar" onclick="cerrar()">Cerrar</button></div>';
  sxPon(h,'ficha-'+key);
  document.getElementById('ov-asiento').classList.add('on');
};
var _cerrarOrig=cerrar; cerrar=function(){ SX.full=null; document.getElementById('sh-asiento').classList.remove('sx-setup'); document.getElementById('sh-asiento').dataset.sx=''; _cerrarOrig(); };

// Qué filas del asiento son «de ahora»: las del servicio que se ve en el mapa; si no hay,
// las que aún no han bajado en la parada actual.
function sxAhora(sv){
  if(sv.length<2) return sv.slice();
  var l=filtro?sv.filter(function(r){ return r.k===filtro; }):[];
  if(!l.length&&cargado){ var P=sxParadas(), i=sxParadaIdx(), e=P[Math.min(i,P.length-1)];
    if(i>0&&e) l=sv.filter(function(r){ return !(ORDEN[r.destino]<=ORDEN[e]); }); }
  return l.length?l:sv.slice();
}

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
  var sh=document.getElementById('sh-asiento'), b0=sh.querySelector('.sh-body'), y=(b0&&sh.dataset.hoja==='manual'&&SX.pasoVisto===SX.paso)?b0.scrollTop:0;
  _setupOrig();
  var body=sh.querySelector('.sh-body'); if(!body) return;
  sh.classList.add('sx-setup');
  var bloques=[], cur=null;
  Array.prototype.slice.call(body.children).forEach(function(n){ if(n.classList.contains('card-t')&&/Sale de|cuántos/i.test(n.textContent)){ cur=[]; bloques.push(cur); } if(!cur){ cur=[]; bloques.push(cur); } cur.push(n); });
  // bloques: 0 = tren · 1 = recorrido · 2 = servicios. Se pregunta primero el recorrido.
  var paso=SX.paso, ver=[1,0,2][paso-1];
  bloques.forEach(function(b,i){ b.forEach(function(n){ n.style.display=(i===ver||n.id==='m-err')?'':'none'; }); });
  var tit=['¿De dónde a dónde?','¿Qué tren es?','¿Qué servicios hay?'][paso-1];
  body.insertAdjacentHTML('afterbegin','<div class="sx-pasos">'+[1,2,3].map(function(i){ return '<i class="'+(i<=paso?'on':'')+'"></i>'; }).join('')+'</div><div class="sx-q">'+tit+'</div>');
  if(paso===2) sxPasoTren(body, bloques[0]);
  if(paso===3) sxPasoServicios(body, bloques[2]);
  var pie=sh.querySelector('.mfoot');
  if(pie) pie.innerHTML='<button class="m-sec" onclick="'+(paso>1?'SX.paso--;pintarSetup()':'cerrar()')+'">'+(paso>1?'‹ Atrás':'Cancelar')+'</button>'+
    (paso<3?'<button class="m-ok" onclick="sxSiguiente()">Siguiente ›</button>':'<button class="m-ok" onclick="empezarManual()">✓ Empezar</button>');
  SX.pasoVisto=paso; if(y) body.scrollTop=y; // al tocar un botón, la hoja se queda donde estaba
};
function sxSiguiente(){
  var err=document.getElementById('m-err'), n=document.getElementById('m-num'); if(n) SETUP.num=(n.value||'').replace(/\D/g,'').slice(0,5);
  if(SX.paso===1&&(!SETUP.a||!SETUP.b||SETUP.a===SETUP.b)){ if(err) err.textContent='Elige de dónde sale y a dónde llega.'; return; }
  if(err) err.textContent='';
  SX.paso++; pintarSetup(); var b=document.querySelector('#sh-asiento .sh-body'); if(b) b.scrollTop=0;
}

/* ── Qué trenes hacen cada ruta (se irán añadiendo más) ── */
var SX_RUTAS=[{est:['Barcelona-Sants',M_ATO], series:['S-103','S-100']}];
function sxSugeridas(){ var R=rutaSetup(); for(var i=0;i<SX_RUTAS.length;i++){ var x=SX_RUTAS[i]; if(x.est.every(function(e){ return R.indexOf(e)>-1; })) return x.series; } return null; }
function sxSerie(s){ tipo='AVE'; serie=s; SX.otroTren=false; pintarSetup(); }
function sxPasoTren(body, bl){
  var sug=sxSugeridas(); if(!sug||SX.otroTren){ if(sug) bl[0].insertAdjacentHTML('beforebegin','<button class="sx-mas" style="margin:0 0 6px;text-align:left" onclick="SX.otroTren=false;pintarSetup()">‹ Volver a los trenes de esta ruta</button>'); return; }
  if(sug.indexOf(serie)<0){ tipo='AVE'; serie=sug[0]; }
  for(var i=0;i<4;i++) if(bl[i]) bl[i].style.display='none'; // tipo y serie: solo si es «otro tren»
  var R=rutaSetup();
  bl[0].insertAdjacentHTML('beforebegin','<div class="sx-sub" style="margin-bottom:8px">'+limpio(estCorto(R[0]))+' → '+limpio(estCorto(R[R.length-1]))+' · lo normal en esta ruta:</div>'+
    '<div class="sx-big2">'+sug.map(function(s){ return '<button class="'+(s===serie?'on':'')+'" onclick="sxSerie(\''+s+'\')">'+s+'<small>'+limpio(MODELO[s.replace(/\D/g,'').slice(0,3)]||'')+'</small></button>'; }).join('')+'</div>'+
    '<button class="sx-mas" onclick="SX.otroTren=true;pintarSetup()">Otro tren ›</button>');
}

/* ── Dos servicios (también dos iguales: 1.º y 2.º desayuno) y dónde cambia ── */
var SX_BASE={}; SV_MAN.forEach(function(k){ SX_BASE[k]={n:COMIDAS[k].n, c:COMIDAS[k].c};
  COMIDAS[k+'2']={n:'2.º '+COMIDAS[k].n, e:COMIDAS[k].e, c:'#9333EA'}; MENUS_MAN[k+'2']=MENUS_MAN[k]; });
var SX_C1='#0284C7', SX_C2='#9333EA';
function sxBase(k){ return String(k||'').replace(/2$/,''); }
function sxNombresSv(){
  SV_MAN.forEach(function(k){ COMIDAS[k].n=SX_BASE[k].n; COMIDAS[k].c=SX_BASE[k].c; });
  if(MANUAL&&MANUAL.svs.length>1&&MANUAL.svs[1]===MANUAL.svs[0]+'2'){ COMIDAS[MANUAL.svs[0]].n='1.º '+SX_BASE[MANUAL.svs[0]].n; COMIDAS[MANUAL.svs[0]].c=SX_C1; }
}
function sxCorteDef(R){ var mid=R.slice(1,-1); return mid.indexOf('Zaragoza-Delicias')>-1?'Zaragoza-Delicias':''; }
function sxPasoServicios(body, bl){
  var S=SETUP, R=rutaSetup(), mid=R.slice(1,-1);
  S.s2=sxBase(S.s2);
  if(S.corte===undefined) S.corte=sxCorteDef(R);
  if(S.corte&&mid.indexOf(S.corte)<0) S.corte='';
  bl.forEach(function(n){ if(n.id!=='m-err') n.style.display='none'; });
  function chips(k){ return '<div class="chips">'+SV_MAN.map(function(x){ return '<button class="chip'+(S[k]===x?' sel':'')+'" onclick="setupSet(\''+k+'\',\''+x+'\')">'+COMIDAS[x].e+' '+SX_BASE[x].n+'</button>'; }).join('')+'</div>'; }
  var dos=S.n===2, ci=dos&&S.corte?R.indexOf(S.corte):-1;
  var n1=(dos&&S.s1===S.s2?'1.º ':'')+SX_BASE[S.s1].n, n2=dos?(S.s1===S.s2?'2.º ':'')+SX_BASE[S.s2].n:'';
  var h='<div class="chips"><button class="chip'+(!dos?' sel':'')+'" onclick="setupSet(\'n\',1)">1 servicio</button><button class="chip'+(dos?' sel':'')+'" onclick="setupSet(\'n\',2)">2 servicios</button></div>'+
    '<div class="sx-svbox" style="border-color:'+SX_C1+'"><div class="t">'+(dos?'1.º SERVICIO':'SERVICIO')+'</div>'+chips('s1')+'</div>'+
    (dos?'<div class="sx-svbox" style="border-color:'+SX_C2+'"><div class="t">2.º SERVICIO <small>(puede ser el mismo)</small></div>'+chips('s2')+'</div>'+
      '<div class="sx-q" style="font-size:17px;margin-top:14px">🔀 ¿En qué parada cambia de servicio?</div><div class="chips">'+
      mid.map(function(e){ return '<button class="chip'+(S.corte===e?' sel':'')+'" onclick="setupSet(\'corte\',rutaSetup()['+R.indexOf(e)+'])">'+limpio(estCorto(e))+'</button>'; }).join('')+
      '<button class="chip'+(!S.corte?' sel':'')+'" onclick="setupSet(\'corte\',\'\')">No cambia · los dos todo el viaje</button></div>':'');
  if(dos&&ci>0){
    h+='<div class="sx-lin">'+R.map(function(e,i){ return (i?'<b style="background:'+(i<=ci?SX_C1:SX_C2)+'"></b>':'')+'<span class="'+(i===ci?'cut':'')+'"><i></i>'+sigla(e)+'</span>'; }).join('')+'</div>'+
      '<div class="sx-ley"><div style="background:'+SX_C1+'">'+COMIDAS[S.s1].e+' '+limpio(n1)+'<br>'+sigla(R[0])+' → '+sigla(R[ci])+'</div><div style="background:'+SX_C2+'">'+COMIDAS[S.s2].e+' '+limpio(n2)+'<br>'+sigla(R[ci])+' → '+sigla(R[R.length-1])+'</div></div>';
  }
  bl[0].insertAdjacentHTML('beforebegin','<div id="sx-svs">'+h+'</div>');
}
var _empOrig=empezarManual;
empezarManual=function(){
  var S=SETUP, s2=S.s2, antes=CARGADO_EN;
  if(S.n===2&&S.s1===S.s2) S.s2=S.s1+'2'; // dos iguales: el 2.º lleva su propia clave
  _empOrig(); S.s2=s2;
  if(CARGADO_EN===antes||!MANUAL) return;
  var R=MANUAL.ruta, ci=S.n===2&&S.corte?R.indexOf(S.corte):-1;
  if(ci>0&&ci<R.length-1){ MANUAL.corte=ci; MANUAL.tramo[MANUAL.svs[0]]=[0,ci]; MANUAL.tramo[MANUAL.svs[1]]=[ci,R.length-1]; }
  if(S.num){ var m=memRutas(); if(m[S.num]){ m[S.num].corte=S.corte||''; m[S.num].s2=s2; try{ localStorage.setItem('svManualRutas', JSON.stringify(m)); }catch(e){} } }
  sxNombresSv(); filtro=MANUAL.svs[0]; guardar(); pintarMapa();
};
var _setupNumOrig=setupNum;
setupNum=function(v){ _setupNumOrig(v); var m=memRutas()[SETUP.num]; if(m&&'corte' in m){ SETUP.corte=m.corte; pintarSetup(); } };
function sxRango(k){ var R=MANUAL.ruta, i=MANUAL.svs.indexOf(k), c=MANUAL.corte; if(!c||i<0) return [0,R.length-1]; return i===0?[0,c]:[c,R.length-1]; }
function sxN(k){ return MANUAL&&MANUAL.svs.length>1?(MANUAL.svs.indexOf(k)===0?'1.º':'2.º'):''; }

/* ── Poniendo asientos a mano: tarjeta grande ── */
var _manOrig=pintarManual;
pintarManual=function(){
  _manOrig();
  var el=document.getElementById('manual-bar'); if(!el||!MANUAL||!MANUAL.editando) return;
  var k=MANUAL.svs[MANUAL.act], t=MANUAL.tramo[k], R=MANUAL.ruta, ops=MENUS_MAN[k];
  el.innerHTML='<div class="sx-pone" style="background:'+COMIDAS[k].c+'"><div class="t">ESTÁS PONIENDO</div>'+
    (MANUAL.svs.length>1?'<div class="sx-tabs">'+MANUAL.svs.map(function(x,i){ return '<button class="'+(i===MANUAL.act?'on':'')+'" onclick="actManual('+i+')">'+COMIDAS[x].e+' '+COMIDAS[x].n+(MANUAL.corte?'<small>'+sigla(R[sxRango(x)[0]])+' → '+sigla(R[sxRango(x)[1]])+'</small>':'')+'</button>'; }).join('')+'</div>':
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
function sxPon(h, cual){ var el=document.getElementById('sh-asiento'), b=el.querySelector('.sx-hoja'), y=(b&&el.dataset.sx===cual)?b.scrollTop:0;
  el.innerHTML=h; el.dataset.sx=cual; el.dataset.hoja=''; var b2=el.querySelector('.sx-hoja'); if(b2&&y) b2.scrollTop=y; }
function sxPintaTramo(){
  var R=MANUAL.ruta, a=SX.tr[0], b=SX.tr[1], k=MANUAL.svs[MANUAL.act], rg=sxRango(k), lo=rg[0], hi=rg[1], i, su='', ba='';
  for(i=lo;i<hi;i++) su+='<button class="'+(i===a?'s':'')+'" onclick="SX.tr[0]='+i+';if(SX.tr[1]<='+i+')SX.tr[1]='+(i+1)+';sxPintaTramo()">'+limpio(estCorto(R[i]))+'</button>';
  for(i=lo+1;i<=hi;i++) ba+='<button class="'+(i===b?'b':'')+(i<=a?' x':'')+'"'+(i<=a?' disabled':' onclick="SX.tr[1]='+i+';sxPintaTramo()"')+'>'+limpio(estCorto(R[i]))+'</button>';
  var h='<div class="sh-handle"></div><div class="sx-hoja"><div class="sx-as" style="font-size:24px">¿De dónde a dónde?</div><div class="sx-sub">Para los asientos que toques ahora'+
    (MANUAL.corte?' · '+COMIDAS[k].e+' '+limpio(COMIDAS[k].n)+' va de '+limpio(estCorto(R[lo]))+' a '+limpio(estCorto(R[hi])):'')+'</div>'+
    '<div class="sx-col2"><div><div class="h">🟢 Sube en</div>'+su+'</div><div><div class="h">🔴 Baja en</div>'+ba+'</div></div>'+
    '<button class="sx-ok1" onclick="sxTramoOk()">✓ '+limpio(estCorto(R[a]))+' → '+limpio(estCorto(R[b]))+'</button><button class="sx-cerrar" onclick="cerrar()">Cancelar</button></div>';
  sxPon(h,'tramo');
}
function sxTramoOk(){ var k=MANUAL.svs[MANUAL.act]; MANUAL.tramo[k]=[SX.tr[0],SX.tr[1]]; MANUAL.paso=0; guardar(); cerrar(); pintarMapa(); }

/* ── Un viajero (mantener pulsado): eliges sube y baja y la app pone qué servicios le tocan ── */
var _fichaManOrig=fichaManual;
fichaManual=function(key, sid){
  if(sid!=null||!MANUAL||!MANUAL.corte) return _fichaManOrig(key, sid);
  var R=MANUAL.ruta, sv=(ASIENTOS[key]||[]).filter(function(r){ return r.manual&&MANUAL.svs.indexOf(r.k)>-1; }), menus={}, esp='';
  var o=sv.length?Math.min.apply(null, sv.map(function(r){ return R.indexOf(r.origen); })):0, d=sv.length?Math.max.apply(null, sv.map(function(r){ return R.indexOf(r.destino); })):R.length-1;
  sv.forEach(function(r){ menus[r.k]=r.menu; if(r.especial) esp=r.especial; });
  SX.pj={key:key, o:Math.max(o,0), d:d<0?R.length-1:d, menus:menus, esp:esp};
  hoja='sx-pasajero'; fichaAbierta=null; sxPintaPasajero();
  document.getElementById('ov-asiento').classList.add('on');
};
function sxLeToca(){ var P=SX.pj; return MANUAL.svs.map(function(k){ var rg=sxRango(k), a=Math.max(P.o,rg[0]), b=Math.min(P.d,rg[1]); return a<b?{k:k, o:a, d:b}:null; }).filter(Boolean); }
function sxPintaPasajero(){
  var P=SX.pj, R=MANUAL.ruta, p=partesKey(P.key), i, su='', ba='';
  for(i=0;i<R.length-1;i++) su+='<button class="'+(i===P.o?'s':'')+'" onclick="SX.pj.o='+i+';if(SX.pj.d<='+i+')SX.pj.d='+(R.length-1)+';sxPintaPasajero()">'+limpio(estCorto(R[i]))+'</button>';
  for(i=1;i<R.length;i++) ba+='<button class="'+(i===P.d?'b':'')+(i<=P.o?' x':'')+'"'+(i<=P.o?' disabled':' onclick="SX.pj.d='+i+';sxPintaPasajero()"')+'>'+limpio(estCorto(R[i]))+'</button>';
  var toca=sxLeToca();
  var h='<div class="sh-handle"></div><div class="sx-hoja"><div class="sx-as" style="font-size:24px">Asiento '+p.a+' <small>· coche '+cocheVer(p.c)+'</small></div><div class="sx-sub">¿De dónde a dónde va?</div>'+
    '<div class="sx-col2"><div><div class="h">🟢 Sube en</div>'+su+'</div><div><div class="h">🔴 Baja en</div>'+ba+'</div></div>'+
    '<div class="sx-q" style="font-size:17px">Le toca:</div>'+
    toca.map(function(t){ var ops=MENUS_MAN[t.k], m=P.menus[t.k]||ops[0];
      return '<div class="sx-letoca" style="background:'+COMIDAS[t.k].c+'">'+COMIDAS[t.k].e+' '+limpio(COMIDAS[t.k].n)+' · '+limpio(estCorto(R[t.o]))+' → '+limpio(estCorto(R[t.d]))+
        '<div class="chips">'+ops.map(function(x,j){ return '<button class="chip'+(x===m?' sel':'')+'" onclick="SX.pj.menus[\''+t.k+'\']=MENUS_MAN[\''+t.k+'\']['+j+'];sxPintaPasajero()">'+x+'</button>'; }).join('')+'</div></div>'; }).join('')+
    '<div class="card-t" style="margin-top:10px">⚠️ Dieta</div><div class="chips">'+['Sin gluten','Sin lactosa','Vegetariano','Vegano'].map(function(v){ return '<button class="chip'+(P.esp===v?' sel':'')+'" onclick="SX.pj.esp=SX.pj.esp===\''+v+'\'?\'\':\''+v+'\';sxPintaPasajero()">'+v+'</button>'; }).join('')+'</div>'+
    '<button class="sx-ok1" onclick="sxGuardaPasajero()">✓ Guardar '+p.a+'</button>'+
    '<button class="sx-mas" onclick="_fichaManOrig(\''+P.key+'\')">✏️ Más opciones (nombre, nota, otro pasajero…)</button>'+
    ((ASIENTOS[P.key]||[]).length?'<button class="sx-cerrar" style="color:#FCA5A5" onclick="sxQuitaPasajero()">🗑 Quitar este asiento</button>':'')+
    '<button class="sx-cerrar" onclick="cerrar()">Cancelar</button></div>';
  sxPon(h,'pj-'+P.key);
}
function sxGuardaPasajero(){
  var P=SX.pj, R=MANUAL.ruta, p=partesKey(P.key), toca=sxLeToca(), sv=(ASIENTOS[P.key]||[]).filter(function(r){ return r.manual; });
  MANUAL.svs.forEach(function(k){
    var r=sv.filter(function(x){ return x.k===k; })[0], t=toca.filter(function(x){ return x.k===k; })[0];
    if(t){ var m=P.menus[k]||MENUS_MAN[k][0];
      if(!r){ r=filaManual(p.c,p.f,p.l,k,R[t.o],R[t.d],m); LISTA.push(r); }
      r.origen=R[t.o]; r.destino=R[t.d]; r.menu=m; r.especial=limpio(P.esp); }
    else if(r) quitarDeLista(r.sid);
  });
  reindexar(); guardar(); estadoManual(); cerrar(); pintarMapa();
}
function sxQuitaPasajero(){ (ASIENTOS[SX.pj.key]||[]).slice().forEach(function(r){ if(r.manual) quitarDeLista(r.sid); }); reindexar(); guardar(); estadoManual(); cerrar(); pintarMapa(); }

/* ── Sirviendo con dos servicios: primero el 1.º; al llegar a la parada del cambio, el 2.º ── */
function sxDosSv(){ return MANUAL&&MANUAL.svs.length>1&&MANUAL.corte; }
function sxSvAhora(){ var P=sxParadas(), e=P[Math.min(sxParadaIdx(),P.length-1)], ri=MANUAL.ruta.indexOf(e); return MANUAL.svs[ri>=MANUAL.corte?1:0]; }
var _termOrig=terminarManual;
terminarManual=function(){ _termOrig(); if(sxDosSv()){ filtro=sxSvAhora(); pintarMapa(); } };
function sxFaltan(k){ return LISTA.filter(function(r){ return r.k===k&&!servidos[r.sid]&&subio[r.sid]!=='no'; }); }
var _llegOrig=sxLlegamos;
sxLlegamos=function(){
  var P=sxParadas(), i=sxParadaIdx()+1;
  if(!sxDosSv()||i>=P.length||MANUAL.ruta.indexOf(P[i])!==MANUAL.corte) return _llegOrig();
  try{ localStorage.setItem(CLAVE+'_parada', JSON.stringify({c:CARGADO_EN, i:i})); }catch(e){}
  var k1=MANUAL.svs[0], k2=MANUAL.svs[1], f=sxFaltan(k1), sube=LISTA.filter(function(r){ return r.k===k2&&r.origen===P[i]; }).length;
  hoja='sx-cambio'; fichaAbierta=null;
  sxPon('<div class="sh-handle"></div><div class="sx-hoja"><div class="sx-as" style="font-size:24px">🚉 Llegamos a '+limpio(estCorto(P[i]))+'</div>'+
    '<div class="sx-aviso2">Termina el <b>'+limpio(COMIDAS[k1].n)+'</b>.'+(f.length?' Quedan <b>'+f.length+' sin servir</b>: '+f.slice(0,6).map(function(r){ return r.coche+'-'+pad(r.fila)+r.letra; }).join(', ')+(f.length>6?'…':'')+'.':' ¡Todo servido! 👏')+
      '<br>Empieza el <b>'+limpio(COMIDAS[k2].n)+'</b>'+(sube?': suben '+sube+' viajeros.':'.')+'</div>'+
    '<button class="sx-gbtn" style="background:'+SX_C2+';color:#fff" onclick="sxVerSv(\''+k2+'\')"><span>'+COMIDAS[k2].e+'</span><div>Empezar '+limpio(COMIDAS[k2].n)+'<small>El mapa enseña lo del 2.º</small></div></button>'+
    (f.length?'<button class="sx-cerrar" onclick="sxVerSv(\''+k1+'\')">↩️ Antes, ver los '+f.length+' que faltan del 1.º</button>':'')+'</div>','cambio');
  document.getElementById('ov-asiento').classList.add('on');
};
function sxVerSv(k){ SX.falta=true; estFiltro={modo:'sube', est:null}; cerrar(); abrirMapa(); filtro=k; pintarMapa(); }
// «Ver los asientos»: con dos servicios, el mapa abre en el que toca según la parada.
var _abrirMapaOrig=abrirMapa;
abrirMapa=function(){ _abrirMapaOrig(); if(sxDosSv()&&!MANUAL.editando){ filtro=sxSvAhora(); pintarMapa(); } };
function sxMapaDos(){
  if(!sxDosSv()||MANUAL.editando) return '';
  return '<div class="sx-tog">'+MANUAL.svs.map(function(k,i){ var on=filtro===k;
    return '<button class="'+(on?'on':'')+'" style="'+(on?'background:'+COMIDAS[k].c+';border-color:'+COMIDAS[k].c+';color:#fff':'')+'" onclick="filtro=\''+k+'\';pintarMapa()">'+COMIDAS[k].e+' '+limpio(COMIDAS[k].n)+'<small style="display:block;font-size:11px">'+sxFaltan(k).length+' por servir</small></button>'; }).join('')+'</div>';
}
function sxSeatsDos(){
  if(!MANUAL||MANUAL.svs.length<2) return;
  var w=document.getElementById('wagon'); if(!w) return;
  w.querySelectorAll('.seat').forEach(function(b){
    var m=(b.getAttribute('onclick')||'').match(/'([^']+)'/); if(!m) return;
    var ks={}; (ASIENTOS[m[1]]||[]).forEach(function(r){ var i=MANUAL.svs.indexOf(r.k); if(i>-1) ks[i]=r; });
    var tr=b.querySelector('.tr');
    if(ks[0]&&ks[1]){
      if(!/\b(dim|done|nosube|sx-ok)\b/.test(b.className)) b.style.background='linear-gradient(90deg,'+COMIDAS[MANUAL.svs[0]].c+' 50%,'+COMIDAS[MANUAL.svs[1]].c+' 50%)';
      if(tr) tr.textContent='1.º + 2.º';
    } else if(tr&&(ks[0]||ks[1])){ var r=ks[0]||ks[1]; tr.textContent=sxN(r.k)+' '+sigla(r.origen)+'›'+sigla(r.destino); }
  });
}

/* ── Comprobar quién sube: un toque por asiento, sin abrir nada ── */
var _tocarOrig=tocarAsiento;
tocarAsiento=function(key){
  if(!modoClip||MOVIENDO!==null||(MANUAL&&MANUAL.editando)) return _tocarOrig(key);
  var todas=(ASIENTOS[key]||[]).filter(pasaEst), sv=filtro?todas.filter(function(r){ return r.k===filtro; }):todas;
  if(!sv.length) sv=todas;
  if(sv.length!==1) return _tocarOrig(key);
  var r=sv[0], grupo=[r];
  // la misma persona en el otro servicio (sigue en el mismo asiento justo donde cambia)
  todas.forEach(function(x){ if(x!==r&&x.manual&&(x.origen===r.destino||x.destino===r.origen)) grupo.push(x); });
  var s0=subio[r.sid], v=!s0?'si':s0==='si'?'no':null;
  grupo.forEach(function(x){ if(v){ subio[x.sid]=v; if(v==='no') delete servidos[x.sid]; } else delete subio[x.sid]; anotar(x.sid); });
  toast('Asiento '+key.split('-')[1]+': '+(v==='si'?'🧍 subió':v==='no'?'🚫 no subió':'❔ sin comprobar'));
  guardar(); pintarMapa();
};

/* ── Enganches ── */
var _pintarMapaOrig=pintarMapa;
pintarMapa=function(){ _pintarMapaOrig(); sxMapa(); };
var _goPOrig=goP;
goP=function(p){ _goPOrig(p); if(p==='tren') sxInicio(); };
var _montarOrig=montar; montar=function(l){ sxNombresSv(); _montarOrig(l); sxInicio(); };
setTimeout(function(){ sxInicio(); if(document.getElementById('p-mapa').classList.contains('on')) pintarMapa(); }, 60);
