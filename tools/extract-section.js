// B-003: يستخرج قسماً (أو أكثر) من main.js إلى وحدة مستقلة بتحليل AST، ويحدّث الاستيرادات والتصدير تلقائياً.
// الاستعمال:
//   node --expose-internals tools/extract-section.js --list                  ← جدول كل الأقسام وما يمنع استخراجها
//   node --expose-internals tools/extract-section.js steps "الخطوات" --dry     ← تجربة بلا كتابة
//   node --expose-internals tools/extract-section.js steps "الخطوات"           ← استخراج + اختبارات + استعادة عند الفشل
//   (عدة أقسام معاً: "قسم1|قسم2")   ·   --hoist=اسم[@util] ينقل تصريحاً إلى state.js/util.js   ·   --pick=اسم1,اسم2 يضم تصاريح من خارج الأقسام
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { analyze, collect } = require('./ast-scope.js');
const root = path.join(__dirname, '..'), pub = path.join(root, 'public'), mainF = path.join(pub, 'main.js');
const args = process.argv.slice(2), dry = args.includes('--dry'), list = args.includes('--list');
const pos = args.filter(a => !a.startsWith('--'));
const hoistArg = (args.find(a => a.startsWith('--hoist=')) || '').slice(8), HOISTM = new Map(); (hoistArg ? hoistArg.split(',') : []).forEach(x => { const [n, t] = x.split('@'); HOISTM.set(n, t || 'state'); });   // تصاريح تُنقل إلى state.js (أو util.js بصيغة اسم@util) بدل الوحدة
const HOIST = new Set(HOISTM.keys());
const pickArg = (args.find(a => a.startsWith('--pick=')) || '').slice(7), PICKN = new Set(pickArg ? pickArg.split(',') : []);
const fail = m => { console.log('✗ ' + m); process.exit(1); };
const src = fs.readFileSync(mainF, 'utf8');
const { ast, refs } = analyze(src);
const lines = src.split('\n');
const heads = []; lines.forEach((l, i) => { const m = /^\/\/ (?:=+|-+)\s*(.+?)\s*(?:=+|-+)\s*$/.exec(l); if (m) heads.push({ line: i + 1, title: m[1] }); });
const secOf = n => { let h = null; heads.forEach(x => { if (x.line <= n.loc.start.line) h = x; }); return h; };
const stmts = ast.body.map((n, i) => ({ n, i, sec: secOf(n), names: (() => { const o = []; collect(n, o); return o; })() }));
const text = n => src.slice(n.start, n.end);
const imports = new Map();                       // local → { source, ns, imported }
ast.body.filter(n => n.type === 'ImportDeclaration').forEach(n => n.specifiers.forEach(s => imports.set(s.local.name, { source: n.source.value, ns: s.type === 'ImportNamespaceSpecifier', imported: s.imported ? s.imported.name : null })));
const owner = new Map(); stmts.forEach(s => s.names.forEach(x => { if (!imports.has(x)) owner.set(x, s); }));

function analyzeSet(sel) {
  const D = new Set(); sel.forEach(s => s.names.forEach(x => D.add(x)));
  const within = r => sel.some(s => r.start >= s.n.start && r.end <= s.n.end);
  const needImp = new Set(), blockers = new Map(), exportNames = new Set(), hazards = new Set();
  refs.forEach(r => {
    if (!r.atRoot) return;
    if (within(r)) {
      if (D.has(r.name)) return;
      if (imports.has(r.name)) needImp.add(r.name);
      else if (owner.has(r.name)) { const o = owner.get(r.name); blockers.set(r.name, `${o.sec ? o.sec.title : '(مقدمة)'}`); }
    } else if (D.has(r.name)) {
      exportNames.add(r.name);
      const o = owner.get(r.name); if (r.assign && o && o.n.type === 'VariableDeclaration' && o.n.kind !== 'const') hazards.add(r.name);
    }
  });
  const side = sel.filter(s => !['FunctionDeclaration', 'ClassDeclaration', 'VariableDeclaration', 'ImportDeclaration'].includes(s.n.type));
  return { D, needImp, blockers, exportNames, hazards, side };
}
const titleSel = pat => pat.split('|').map(p => p.trim()).filter(Boolean);
const pick = pat => { const t = titleSel(pat); return stmts.filter(s => (s.sec && t.some(x => (x.startsWith('=') ? s.sec.title === x.slice(1) : s.sec.title.includes(x)))) || s.names.some(n => PICKN.has(n))); };   // "=عنوان" = مطابقة تامة

