// يحمّل main.js ووحداته المحلية في Node بمجسّمات للمتصفح وللمكتبات الخارجية، ليكشف أخطاء وقت التحميل
// (ReferenceError/TDZ/استيراد ناقص) التي لا يراها فحص الصياغة. شغّله بـ: node --expose-internals tests/module-smoke.js public
// ما يُحمَّل «حقيقياً»: الوحدات المحلية المذكورة في REAL؛ الباقي (three وworld.js وinstrument.js...) مجسّمات.
const fs = require('fs'), path = require('path');
let acorn;
try { acorn = require('internal/deps/acorn/acorn/dist/acorn'); } catch (e) { console.log('WARN SKIP: acorn غير متاح'); process.exit(0); }
const pubDir = path.resolve(process.argv[2] || 'public');
const STUBBED = new Set(['world.js', 'instrument.js', 'targets.js', 'scopefx.js', 'extras.js', 'drone.js', 'drone-config.js', 'drone-sound.js', 'drone-worklet.js', 'logbook.js', 'help.js', 'custom.js', 'world-config.js']);
const REAL = new Set(fs.readdirSync(pubDir).filter(f => f.endsWith('.js') && !STUBBED.has(f) && f !== 'main.js'));
const U = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : U()), apply: () => U(), construct: () => U(), set: () => true, has: () => true });
const cache = new Map(), problems = [];
function exportsOf(ast) { const out = []; ast.body.forEach(n => { if (n.type === 'ExportNamedDeclaration' && n.declaration) { const d = n.declaration; if (d.type === 'VariableDeclaration') d.declarations.forEach(x => { if (x.id.type === 'Identifier') out.push(x.id.name); }); else if (d.id) out.push(d.id.name); } }); return out; }
function load(name) {
  if (cache.has(name)) return cache.get(name);
  cache.set(name, {});
  const src = fs.readFileSync(path.join(pubDir, name), 'utf8');
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module' });
  const params = [], args = [];
  ast.body.filter(n => n.type === 'ImportDeclaration').forEach(n => {
    const mod = n.source.value, local = mod.startsWith('./') ? path.basename(mod) : null, real = local && REAL.has(local) ? load(local) : null;
    n.specifiers.forEach(s => { params.push(s.local.name); args.push(s.type === 'ImportNamespaceSpecifier' ? (real || U()) : (real ? real[s.imported.name] : U())); });
  });
  let code = src; ast.body.filter(n => n.type === 'ImportDeclaration').reverse().forEach(n => { code = code.slice(0, n.start) + code.slice(n.end); });
  code = code.replace(/^export\s+(?=(const|let|function|class|async)\b)/gm, '');
  const body = `${code}\n;return { ${exportsOf(ast).join(', ')} };`;
  const store = {}, g = { devicePixelRatio: 1, innerWidth: 800, innerHeight: 600, addEventListener() {}, removeEventListener() {} };
  const ls = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem() {} };
  const doc = new Proxy({ documentElement: U(), body: U() }, { get: (t, k) => (k in t ? t[k] : U()) });
  const fn = new Function(...params, 'window', 'document', 'localStorage', 'performance', 'requestAnimationFrame', 'innerWidth', 'innerHeight', 'matchMedia', 'addEventListener', 'devicePixelRatio', body);
  let ex = {};
  try { ex = fn(...args, g, doc, ls, { now: () => 0 }, () => 0, 800, 600, () => ({ matches: false, addEventListener() {} }), () => {}, 1); }
  catch (e) { problems.push(`${name}: ${e.constructor.name}: ${e.message}`); }
  cache.set(name, ex); return ex;
}
try { load('main.js'); } catch (e) { problems.push('main.js: ' + e.message); }
REAL.forEach(f => { if (f !== 'main.js' && !cache.has(f)) problems.push(f + ': وحدة لا يستوردها أحد (لن تُحمَّل في المتصفح!)'); });
{   // كل H.اسم يُستدعى يجب أن يكون مسجَّلاً (H.اسم = دالة) بعد تحميل كل الوحدات — نفحص فقط الملفات المستوردة لـ hooks.js (help.js عنده H محلي خاص فيه)
  const Hm = cache.get('hooks.js') && cache.get('hooks.js').H, used = new Set(), regd = new Set();
  fs.readdirSync(pubDir).filter(f => f.endsWith('.js')).forEach(f => { const s = fs.readFileSync(path.join(pubDir, f), 'utf8'); if (!/from '\.\/hooks\.js'/.test(s)) return; [...s.matchAll(/(?<![\w$.])H\.(\w+)\s*(=(?!=))?/g)].forEach(m => (m[2] ? regd : used).add(m[1])); });
  used.forEach(n => { if (!regd.has(n)) problems.push('hooks: H.' + n + ' يُستدعى ولا يوجد له تسجيل H.' + n + ' = ...'); else if (Hm && typeof Hm[n] !== 'function') problems.push('hooks: H.' + n + ' لم يُسجَّل وقت التحميل (تحقّق من ترتيب الاستيراد)'); });
}
if (problems.length) problems.forEach(p => console.log('FAIL تحميل ' + p)); else console.log('PASS main.js وما يستورده محلياً يُحمَّل بلا استثناءات (مجسّمات)');
process.exit(problems.length ? 1 : 0);
