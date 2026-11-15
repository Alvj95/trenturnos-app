# Mi agente con IA — Worker de Cloudflare (gratis)

La IA de «Mi agente» funciona con **Cloudflare Workers AI**, gratis hasta 10.000 «neurons» al día.
No necesita claves: Cloudflare conecta la IA al Worker con un *binding*. **Nunca pegues tokens ni claves en el código ni en el chat.**

## Pasos (una sola vez)

1. Entra en <https://dash.cloudflare.com>.
2. Menú izquierdo → **Workers & Pages** → **Create** → **Create Worker**.
3. Nombre: `trenturnos-ia` → **Deploy**. Esto crea el Worker de ejemplo.
4. Pulsa **Edit code**, borra todo lo que hay, pega el contenido de [`worker.js`](./worker.js) y pulsa **Deploy**.
5. Vuelve al Worker → **Settings** → **Bindings** → **Add** → **Workers AI**.
   Variable name: `AI`, exactamente así, en mayúsculas → **Save / Deploy**.
6. Abre en el navegador la dirección del Worker (`https://trenturnos-ia.<tu-cuenta>.workers.dev`).
   Debe salir `{"ok":true,"servicio":"trenturnos-ia","ia":true}`.
7. Pasa esa dirección a Claude para ponerla en la app (`AGT_IA_URL`). La dirección **no** es secreta.

## Cómo funciona

- La app calcula siempre los datos con el Horario General. La IA solo:
  1. entiende frases que las reglas no pillan, reescribiéndolas como una frase que el agente entiende;
  2. redacta la respuesta de forma natural.
- Antes de enviar nada, la app cambia los nombres por códigos (`[P1]`, `[YO]`), así que a Cloudflare no llegan nombres ni matrículas.
- Si la IA cambia algún número, no responde o se acaba el cupo, la app usa la respuesta de siempre (sin IA).
- Límites: 80 preguntas con IA al día por móvil (en la app) y 12 por minuto por conexión (en el Worker).
- En el chat, «sin IA» la apaga en ese móvil y «con IA» la vuelve a encender.

## Consumo

En **Workers & Pages → trenturnos-ia → Metrics** y en **AI → Workers AI** se ve cuánto se usa.
Si se gasta demasiado, cambia `MODELO` en `worker.js` por `MODELO_RESERVA` (`@cf/meta/llama-3.1-8b-instruct-fast`), que es más barato.
