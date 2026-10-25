// B-003 خطوة 1+2: يُخرج الأدوات المشتركة إلى public/util.js والحالة المشتركة إلى public/state.js
// ويعيد كتابة main.js (تحليل AST) ثم يشغّل الاختبارات ويستعيد كل شيء إن فشلت.
// الاستعمال: node --expose-internals tools/b003-step12.js [--dry]
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { analyze } = require('./ast-scope.js');
const root = path.join(__dirname, '..'), pub = path.join(root, 'public'), dry = process.argv.includes('--dry');
const mainF = path.join(pub, 'main.js'), utilF = path.join(pub, 'util.js'), stateF = path.join(pub, 'state.js');
if (fs.existsSync(utilF) || fs.existsSync(stateF)) { console.log('✓ util.js/state.js موجودان — الخطوة مطبّقة مسبقاً'); process.exit(0); }
const src = fs.readFileSync(mainF, 'utf8');
const UTIL_NAMES = ['$', '$$', 'clamp', 'V3', 'DEG', 'TAU', 'wrapPi', 'cap', 'numOrNull', 'f3', 'dms', 'showErr', 'tT', 'toast', 'openTab', 'cache', 'setTxt', 'setCl'];
const UTIL_PRIVATE = new Set(['tT', 'cache']);
const ST_NAMES = ['scopeFull', 'focV', 'eyeV', 'blurFrac', 'softFrac', 'fine', 'lastMeas', 'seed', 'job', 'rows', 'rowsT', 'mapImg', 'slow', 'slowT', 'slowV', 'slowVT', 'S', 'stepKey'];
const STATE_DECL = ['raw', 'CFG', 'saveCfg'];
const fail = m => { console.log('✗ ' + m); process.exit(1); };

const { ast, refs, collect } = analyze(src);
const text = n => src.slice(n.start, n.end);
const edits = [];
const lineStart = i => src.lastIndexOf('\n', i - 1) + 1;
const lineEnd = i => { const j = src.indexOf('\n', i); return j < 0 ? src.length : j + 1; };
const dropRange = n => ({ start: /^[ \t]*$/.test(src.slice(lineStart(n.start), n.start)) ? lineStart(n.start) : n.start, end: lineEnd(n.end) });

