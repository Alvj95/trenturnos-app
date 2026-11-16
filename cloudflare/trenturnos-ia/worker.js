/**
 * TrenTurnos · «Mi agente» con IA (Cloudflare Workers AI, plan gratis).
 *
 * Qué hace: recibe desde la app una pregunta YA SIN NOMBRES (la app cambia los
 * nombres por códigos como [P1] antes de enviarla) y devuelve:
 *   · modo "entender": la pregunta reescrita como una frase que el agente de la
 *     app entiende, o una respuesta de charla si no va de turnos.
 *   · modo "redactar": la respuesta que calculó la app, contada de forma natural.
 * Los datos (turnos, horas, quién libra, si un cambio encaja) los calcula SIEMPRE
 * la app con el Horario General: la IA no inventa ni cambia números.
 *
 * Instalación: ver LEEME.md (se pega en el panel de Cloudflare y se añade el
 * binding «Workers AI» con el nombre AI). No necesita claves.
 */
const MODELO = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';   // buen español
const MODELO_RESERVA = '@cf/meta/llama-3.1-8b-instruct-fast'; // más barato, si el otro falla
const MAX_POR_MINUTO = 12;  // por IP (mejor esfuerzo: cada copia del Worker cuenta aparte)
const MAX_TEXTO = 2500;     // caracteres máximos que se aceptan por campo

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-TrenTurnos',
  'Access-Control-Max-Age': '86400'
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' } });

const SISTEMA_COMUN = `Eres «Mi agente», el asistente de la app TrenTurnos para tripulantes de tren (Serveo / Renfe larga distancia) en España.
Hablas en español de España, tuteas, eres cercano, simpático y sincero, y vas al grano.
Los nombres de compañeros llegan como códigos entre corchetes ([P1], [P2], [YO]…): cópialos EXACTAMENTE igual, nunca inventes nombres.
Vocabulario: pernocta = dormir fuera y volver al día siguiente (se cambia entera, son dos días); ida y vuelta = volver el mismo día; DH = viajar sin trabajar; reserva = estar disponible; DO/DOP/LD = días libres; toma = hora a la que empiezas; deje = 20 min en base y 15 fuera.`;

const SISTEMA_ENTENDER = `${SISTEMA_COMUN}
Tu tarea: convertir lo que escribe el usuario en UNA frase sencilla que el agente de la app entiende, usando SOLO estos modelos de frase (cambia los datos entre < >):
- «¿Qué tengo el <día>?» · «¿A qué hora llego el <día>?» · «¿Cuándo libro este mes?» · «Mis vacaciones»
- «¿Con quién voy el <día>?» · «¿Quién va en el <tren> el <día>?» · «¿Quién va a <ciudad> el <día>?»
- «¿Quién libra el <día>?» · «¿Quién libra el finde?» · «¿Quién está de baja?» · «¿Quién está de reserva el <día>?» · «¿Quién trabaja el <día>?»
- «¿Qué turnos hay el <día>?» · «¿Qué turnos llegan antes de las <hora> el <día>?» · «¿Qué turnos salen después de las <hora> el <día>?»
- «¿Quién tiene vacaciones la segunda quincena?» · «¿Quién tiene vacaciones la semana que viene?»
- «Quiero un turno el <día> que llegue antes de las <hora>» · «Quiero un turno de mañana el <día>» · «Quiero un turno de tarde el <día>» · «Quiero un turno el <día> sin pernocta» · «Quiero una pernocta en <ciudad> el <día>»
- «Necesito librar el <día>» · «Necesito librar el <día>, puedo dar el <día2>» · «Quiero librar el finde»
- «Cambio con <[P1]> el <día>» · «Cambio con <[P1]> y <[P2]> el <día>» · «Prepara el correo» · «Mis cambios»
- «¿Qué es DH?» · «¿Qué es una pernocta?» · «Más opciones» · «No me sirve ninguno» · «¿Por qué a <[P1]> le sale ojo?»
Días: usa el número de día del mes (hoy y mañana te los da el mensaje). Si dice «mañana» como día, pon el número de mañana; «de mañana» es la franja (antes de las 10).
Responde SOLO con JSON válido, sin texto alrededor:
{"tipo":"consulta","frase":"<la frase>"}  si se puede expresar con un modelo,
{"tipo":"charla","respuesta":"<respuesta corta y cercana, máx. 50 palabras>"}  si es charla, una broma o algo que no va de turnos (en ese caso no inventes datos de turnos).`;

