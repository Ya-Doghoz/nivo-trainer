// خريطة التشابك بين أقسام main.js: أي قسم يستخدم رُموزاً (دوال/ثوابت) معرّفة في قسم آخر.
// محمول: يقرأ ast-scope.js و public/main.js نسبةً إلى موقع هذا الملف، لا يعتمد على مجلد التشغيل.
// التشغيل من جذر المستودع: node --expose-internals tools/edges.js
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const { analyze, collect } = require(path.join(ROOT, 'tools', 'ast-scope.js'));
const src = fs.readFileSync(path.join(ROOT, 'public', 'main.js'), 'utf8');
const { ast, refs } = analyze(src);
const lines = src.split('\n'), heads = [];
lines.forEach((l, i) => { const m = /^\/\/ (?:=+|-+)\s*(.+?)\s*(?:=+|-+)\s*$/.exec(l); if (m) heads.push({ line: i + 1, title: m[1] }); });
const secOf = n => { let h = '(مقدمة)'; heads.forEach(x => { if (x.line <= n.loc.start.line) h = x.title; }); return h; };
const imports = new Set();
ast.body.filter(n => n.type === 'ImportDeclaration').forEach(n => n.specifiers.forEach(s => imports.add(s.local.name)));
const owner = new Map(), kind = new Map();
ast.body.forEach(n => { const t = secOf(n), nm = []; collect(n, nm); nm.forEach(x => { if (!imports.has(x)) { owner.set(x, t); kind.set(x, n.type === 'FunctionDeclaration' ? 'fn' : (n.type === 'VariableDeclaration' ? (n.kind === 'const' ? (n.declarations.some(d => d.init && /Arrow|Function/.test(d.init.type)) ? 'fnc' : 'const') : 'let') : n.type)); } }); });
const stmtSec = ast.body.map(n => ({ s: n.start, e: n.end, t: secOf(n) }));
const E = new Map();
refs.forEach(r => { if (!r.atRoot) return; const o = owner.get(r.name); if (!o) return; const st = stmtSec.find(x => r.start >= x.s && r.end <= x.e); if (!st || st.t === o) return; const k = st.t + ' → ' + o; (E.get(k) || E.set(k, new Map()).get(k)).set(r.name, kind.get(r.name)); });
const short = s => s.replace(/\(.*$/, '').replace(/:.*$/, '').trim().slice(0, 16);
[...E.entries()].sort().forEach(([k, m]) => console.log(k.split(' → ').map(short).join(' → ').padEnd(40) + [...m.entries()].map(([n, kd]) => n + '[' + kd + ']').join(' ')));

// ---- ترتيب أمثل بعد دمج مجموعات ----
const grp = t => /^الخريطة|^سحب النقاط/.test(t) ? 'MAP' : /^نوع الجهاز|^التسميات|^نافذة قراءة/.test(t) ? 'DEV' : t.startsWith('أخطاء') ? 'ERR' : t.startsWith('التركيب') ? 'MOUNT' : t.startsWith('التوجيه') ? 'POINT' : t.startsWith('الكاميرا') ? 'CAM' : t.startsWith('نقل') ? 'MOVE' : t.startsWith('أدوات') ? 'TT' : t.startsWith('الإعدادات') ? 'UI' : t === 'الإطار' ? 'LOOP' : t === 'بدء' ? 'START' : t;
const nodes = ['MAP', 'DEV', 'ERR', 'MOUNT', 'POINT', 'CAM', 'MOVE', 'TT', 'UI', 'LOOP', 'START'];
const W = {}; nodes.forEach(a => { W[a] = {}; nodes.forEach(b => { W[a][b] = new Set(); }); });
[...E.entries()].forEach(([k, m]) => { const [a, b] = k.split(' → ').map(grp); if (a !== b && W[a] && W[a][b]) m.forEach((kd, n) => W[a][b].add(n + '[' + kd + ']')); });
const n = nodes.length, full = (1 << n) - 1, INF = 1e9, dp = new Array(full + 1).fill(INF), par = new Array(full + 1).fill(-1);
dp[0] = 0;
for (let S = 0; S <= full; S++) { if (dp[S] >= INF) continue; for (let v = 0; v < n; v++) { if (S & (1 << v)) continue; // v يوضع بعد S (S أسبق منه). الحافة v→u مع u∈S تقدّمية؛ مع u∉S (ستأتي بعد) خلفية
    let back = 0; for (let u = 0; u < n; u++) if (u !== v && !(S & (1 << u))) back += W[nodes[v]][nodes[u]].size;
    const T = S | (1 << v); if (dp[S] + back < dp[T]) { dp[T] = dp[S] + back; par[T] = v; } } }
const order = []; let S = full; while (S) { const v = par[S]; order.push(v); S &= ~(1 << v); } order.reverse();
console.log('\nأفضل ترتيب (الأسبق = الأقل اعتماداً):', order.map(i => nodes[i]).join(' < '), '· حواف خلفية:', dp[full]);
const pos = {}; order.forEach((v, i) => { pos[nodes[v]] = i; });
nodes.forEach(a => nodes.forEach(b => { if (a !== b && W[a][b].size && pos[a] < pos[b]) console.log('  خلفية', a, '→', b, ':', [...W[a][b]].join(' ')); }));
