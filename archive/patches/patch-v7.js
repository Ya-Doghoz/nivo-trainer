const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, 'public'), pat = path.join(__dirname, 'patch');
const P = n => fs.readFileSync(path.join(pat, n), 'utf8');
const rd = f => fs.readFileSync(path.join(pub, f), 'utf8');
let main = rd('main.js'), html = rd('index.html'), wor = rd('world.js');
if (wor.includes('NIVO-V7')) { console.log('✓ التحديث مطبّق مسبقاً'); process.exit(0); }
if (!wor.includes('NIVO-V6')) { console.log('✗ طبّق التحديث السابق أولاً (node patch-v6.js)'); process.exit(1); }

const fails = [];
const count = (s, a) => s.split(a).length - 1;
function once(s, a, b, tag) {
  const n = count(s, a);
  if (n !== 1) { fails.push(`${tag} (وُجد ${n} مرة)`); return s; }
  return s.replace(a, () => b);
}
function between(s, a, b, mid, tag) {
  const n = count(s, a);
  if (n !== 1) { fails.push(`${tag}: بداية المقطع (وُجد ${n})`); return s; }
  const i = s.indexOf(a), j = s.indexOf(b, i + a.length);
  if (j < 0) { fails.push(`${tag}: نهاية المقطع`); return s; }
  return s.slice(0, i) + mid + s.slice(j);
}

// ---- world.js ----
wor = between(wor, 'export function groundH(x, z) {', '// ---------- بناء العالم ----------', P('w7_ground.txt'), 'world:ground');
wor = between(wor, 'function buildVeg() {', '// ---------- صورة الخريطة (كنتورية) ----------', P('w7_veg.txt'), 'world:veg');
wor = once(wor, 'const N = 200, S = 700,', 'const N = 270, S = 700,', 'world:mesh');

// ---- main.js ----
main = once(main, "setMarkers, mulberry32 } from './world.js';", "setMarkers, mulberry32, setVegDensity } from './world.js';", 'main:import');
main = once(main, "err: true, errK: 1, pat: 'E',", "err: true, errK: 1, veg: 0.5, pat: 'E',", 'main:cfg');
main = once(main, 'const Rr = g0 + I.st.Hc + I.TY().trunH + 0.04 - groundH(p.x, p.z);', 'const Rr = g0 + 1.5 + I.TY().trunH + 0.04 - groundH(p.x, p.z);', 'main:reachHI');
main = once(main, 'return { d, ok: Rr > 0.3 && Rr < 3.7 && d <= 80 };', 'return { d, ok: Rr > 0.25 && Rr < 3.75 && d <= 80 };', 'main:reachRange');
main = once(main, 'async function lanRefresh(tries = 4) {', P('main7_veg.txt') + 'async function lanRefresh(tries = 4) {', 'main:vegUI');
main = once(main, 'doNewWorld(CFG.fix && +CFG.seed > 0 ? +CFG.seed : randSeed());', 'setVegDensity(+CFG.veg);\ndoNewWorld(CFG.fix && +CFG.seed > 0 ? +CFG.seed : randSeed());', 'main:start');

// ---- index.html ----
html = once(html, '<div class="row"><label>الجودة</label>', P('idx7_veg.txt') + '<div class="row"><label>الجودة</label>', 'html:veg');

if (fails.length) {
  console.log('✗ لم يُطبَّق التحديث ولم يتغيّر أي ملف. المشاكل:');
  fails.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
['main.js', 'index.html', 'world.js'].forEach(f => fs.copyFileSync(path.join(pub, f), path.join(pub, f + '.v6.bak')));
fs.writeFileSync(path.join(pub, 'main.js'), main);
fs.writeFileSync(path.join(pub, 'index.html'), html);
fs.writeFileSync(path.join(pub, 'world.js'), wor);
console.log('✓ تم التحديث (نسخ احتياطية: *.v6.bak)');