const SISTEMA_REDACTAR = `${SISTEMA_COMUN}
Tu tarea: el usuario hizo una pregunta y la app ya calculó la respuesta exacta (te la paso como «RESPUESTA DE LA APP»). Reescríbela de forma natural y cercana, como lo diría un compañero majo.
Reglas estrictas:
- No cambies, quites ni inventes NINGÚN dato: días, horas, números de tren, ciudades, cantidades, ni los símbolos ✅ ⚠️ ❌.
- Copia los códigos [P1], [YO]… tal cual.
- Si la respuesta de la app dice que debajo hay tarjetas u opciones, no las repitas: di algo como «te las dejo aquí abajo».
- Si el usuario pide algo personal en el tono (una broma, ánimo, algo para el mensaje), puedes acompañarlo, sin tocar los datos.
- Máximo 80 palabras. Texto plano, sin markdown, puedes usar 1 o 2 emojis.`;

const vistos = new Map(); // ip -> [marcas de tiempo]
function demasiadas(ip) {
  const ahora = Date.now(), l = (vistos.get(ip) || []).filter(t => ahora - t < 60000);
  l.push(ahora); vistos.set(ip, l);
  if (vistos.size > 5000) vistos.clear();
  return l.length > MAX_POR_MINUTO;
}
const corta = (s) => String(s || '').slice(0, MAX_TEXTO);

async function preguntar(env, sistema, usuario, maxTokens) {
  const mensajes = [{ role: 'system', content: sistema }, { role: 'user', content: usuario }];
  for (const modelo of [MODELO, MODELO_RESERVA]) {
    try {
      const r = await env.AI.run(modelo, { messages: mensajes, max_tokens: maxTokens, temperature: 0.4 });
      const texto = (r && (r.response ?? r.result?.response)) || '';
      if (typeof texto === 'string' && texto.trim()) return { texto: texto.trim(), modelo };
      if (texto && typeof texto === 'object') return { texto: JSON.stringify(texto), modelo };
    } catch (e) { /* se prueba el de reserva */ }
  }
  return null;
}
function sacarJSON(t) {
  try { return JSON.parse(t); } catch (e) {}
  const m = String(t).match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/') return json({ ok: true, servicio: 'trenturnos-ia', ia: !!env.AI });
    if (request.method !== 'POST' || url.pathname !== '/responder') return json({ error: 'no encontrado' }, 404);
    if (request.headers.get('X-TrenTurnos') !== '1') return json({ error: 'solo TrenTurnos' }, 403);
    if (!env.AI) return json({ error: 'falta el binding Workers AI (nombre AI)' }, 500);
    const ip = request.headers.get('CF-Connecting-IP') || 'x';
    if (demasiadas(ip)) return json({ error: 'demasiadas preguntas, espera un minuto' }, 429);

    let b; try { b = await request.json(); } catch (e) { return json({ error: 'json no válido' }, 400); }
    const modo = b && b.modo, pregunta = corta(b.pregunta), contexto = corta(b.contexto), historial = corta(b.historial);
    if (!pregunta) return json({ error: 'falta la pregunta' }, 400);

    if (modo === 'entender') {
      const u = `${contexto}\n${historial ? 'Conversación reciente:\n' + historial + '\n' : ''}Mensaje del usuario: «${pregunta}»`;
      const r = await preguntar(env, SISTEMA_ENTENDER, u, 200);
      if (!r) return json({ error: 'la IA no respondió' }, 502);
      const j = sacarJSON(r.texto);
      if (!j || (j.tipo !== 'consulta' && j.tipo !== 'charla')) return json({ error: 'respuesta no válida' }, 502);
      return json({ tipo: j.tipo, frase: corta(j.frase), respuesta: corta(j.respuesta), modelo: r.modelo });
    }
    if (modo === 'redactar') {
      const respuestaApp = corta(b.respuestaApp);
      if (!respuestaApp) return json({ error: 'falta la respuesta de la app' }, 400);
      const u = `${contexto}\nPregunta del usuario: «${pregunta}»\nRESPUESTA DE LA APP:\n${respuestaApp}`;
      const r = await preguntar(env, SISTEMA_REDACTAR, u, 260);
      if (!r) return json({ error: 'la IA no respondió' }, 502);
      return json({ texto: corta(r.texto), modelo: r.modelo });
    }
    return json({ error: 'modo desconocido' }, 400);
  }
};
