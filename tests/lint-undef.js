// كاشف الأسماء غير المعرّفة (no-undef) بلا أي تنزيل: يستعمل acorn المضمَّن في Node.
// يُشغَّل هكذا:  node --expose-internals tests/lint-undef.js public/a.js public/b.js ...
// يطبع: PASS اسم_الملف | FAIL ملف:سطر الاسم | WARN ...
let acorn;
try { acorn = require('internal/deps/acorn/acorn/dist/acorn'); } catch (e) { console.log('WARN SKIP: acorn غير متاح في هذا الإصدار من Node (شغّل بـ --expose-internals)'); process.exit(0); }
const fs = require('fs'), path = require('path');
const BROWSER = ('window self document navigator location history localStorage sessionStorage performance requestAnimationFrame cancelAnimationFrame innerWidth innerHeight outerWidth outerHeight devicePixelRatio screen console setTimeout clearTimeout setInterval clearInterval queueMicrotask fetch Request Response Headers URL URLSearchParams Blob File FileReader FormData Image Audio AudioContext webkitAudioContext AudioWorkletNode MediaRecorder MediaStream CustomEvent Event EventTarget KeyboardEvent PointerEvent MouseEvent TouchEvent WheelEvent ResizeObserver MutationObserver IntersectionObserver HTMLElement HTMLCanvasElement Element Node CanvasRenderingContext2D WebGLRenderingContext WebGL2RenderingContext XMLHttpRequest WebSocket alert confirm prompt getComputedStyle matchMedia addEventListener removeEventListener dispatchEvent atob btoa crypto TextEncoder TextDecoder isSecureContext scrollTo scrollX scrollY open close focus blur speechSynthesis SpeechSynthesisUtterance Notification DOMParser OffscreenCanvas createImageBitmap ImageData Path2D DOMMatrix AbortController AbortSignal Worker WebAssembly visualViewport DeviceOrientationEvent DeviceMotionEvent Touch screen top parent frames').split(/\s+/);
const WORKLET = 'AudioWorkletProcessor registerProcessor sampleRate currentTime currentFrame'.split(' ');
const NODEG = Object.getOwnPropertyNames(globalThis).filter(n => !['process', 'Buffer', 'require', 'module', 'exports', '__dirname', '__filename', 'global'].includes(n));
const baseGlobals = new Set([...NODEG, ...BROWSER, 'undefined', 'NaN', 'Infinity', 'arguments']);
let allow = {};
const allowFile = path.join(__dirname, 'lint-allow.txt');
if (fs.existsSync(allowFile)) fs.readFileSync(allowFile, 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#')).forEach(l => { const [f, n] = l.includes(':') ? l.split(':') : ['*', l]; (allow[f] = allow[f] || new Set()).add(n); });

function patNames(p, out) {
  if (!p) return out;
  switch (p.type) {
    case 'Identifier': out.push(p.name); break;
    case 'ObjectPattern': p.properties.forEach(q => patNames(q.type === 'RestElement' ? q.argument : q.value, out)); break;
    case 'ArrayPattern': p.elements.forEach(e => patNames(e, out)); break;
    case 'AssignmentPattern': patNames(p.left, out); break;
    case 'RestElement': patNames(p.argument, out); break;
  }
  return out;
}
function collect(node, out) {                       // تصريحات تُرفع إلى نطاق الدالة/البرنامج
  if (!node || typeof node.type !== 'string') return;
  switch (node.type) {
    case 'VariableDeclaration': node.declarations.forEach(d => patNames(d.id, out)); break;
    case 'FunctionDeclaration': if (node.id) out.push(node.id.name); return;
    case 'ClassDeclaration': if (node.id) out.push(node.id.name); return;
    case 'FunctionExpression': case 'ArrowFunctionExpression': case 'ClassExpression': return;
    case 'ImportDeclaration': node.specifiers.forEach(s => out.push(s.local.name)); return;
  }
  for (const k of Object.keys(node)) { const v = node[k]; if (Array.isArray(v)) v.forEach(c => collect(c, out)); else if (v && typeof v.type === 'string') collect(v, out); }
}
function lintFile(file, MAP) {
  const src = fs.readFileSync(file, 'utf8'), name = path.basename(file), esm = /^\s*(import|export)\s/m.test(src);
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: esm ? 'module' : 'script', locations: true, allowHashBang: true });
  const bad = [], seen = new Set();
  const ok = (n) => (allow['*'] && allow['*'].has(n)) || (allow[name] && allow[name].has(n)) || (name === 'drone-worklet.js' && WORKLET.includes(n));
  const mkScope = (parent, names) => ({ parent, names: new Set(names) });
  const has = (sc, n) => { for (let s = sc; s; s = s.parent) if (s.names.has(n)) return true; return baseGlobals.has(n) || ok(n); };
  const atRoot = (sc, n) => { let last = null; for (let s = sc; s; s = s.parent) { if (s.names.has(n)) { last = s; break; } } return last && !last.parent; };
  const ref = (id, sc, assign) => { if (MAP && atRoot(sc, id.name)) MAP.hit(id.name, assign); if (!has(sc, id.name)) { const key = id.name + '@' + id.loc.start.line; if (!seen.has(key)) { seen.add(key); bad.push(`${name}:${id.loc.start.line} ${id.name}`); } } };
  function pat(p, sc, binding) {                    // أنماط: تصريح أو إسناد
    if (!p) return;
    switch (p.type) {
      case 'Identifier': if (!binding) ref(p, sc, true); break;
      case 'ObjectPattern': p.properties.forEach(q => { if (q.type === 'RestElement') pat(q.argument, sc, binding); else { if (q.computed) visit(q.key, sc); pat(q.value, sc, binding); } }); break;
      case 'ArrayPattern': p.elements.forEach(e => pat(e, sc, binding)); break;
      case 'AssignmentPattern': pat(p.left, sc, binding); visit(p.right, sc); break;
      case 'RestElement': pat(p.argument, sc, binding); break;
      default: visit(p, sc);                         // MemberExpression كهدف إسناد
    }
  }
  function fn(node, sc) {
    const names = ['arguments'];
    node.params.forEach(p => patNames(p, names));
    if (node.type === 'FunctionExpression' && node.id) names.push(node.id.name);
    collect(node.body, names);
    const s2 = mkScope(sc, names);
    node.params.forEach(p => pat(p, s2, true));
    visit(node.body, s2);
  }
  function visit(node, sc) {
    if (!node || typeof node.type !== 'string') return;
    switch (node.type) {
      case 'Identifier': ref(node, sc); return;
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': fn(node, sc); return;
      case 'ClassDeclaration': case 'ClassExpression': {
        if (node.superClass) visit(node.superClass, sc);
        const s2 = mkScope(sc, node.id ? [node.id.name] : []);
        node.body.body.forEach(m => {
          if (m.type === 'StaticBlock') { const nm = []; m.body.forEach(b => collect(b, nm)); const s3 = mkScope(s2, nm); m.body.forEach(b => visit(b, s3)); return; }
          if (m.computed) visit(m.key, s2);
          if (m.value) visit(m.value, s2);
        });
        return;
      }
      case 'VariableDeclaration': node.declarations.forEach(d => { pat(d.id, sc, true); if (d.init) visit(d.init, sc); }); return;
      case 'CatchClause': { const s2 = mkScope(sc, node.param ? patNames(node.param, []) : []); if (node.param) pat(node.param, s2, true); visit(node.body, s2); return; }
      case 'MemberExpression': visit(node.object, sc); if (node.computed) visit(node.property, sc); return;
      case 'Property': if (node.computed) visit(node.key, sc); visit(node.value, sc); return;
      case 'AssignmentExpression': pat(node.left, sc, false); visit(node.right, sc); return;
      case 'ForInStatement': case 'ForOfStatement': if (node.left.type === 'VariableDeclaration') visit(node.left, sc); else pat(node.left, sc, false); visit(node.right, sc); visit(node.body, sc); return;
      case 'UpdateExpression': if (node.argument.type === 'Identifier') ref(node.argument, sc, true); else visit(node.argument, sc); return;
      case 'UnaryExpression': if (node.operator === 'typeof' && node.argument.type === 'Identifier') return; visit(node.argument, sc); return;
      case 'LabeledStatement': visit(node.body, sc); return;
      case 'BreakStatement': case 'ContinueStatement': case 'MetaProperty': case 'ImportDeclaration': case 'ExportAllDeclaration': return;
      case 'ExportNamedDeclaration': if (node.declaration) visit(node.declaration, sc); else if (!node.source) node.specifiers.forEach(s => ref(s.local, sc)); return;
      case 'ExportDefaultDeclaration': visit(node.declaration, sc); return;
    }
    for (const k of Object.keys(node)) { if (k === 'loc') continue; const v = node[k]; if (Array.isArray(v)) v.forEach(c => visit(c, sc)); else if (v && typeof v.type === 'string') visit(v, sc); }
  }
  const top = []; ast.body.forEach(n => collect(n, top));
  const root = mkScope(null, top);
  ast.body.forEach((n, i) => { if (MAP) MAP.cur(i); visit(n, root); });
  return bad;
}
// ---- وضع --map: خريطة أقسام ملف ضخم وتبعياتها (تُستعمل لتقسيم main.js) ----
function sectionMap(file) {
  const src = fs.readFileSync(file, 'utf8'), lines = src.split('\n');
  const heads = []; lines.forEach((l, i) => { const m = /^\/\/ (?:=+|-+)\s*(.+?)\s*(?:=+|-+)\s*$/.exec(l); if (m) heads.push({ line: i + 1, title: m[1] }); });
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const secOf = n => { let t = '(مقدمة)'; heads.forEach(h => { if (h.line <= n.loc.start.line) t = h.title; }); return t; };
  const secs = new Map(), declSec = new Map(), letNames = new Set(), stmtSec = [];
  const sec = t => { if (!secs.has(t)) secs.set(t, { title: t, lines: 0, decl: [], uses: new Map(), asg: new Map() }); return secs.get(t); };
  ast.body.forEach(n => {
    const t = secOf(n); stmtSec.push(t); const S = sec(t); S.lines += n.loc.end.line - n.loc.start.line + 1;
    const names = []; collect(n, names); names.forEach(x => { declSec.set(x, t); S.decl.push(x); });
    if (n.type === 'VariableDeclaration' && n.kind !== 'const') names.forEach(x => letNames.add(x));
  });
  let cur = 0;
  const MAP = { cur: i => { cur = i; }, hit: (name, assign) => {
    const from = stmtSec[cur], to = declSec.get(name); if (!to) return;
    if (assign && letNames.has(name) && to !== from) { const a = sec(to).asg; (a.get(name) || a.set(name, new Set()).get(name)).add(from); }
    if (from === to) return;
    const u = sec(from).uses; (u.get(to) || u.set(to, new Set()).get(to)).add(name);
  } };
  lintFile(file, MAP);
  return [...secs.values()];
}
if (process.argv[2] === '--map') {
  const secs = sectionMap(process.argv[3]);
  console.log('# خريطة أقسام ' + path.basename(process.argv[3]) + '\n');
  secs.forEach(S => {
    console.log(`## ${S.title} — ${S.lines} سطراً، ${S.decl.length} تصريحاً`);
    const dep = [...S.uses.entries()].map(([t, ns]) => `${t} (${[...ns].slice(0, 6).join('، ')}${ns.size > 6 ? '…' + ns.size : ''})`);
    console.log('  يعتمد على: ' + (dep.length ? dep.join(' | ') : '— لا شيء (ورقة)'));
    const hz = [...S.asg.entries()].map(([n, fs_]) => `${n} ← تُسنَد من: ${[...fs_].join('، ')}`);
    if (hz.length) console.log('  ⚠ متغيّرات قابلة للتغيير تُعدَّل من أقسام أخرى: ' + hz.join(' | '));
  });
  process.exit(0);
}
let any = false;
for (const f of process.argv.slice(2)) {
  try { const bad = lintFile(f); if (bad.length) { any = true; bad.forEach(b => console.log('FAIL اسم غير معرّف: ' + b)); } else console.log('PASS ' + path.basename(f)); }
  catch (e) { any = true; console.log(`FAIL تعذّر تحليل ${path.basename(f)}: ${e.message}`); }
}
process.exit(any ? 1 : 0);
