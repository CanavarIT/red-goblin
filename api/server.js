// Red Goblin HTTP API: no dependencies, Node.js 16+
//   node server.js            (PORT=3000 by default)
//
//   GET  /speak?text=Hello&lang=en&pitch=105&speed=0.8   -> audio/wav
//   POST /speak   {"text":"Привет","lang":"ru","pitch":90} -> audio/wav
//   GET  /health  -> {"ok":true}
const http = require('http');
const Goblin = require('./goblin.js');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const MAX_CHARS = parseInt(process.env.MAX_CHARS, 10) || 500;   // text length limit
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT, 10) || 30;  // requests per IP per minute
const MAX_BODY = 20 * 1024;
const TRUST_PROXY = process.env.TRUST_PROXY === '1';            // set to 1 behind a reverse proxy / CDN

const hits = new Map();
setInterval(() => hits.clear(), 60 * 1000).unref();

function clientIp(req) {
  if (TRUST_PROXY) {
    const f = req.headers['x-forwarded-for'];
    if (f) return String(f).split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}
function limited(ip) {
  const n = (hits.get(ip) || 0) + 1;
  hits.set(ip, n);
  return n > RATE_LIMIT;
}
function send(res, code, body, type, extra) {
  res.writeHead(code, Object.assign({
    'Content-Type': type || 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(body)
  }, extra || {}));
  res.end(body);
}
const fail = (res, code, msg, extra) => send(res, code, JSON.stringify({ error: msg }), null, extra);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('Request body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function speak(res, params) {
  const text = String(params.text == null ? '' : params.text).trim();
  if (!text) return fail(res, 400, 'Missing "text"');
  if (text.length > MAX_CHARS) return fail(res, 413, 'Text too long (max ' + MAX_CHARS + ' characters)');
  const lang = String(params.lang || 'en').toLowerCase();
  if (!Goblin.languages.includes(lang)) return fail(res, 400, 'Unsupported "lang", use one of: ' + Goblin.languages.join(', '));
  let wav;
  try { wav = Buffer.from(Goblin.toWav(Goblin.synthesize(text, Object.assign({}, params, { lang })))); }
  catch (e) { return fail(res, 500, 'Synthesis failed'); }
  if (wav.length <= 44) return fail(res, 422, 'Nothing to say: no pronounceable characters for lang "' + lang + '"');
  send(res, 200, wav, 'audio/wav', { 'Cache-Control': 'public, max-age=3600', 'Content-Disposition': 'inline; filename="goblin.wav"' });
}

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'OPTIONS') return send(res, 204, '');
    if (url.pathname === '/health') return send(res, 200, '{"ok":true}');
    if (url.pathname === '/' ) {
      return send(res, 200, JSON.stringify({
        name: 'Red Goblin speech API',
        endpoints: { 'GET /speak?text=..&lang=en|ru': 'returns audio/wav', 'POST /speak': 'JSON body with the same fields' },
        parameters: Object.assign({ text: 'string, max ' + MAX_CHARS + ' chars', lang: 'en | ru' }, Goblin.ranges)
      }, null, 2));
    }
    if (url.pathname !== '/speak') return fail(res, 404, 'Not found');
    if (req.method !== 'GET' && req.method !== 'POST') return fail(res, 405, 'Use GET or POST');
    if (limited(clientIp(req))) return fail(res, 429, 'Too many requests, try again in a minute', { 'Retry-After': '60' });

    if (req.method === 'GET') return speak(res, Object.fromEntries(url.searchParams));
    let params;
    try { params = JSON.parse(await readBody(req) || '{}'); } catch (e) { return fail(res, 400, 'Invalid JSON body'); }
    if (!params || typeof params !== 'object') return fail(res, 400, 'Invalid JSON body');
    speak(res, params);
  } catch (e) {
    if (!res.headersSent) fail(res, 500, 'Internal error');
  }
}).listen(PORT, () => console.log('Red Goblin API on http://localhost:' + PORT));
