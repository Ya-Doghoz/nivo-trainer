const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const PORT = +process.env.PORT || 3030;
let lan = process.argv.includes('--lan') || process.env.LAN === '1';
const T = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const isLocal = a => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(a || '');
function ips() {
  const o = [];
  try { const n = os.networkInterfaces(); for (const k in n) for (const i of n[k]) if (i.family === 'IPv4' && !i.internal) o.push(i.address); } catch (e) { /* قد يفشل على أندرويد */ }
  return o;
}
const info = local => ({ on: lan, canToggle: local, port: PORT, urls: lan ? ips().map(i => `http://${i}:${PORT}`) : [] });

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let u = decodeURIComponent(url.pathname);
  if (u === '/api/lan') {
    const local = isLocal(req.socket.remoteAddress);
    let rebind = false;
    if (local && url.searchParams.has('on')) { const want = url.searchParams.get('on') === '1'; rebind = want !== lan; lan = want; }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(info(local)));
    if (rebind) res.on('finish', () => setTimeout(restart, 120));
    return;
  }
  if (u === '/') u = '/index.html';
  let base = path.join(__dirname, 'public');
  if (u.startsWith('/three/')) { base = path.join(__dirname, 'node_modules', 'three'); u = u.slice(6); }
  const p = path.normalize(path.join(base, u));
  if (!p.startsWith(base)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': T[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(d);
  });
});

function start() {
  server.listen(PORT, lan ? '0.0.0.0' : '127.0.0.1', () => {
    console.log(lan ? '🌐 الشبكة المحلية: مفعّلة' : '🔒 الشبكة المحلية: معطّلة (محلي فقط)');
    console.log('افتح: http://localhost:' + PORT);
    if (lan) ips().forEach(i => console.log('من جهاز آخر: http://' + i + ':' + PORT));
  });
}
function restart() { server.close(() => start()); if (server.closeAllConnections) server.closeAllConnections(); }
server.on('error', e => console.error('خطأ في السيرفر:', e.message));
start();