if (list) {
  console.log('القسم'.padEnd(46) + 'أسطر  يمنعه (من main)                         ⚠ يُسنَد من الخارج');
  heads.forEach(h => {
    const sel = stmts.filter(s => s.sec && s.sec.line === h.line); if (!sel.length) return;
    const a = analyzeSet(sel), ln = sel.reduce((t, s) => t + s.n.loc.end.line - s.n.loc.start.line + 1, 0);
    console.log(h.title.slice(0, 44).padEnd(46) + String(ln).padEnd(6) + ([...a.blockers.keys()].slice(0, 5).join('،') || '— حرّ —').padEnd(42) + ([...a.hazards].join('،') || ''));
  });
  process.exit(0);
}
const [modName, pat] = pos;
if (!modName || !pat) fail('الاستعمال: extract-section.js <اسم_الوحدة> "<عنوان القسم>" [--dry]');
const outF = path.join(pub, modName + '.js');
if (fs.existsSync(outF)) { console.log('✓ ' + modName + '.js موجود — مطبّق مسبقاً'); process.exit(0); }
const sel = pick(pat); if (!sel.length) fail('لم أجد قسماً يطابق: ' + pat);
PICKN.forEach(p => { if (!sel.some(s => s.names.includes(p))) fail('الاسم المطلوب ضمّه غير موجود: ' + p); });
const A = analyzeSet(sel);
HOIST.forEach(h => { if (!sel.some(s => s.names.includes(h))) fail('الاسم المطلوب نقله إلى state.js غير موجود في القسم: ' + h); });
const exportOut = [...A.exportNames].filter(x => !HOIST.has(x));
if (A.blockers.size) fail('لا يمكن الاستخراج الآن — يعتمد على أسماء ما زالت في main.js:\n  ' + [...A.blockers].map(([k, v]) => `${k}  (من: ${v})`).join('\n  '));
if (A.hazards.size) fail('متغيّرات قابلة للتغيير تُسنَد من خارج القسم: ' + [...A.hazards].join('، ') + ' — انقلها إلى ST أولاً');

