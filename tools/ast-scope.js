// مكتبة تحليل نطاقات للتقسيم الآلي (acorn المضمَّن في Node — شغّل بـ node --expose-internals)
// analyze(src) → { ast, refs, rootNames }
//   كل مرجع: { name, start, end, line, atRoot, assign, shorthand, typeofGuard, unresolved }
let acorn;
try { acorn = require('internal/deps/acorn/acorn/dist/acorn'); } catch (e) { throw new Error('acorn غير متاح — شغّل بـ: node --expose-internals ...'); }
const BROWSER = ('window self document navigator location history localStorage sessionStorage performance requestAnimationFrame cancelAnimationFrame innerWidth innerHeight outerWidth outerHeight devicePixelRatio screen console setTimeout clearTimeout setInterval clearInterval queueMicrotask fetch Request Response Headers URL URLSearchParams Blob File FileReader FormData Image Audio AudioContext webkitAudioContext AudioWorkletNode MediaRecorder MediaStream CustomEvent Event EventTarget KeyboardEvent PointerEvent MouseEvent TouchEvent WheelEvent ResizeObserver MutationObserver IntersectionObserver HTMLElement HTMLCanvasElement Element Node CanvasRenderingContext2D WebGLRenderingContext WebGL2RenderingContext XMLHttpRequest WebSocket alert confirm prompt getComputedStyle matchMedia addEventListener removeEventListener dispatchEvent atob btoa crypto TextEncoder TextDecoder isSecureContext scrollTo scrollX scrollY open close focus blur speechSynthesis SpeechSynthesisUtterance Notification DOMParser OffscreenCanvas createImageBitmap ImageData Path2D DOMMatrix AbortController AbortSignal Worker WebAssembly visualViewport DeviceOrientationEvent DeviceMotionEvent Touch top parent frames').split(/\s+/);
const NODEG = Object.getOwnPropertyNames(globalThis).filter(n => !['process', 'Buffer', 'require', 'module', 'exports', '__dirname', '__filename', 'global'].includes(n));
const GLOBALS = new Set([...NODEG, ...BROWSER, 'undefined', 'NaN', 'Infinity', 'arguments']);

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
function collect(node, out) {
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
function analyze(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const refs = [];
  const mk = (parent, names) => ({ parent, names: new Set(names) });
  const where = (sc, n) => { for (let s = sc; s; s = s.parent) if (s.names.has(n)) return s; return null; };
  const ref = (id, sc, o = {}) => {
    const w = where(sc, id.name);
    refs.push({ name: id.name, start: id.start, end: id.end, line: id.loc.start.line, atRoot: !!w && !w.parent, assign: !!o.assign, shorthand: !!o.shorthand, typeofGuard: !!o.typeofGuard, unresolved: !w && !GLOBALS.has(id.name) });
  };
  function pat(p, sc, binding) {
    if (!p) return;
    switch (p.type) {
      case 'Identifier': if (!binding) ref(p, sc, { assign: true }); break;
      case 'ObjectPattern': p.properties.forEach(q => { if (q.type === 'RestElement') pat(q.argument, sc, binding); else { if (q.computed) visit(q.key, sc); if (q.shorthand && !binding && q.value.type === 'Identifier') ref(q.value, sc, { assign: true, shorthand: true }); else if (q.shorthand && q.value.type === 'AssignmentPattern' && !binding && q.value.left.type === 'Identifier') { ref(q.value.left, sc, { assign: true, shorthand: true }); visit(q.value.right, sc); } else pat(q.value, sc, binding); } }); break;
      case 'ArrayPattern': p.elements.forEach(e => pat(e, sc, binding)); break;
      case 'AssignmentPattern': pat(p.left, sc, binding); visit(p.right, sc); break;
      case 'RestElement': pat(p.argument, sc, binding); break;
      default: visit(p, sc);
    }
  }
  function fn(node, sc) {
    const names = ['arguments']; node.params.forEach(p => patNames(p, names));
    if (node.type === 'FunctionExpression' && node.id) names.push(node.id.name);
    collect(node.body, names);
    const s2 = mk(sc, names);
    node.params.forEach(p => pat(p, s2, true)); visit(node.body, s2);
  }
  function visit(node, sc) {
    if (!node || typeof node.type !== 'string') return;
    switch (node.type) {
      case 'Identifier': ref(node, sc); return;
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': fn(node, sc); return;
      case 'ClassDeclaration': case 'ClassExpression': {
        if (node.superClass) visit(node.superClass, sc);
        const s2 = mk(sc, node.id ? [node.id.name] : []);
        node.body.body.forEach(m => {
          if (m.type === 'StaticBlock') { const nm = []; m.body.forEach(b => collect(b, nm)); const s3 = mk(s2, nm); m.body.forEach(b => visit(b, s3)); return; }
          if (m.computed) visit(m.key, s2);
          if (m.value) visit(m.value, s2);
        });
        return;
      }
      case 'VariableDeclaration': node.declarations.forEach(d => { pat(d.id, sc, true); if (d.init) visit(d.init, sc); }); return;
      case 'CatchClause': { const s2 = mk(sc, node.param ? patNames(node.param, []) : []); if (node.param) pat(node.param, s2, true); visit(node.body, s2); return; }
      case 'MemberExpression': visit(node.object, sc); if (node.computed) visit(node.property, sc); return;
      case 'Property':
        if (node.computed) visit(node.key, sc);
        if (node.shorthand && node.value.type === 'Identifier') ref(node.value, sc, { shorthand: true }); else visit(node.value, sc);
        return;
      case 'AssignmentExpression': pat(node.left, sc, false); visit(node.right, sc); return;
      case 'ForInStatement': case 'ForOfStatement': if (node.left.type === 'VariableDeclaration') visit(node.left, sc); else pat(node.left, sc, false); visit(node.right, sc); visit(node.body, sc); return;
      case 'UpdateExpression': if (node.argument.type === 'Identifier') ref(node.argument, sc, { assign: true }); else visit(node.argument, sc); return;
      case 'UnaryExpression': if (node.operator === 'typeof' && node.argument.type === 'Identifier') { ref(node.argument, sc, { typeofGuard: true }); return; } visit(node.argument, sc); return;
      case 'LabeledStatement': visit(node.body, sc); return;
      case 'BreakStatement': case 'ContinueStatement': case 'MetaProperty': case 'ImportDeclaration': case 'ExportAllDeclaration': return;
      case 'ExportNamedDeclaration': if (node.declaration) visit(node.declaration, sc); else if (!node.source) node.specifiers.forEach(s => ref(s.local, sc)); return;
      case 'ExportDefaultDeclaration': visit(node.declaration, sc); return;
    }
    for (const k of Object.keys(node)) { if (k === 'loc') continue; const v = node[k]; if (Array.isArray(v)) v.forEach(c => visit(c, sc)); else if (v && typeof v.type === 'string') visit(v, sc); }
  }
  const top = []; ast.body.forEach(n => collect(n, top));
  const root = mk(null, top);
  ast.body.forEach(n => visit(n, root));
  return { ast, refs, rootNames: root.names, collect, patNames };
}
module.exports = { analyze, collect, patNames, GLOBALS };