const utilParts = [], stateParts = [], stInit = [], utilExports = [];
const bindIn = (d, set) => { const nm = []; collect({ type: 'VariableDeclaration', declarations: [d] }, nm); return nm.length && nm.every(x => set.includes(x)); };
ast.body.forEach(n => {
  if (n.type === 'ImportDeclaration') return;
  // --- دوال مساعدة ---
  if (n.type === 'FunctionDeclaration' && UTIL_NAMES.includes(n.id.name)) {
    utilParts.push((UTIL_PRIVATE.has(n.id.name) ? '' : 'export ') + text(n)); if (!UTIL_PRIVATE.has(n.id.name)) utilExports.push(n.id.name);
    edits.push({ ...dropRange(n), text: '' }); return;
  }
  if (n.type === 'ExpressionStatement' && /^addEventListener\('(error|unhandledrejection)'/.test(text(n))) { utilParts.push(text(n)); edits.push({ ...dropRange(n), text: '' }); return; }
  if (n.type === 'ExpressionStatement' && /^document\.documentElement\.style\.setProperty\('--k'/.test(text(n))) { stateParts.push(text(n)); edits.push({ ...dropRange(n), text: '' }); return; }
  if (n.type === 'IfStatement' && /\braw\.start\b/.test(text(n))) { stateParts.push(text(n)); edits.push({ ...dropRange(n), text: '' }); return; }
  if (n.type === 'VariableDeclaration') {
    const toUtil = [], toState = [], toSt = [], keep = [];
    n.declarations.forEach(d => {
      if (bindIn(d, UTIL_NAMES)) toUtil.push(d); else if (bindIn(d, STATE_DECL)) toState.push(d); else if (bindIn(d, ST_NAMES)) toSt.push(d); else keep.push(d);
    });
    if (!toUtil.length && !toState.length && !toSt.length) return;
    if (toUtil.length) {
      const names = []; toUtil.forEach(d => collect({ type: 'VariableDeclaration', declarations: [d] }, names));
      const pub_ = names.filter(x => !UTIL_PRIVATE.has(x)), priv = names.filter(x => UTIL_PRIVATE.has(x));
      if (pub_.length && priv.length) fail('تصريح يخلط عاماً وخاصاً في util: ' + names.join(','));
      utilParts.push((pub_.length ? 'export ' : '') + n.kind + ' ' + toUtil.map(text).join(', ') + ';'); utilExports.push(...pub_);
    }
    if (toState.length) {
      const nm = []; toState.forEach(d => collect({ type: 'VariableDeclaration', declarations: [d] }, nm));
      stateParts.push((nm.some(x => x !== 'raw') ? 'export ' : '') + n.kind + ' ' + toState.map(text).join(', ') + ';');
    }
    toSt.forEach(d => {
      const nm = d.id.name;
      const init = d.init ? text(d.init) : 'undefined';
      const free = refs.filter(r => d.init && r.start >= d.init.start && r.end <= d.init.end && r.atRoot);
      if (free.length) fail(`المُهيِّئ لـ ${nm} يعتمد على أسماء من main.js: ${free.map(x => x.name).join(',')}`);
      stInit.push([nm, init]);
    });
    edits.push({ ...dropRange(n), text: keep.length ? n.kind + ' ' + keep.map(text).join(', ') + ';\n' : '' });
  }
});
// ترتيب CFG: raw ثم الشرط ثم CFG ثم saveCfg ثم setProperty (كما في الأصل)
const order = s => /^const raw\b/.test(s) ? 0 : /^if \(raw/.test(s) ? 1 : /CFG =/.test(s) && /^export const CFG/.test(s) ? 2 : /saveCfg/.test(s) ? 3 : 4;
stateParts.sort((a, b) => order(a) - order(b));
// إعادة كتابة مراجع المتغيّرات المشتركة إلى ST.x
let nRew = 0;
refs.filter(r => r.atRoot && ST_NAMES.includes(r.name)).forEach(r => {
  edits.push({ start: r.start, end: r.end, text: r.shorthand ? `${r.name}: ST.${r.name}` : `ST.${r.name}` }); nRew++;
});
// تطبيق التعديلات من الأخير إلى الأول مع التأكد من عدم التداخل
edits.sort((a, b) => b.start - a.start);
for (let i = 1; i < edits.length; i++) if (edits[i].end > edits[i - 1].start) fail(`تعديلان متداخلان عند ${edits[i].start}`);
let out = src; edits.forEach(e => { out = out.slice(0, e.start) + e.text + out.slice(e.end); });

// الاستيرادات: ما بقي غير معرّف في main بعد النقل
const un = new Set(analyze(out).refs.filter(r => r.unresolved).map(r => r.name));
const needUtil = utilExports.filter(x => un.has(x)), needState = ['CFG', 'saveCfg', 'ST'].filter(x => un.has(x));
const extra = [...un].filter(x => !utilExports.includes(x) && !['CFG', 'saveCfg', 'ST'].includes(x));
if (extra.length) fail('أسماء غير معرّفة بعد النقل: ' + extra.join(', '));
const lastImp = ast.body.filter(n => n.type === 'ImportDeclaration').pop();
const impEnd = out.indexOf('\n', out.indexOf(text(lastImp)) + text(lastImp).length - 1) + 1;
out = out.slice(0, impEnd) + `import { ${needUtil.join(', ')} } from './util.js';\nimport { ${needState.join(', ')} } from './state.js';\n` + out.slice(impEnd);

const utilTxt = `// أدوات مشتركة صغيرة بلا اعتماد على بقية المشروع (B-003 خطوة 1)
import * as THREE from 'three';
import * as SM from './survey-math.js';

${utilParts.join('\n')}
`;
const stateTxt = `// الحالة المشتركة (B-003 خطوة 2): الإعدادات + متغيّرات كانت تُعدَّل من أقسام متعددة في main.js
// القاعدة: لا يُسنَد إلى متغيّر مستورد؛ كل حالة مشتركة هي حقل في ST (ST.job = ... ✓).
${stateParts.join('\n')}

export const ST = {
${stInit.map(([k, v]) => `  ${k}: ${v}`).join(',\n')}
};
`;
console.log(`util.js: ${utilExports.length} تصديراً · state.js: CFG/saveCfg + ST(${stInit.length} حقلاً) · مراجع أُعيدت كتابتها: ${nRew} · main.js: ${src.split('\n').length} ← ${out.split('\n').length} سطراً`);
console.log('استيراد من util: ' + needUtil.join(' ') + '\nاستيراد من state: ' + needState.join(' '));
if (dry) { console.log('— تجربة: لم يُكتب شيء —'); process.exit(0); }
const ts = new Date().toISOString().replace(/[:.]/g, '-'), bk = path.join(root, '.apply-backup', 'b003-step12-' + ts);
fs.mkdirSync(bk, { recursive: true }); fs.copyFileSync(mainF, path.join(bk, 'main.js'));
fs.writeFileSync(utilF, utilTxt); fs.writeFileSync(stateF, stateTxt); fs.writeFileSync(mainF, out);
const r = cp.spawnSync(process.execPath, ['tests/run.js'], { cwd: root, encoding: 'utf8' });
if (r.status !== 0) {
  fs.copyFileSync(path.join(bk, 'main.js'), mainF); fs.renameSync(utilF, path.join(bk, 'util.js')); fs.renameSync(stateF, path.join(bk, 'state.js'));
  console.log('✗ فشلت الاختبارات، استُعيد main.js ونُقل الملفان الجديدان إلى ' + path.relative(root, bk) + '\n' + r.stdout.split('\n').filter(l => l.includes('✗')).slice(0, 10).join('\n')); process.exit(1);
}
console.log('✓ نجحت الاختبارات: ' + (/النتيجة:.*/.exec(r.stdout) || [''])[0] + '\n✓ نسخة main.js القديمة: ' + path.relative(root, bk));