// ---- بناء نص الوحدة ----
const bySrc = new Map();
[...A.needImp].forEach(l => { const m = imports.get(l); (bySrc.get(m.source) || bySrc.set(m.source, []).get(m.source)).push({ l, ...m }); });
const impLines = [...bySrc.entries()].map(([s, arr]) => {
  const ns = arr.find(x => x.ns), named = arr.filter(x => !x.ns).map(x => (x.imported === x.l ? x.l : `${x.imported} as ${x.l}`));
  return [ns ? `import * as ${ns.l} from '${s}';` : '', named.length ? `import { ${named.join(', ')} } from '${s}';` : ''].filter(Boolean).join('\n');
});
const isHoisted = s => ['VariableDeclaration', 'FunctionDeclaration'].includes(s.n.type) && s.names.length && s.names.every(x => HOIST.has(x));
const appendBy = { state: [], util: [] }; sel.filter(isHoisted).forEach(s => appendBy[HOISTM.get(s.names[0])].push('export ' + text(s.n)));
const stateAppend = appendBy.state, utilAppend = appendBy.util;
const body = sel.filter(s => !isHoisted(s)).map(s => {
  let t = text(s.n);
  const exp = s.names.some(x => exportOut.includes(x));
  if (exp && ['FunctionDeclaration', 'ClassDeclaration', 'VariableDeclaration'].includes(s.n.type)) t = 'export ' + t;
  // نحافظ على التعليقات التي تسبق العبارة مباشرة داخل القسم
  const before = src.slice(s.i === 0 ? 0 : ast.body[s.i - 1].end, s.n.start).replace(/^[ \t]*\n/, '');
  const cm = before.split('\n').filter(l => /^\s*\/\//.test(l) && !/^\/\/ (=+|-+)/.test(l)).join('\n');
  return (cm ? cm + '\n' : '') + t;
}).join('\n');
const titleOf = (sel.find(s => s.sec) || {}).sec;
let outText = `// ${titleOf ? titleOf.title : modName} — استُخرج من main.js (B-003)\n${impLines.join('\n')}\n\n${body}\n`;

// ---- إعادة كتابة main.js ----
const edits = [];
const lineStart = i => src.lastIndexOf('\n', i - 1) + 1, lineEnd = i => { const j = src.indexOf('\n', i); return j < 0 ? src.length : j + 1; };
sel.forEach(s => {
  const start = /^[ \t]*$/.test(src.slice(lineStart(s.n.start), s.n.start)) ? lineStart(s.n.start) : s.n.start;
  edits.push({ start, end: lineEnd(s.n.end), text: '' });
});
heads.filter(h => sel.some(s => s.sec && s.sec.line === h.line) && !stmts.some(s => s.sec && s.sec.line === h.line && !sel.includes(s))).forEach(h => {
  const st = lines.slice(0, h.line - 1).join('\n').length + (h.line > 1 ? 1 : 0); edits.push({ start: st, end: st + lines[h.line - 1].length + 1, text: '' });
});
edits.sort((a, b) => b.start - a.start);
for (let i = 1; i < edits.length; i++) if (edits[i].end > edits[i - 1].start) { edits[i].end = Math.min(edits[i].end, edits[i - 1].start); }
let out = src; edits.forEach(e => { out = out.slice(0, e.start) + e.text + out.slice(e.end); });
const lastImp = ast.body.filter(n => n.type === 'ImportDeclaration').pop();
const impEnd = out.indexOf('\n', out.indexOf(text(lastImp)) + text(lastImp).length - 1) + 1;
out = out.slice(0, impEnd) + (exportOut.length ? `import { ${exportOut.join(', ')} } from './${modName}.js';\n` : `import './${modName}.js';\n`) + out.slice(impEnd);   // وحدة بلا تصدير تُستورَد جانبياً وإلا لا تُحمَّل أبداً
// حذف الاستيرادات التي لم تعد مستعملة في main.js
{
  const re = analyze(out), used = new Set(re.refs.filter(r => r.atRoot).map(r => r.name));
  const impNodes = re.ast.body.filter(n => n.type === 'ImportDeclaration' && n.specifiers.length);
  [...impNodes].reverse().forEach(n => {
    const keep = n.specifiers.filter(s => used.has(s.local.name)); if (keep.length === n.specifiers.length) return;
    let t = '';
    if (keep.length) {
      const ns = keep.find(s => s.type === 'ImportNamespaceSpecifier'), def = keep.find(s => s.type === 'ImportDefaultSpecifier'), named = keep.filter(s => s.type === 'ImportSpecifier').map(s => (s.imported.name === s.local.name ? s.local.name : `${s.imported.name} as ${s.local.name}`));
      t = [ns ? `import * as ${ns.local.name} from '${n.source.value}';` : '', named.length || def ? `import ${def ? def.local.name + (named.length ? ', ' : '') : ''}${named.length ? '{ ' + named.join(', ') + ' }' : ''} from '${n.source.value}';` : ''].filter(Boolean).join('\n') + '\n';
    }
    const s0 = out.lastIndexOf('\n', n.start - 1) + 1, e0 = out.indexOf('\n', n.end - 1) + 1;
    out = out.slice(0, s0) + t + out.slice(e0);
  });
}
out = out.replace(/\n{4,}/g, '\n\n\n');
function fixStateImports(txt) {
  ['state', 'util'].forEach(t => {
    const names = [...HOIST].filter(h => HOISTM.get(h) === t); if (!names.length) return;
    const need = [...new Set(analyze(txt).refs.filter(r => r.unresolved && names.includes(r.name)).map(r => r.name))]; if (!need.length) return;
    const re = new RegExp(`import \\{([^}]*)\\} from '\\./${t}\\.js';`), m = re.exec(txt);
    if (m) { const line = `import { ${[...new Set([...m[1].split(',').map(x => x.trim()).filter(Boolean), ...need])].join(', ')} } from './${t}.js';`; txt = txt.replace(m[0], () => line); return; }
    const imps = [...txt.matchAll(/^import .*;$/gm)], last = imps[imps.length - 1], at = last ? last.index + last[0].length : txt.indexOf('\n');
    txt = txt.slice(0, at) + `\nimport { ${need.join(', ')} } from './${t}.js';` + txt.slice(at);
  });
  return txt;
}
out = fixStateImports(out); outText = fixStateImports(outText);
const total = sel.reduce((t, s) => t + s.n.loc.end.line - s.n.loc.start.line + 1, 0);
console.log(`${modName}.js: ${total} سطراً · يصدّر: ${exportOut.join('، ') || '—'}${HOIST.size ? ' · يُنقل: ' + [...HOISTM].map(([k, v]) => k + '→' + v + '.js').join('، ') : ''} · يستورد: ${[...A.needImp].join('، ') || '—'}\nعبارات تنفَّذ عند التحميل (غير تصاريح): ${A.side.length ? A.side.map(s => text(s.n).slice(0, 60).replace(/\n/g, ' ')).join(' | ') : 'لا شيء'}\nmain.js: ${lines.length} ← ${out.split('\n').length} سطراً`);
if (args.includes('--dump')) { const d = path.join(root, '.apply-backup', 'dump'); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, 'main.js'), out); fs.writeFileSync(path.join(d, modName + '.js'), outText); console.log('→ كُتبت النسختان في .apply-backup/dump/'); }
if (dry) { console.log('— تجربة: لم يُكتب شيء —'); process.exit(0); }

// ---- كتابة + اختبار + استعادة ----
const smokeF = path.join(root, 'tests', 'module-smoke.js');
let smoke = fs.existsSync(smokeF) ? fs.readFileSync(smokeF, 'utf8') : '', smokeNew = smoke;
const oldReal = "const REAL = new Set(fs.readdirSync(pubDir).filter(f => /^(util|state|survey-math|map|job|steps|books-level|books-tt|bus)\\.js$/.test(f)));";
if (smoke.includes(oldReal)) smokeNew = smoke.replace(oldReal, "const STUBBED = new Set(['world.js', 'instrument.js', 'targets.js', 'scopefx.js', 'extras.js', 'drone.js', 'drone-config.js', 'drone-sound.js', 'drone-worklet.js', 'logbook.js', 'help.js', 'custom.js', 'world-config.js']);\nconst REAL = new Set(fs.readdirSync(pubDir).filter(f => f.endsWith('.js') && !STUBBED.has(f) && f !== 'main.js'));");
const ts = new Date().toISOString().replace(/[:.]/g, '-'), bk = path.join(root, '.apply-backup', `extract-${modName}-${ts}`);
const stateF = path.join(pub, 'state.js'), utilF = path.join(pub, 'util.js');
if (utilAppend.length) { const ut = analyze(fs.readFileSync(utilF, 'utf8') + '\n' + utilAppend.join('\n')).refs.filter(r => r.unresolved).map(r => r.name); if (ut.length) fail('الدالة المنقولة إلى util.js تعتمد على أسماء غير موجودة فيه: ' + [...new Set(ut)].join('، ')); }
fs.mkdirSync(bk, { recursive: true }); fs.copyFileSync(mainF, path.join(bk, 'main.js')); if (stateAppend.length) fs.copyFileSync(stateF, path.join(bk, 'state.js')); if (utilAppend.length) fs.copyFileSync(utilF, path.join(bk, 'util.js')); if (smoke) fs.copyFileSync(smokeF, path.join(bk, 'module-smoke.js'));
fs.writeFileSync(outF, outText); fs.writeFileSync(mainF, out); if (stateAppend.length) fs.appendFileSync(stateF, '\n' + stateAppend.join('\n') + '\n'); if (utilAppend.length) fs.appendFileSync(utilF, '\n' + utilAppend.join('\n') + '\n'); if (smokeNew !== smoke) fs.writeFileSync(smokeF, smokeNew);
const r = cp.spawnSync(process.execPath, ['tests/run.js'], { cwd: root, encoding: 'utf8' });
if (r.status !== 0) {
  fs.copyFileSync(path.join(bk, 'main.js'), mainF); if (stateAppend.length) fs.copyFileSync(path.join(bk, 'state.js'), stateF); if (utilAppend.length) fs.copyFileSync(path.join(bk, 'util.js'), utilF); if (smoke) fs.copyFileSync(path.join(bk, 'module-smoke.js'), smokeF); fs.renameSync(outF, path.join(bk, modName + '.js'));
  console.log('✗ فشلت الاختبارات، استُعيد main.js ونُقلت الوحدة إلى ' + path.relative(root, bk) + '\n' + r.stdout.split('\n').filter(l => l.includes('✗')).slice(0, 10).join('\n')); process.exit(1);
}
cp.spawnSync(process.execPath, [path.join(__dirname, 'gen-api.js')], { cwd: root });
console.log('✓ نجحت الاختبارات: ' + (/النتيجة:.*/.exec(r.stdout) || [''])[0] + '\n✓ نسخة main.js السابقة: ' + path.relative(root, bk));
