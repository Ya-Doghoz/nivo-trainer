const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, 'public'), pat = path.join(__dirname, 'patch');
const P = n => fs.readFileSync(path.join(pat, n), 'utf8');
const rd = f => fs.readFileSync(path.join(pub, f), 'utf8');
let main = rd('main.js'), html = rd('index.html'), ins = rd('instrument.js'), wor = rd('world.js');
if (wor.includes('NIVO-V6')) { console.log('✓ التحديث مطبّق مسبقاً'); process.exit(0); }
if (!main.includes('NIVO-V5') || !ins.includes('NIVO-V5')) { console.log('✗ طبّق التحديث السابق أولاً (node patch-v5.js)'); process.exit(1); }

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
wor = between(wor, 'export function groundH(x, z) {', '// ---------- بناء العالم ----------', P('w6_ground.txt'), 'world:ground');
wor = between(wor, 'function buildVeg() {', '// ---------- صورة الخريطة (كنتورية) ----------', P('w6_veg.txt'), 'world:veg');
wor = between(wor, 'export function setMarkers(points, setups) {', '// ---------- الميرا + الشخص ----------', P('w6_mark.txt'), 'world:markers');

// ---- instrument.js: الدائرة الرأسية تقرأ خط نظر الشعيرة S ----
ins = once(ins, 'if (type === \'tach\') v = st.vz + st.idx + ev(\'i\') * SEC;', 'if (type === \'tach\') v = st.vz + st.idx + ev(\'i\') * SEC + 0.001749;', 'ins:beta');
ins = once(ins, 'وثلاث شعيرات أفقية (ق ع وق و وق س) وخط مائل', 'وأربع شعيرات أفقية (ق ع وق و وق س وS) وقطعة مائلة تخرج من الشعيرة العليا', 'ins:desc');

// ---- main.js ----
main = once(main, 's.D = 100 * (s.U - s.L); }', 's.D = 100 * (s.U - s.L); }\n    if (I.type === \'tach\') { rc.set(_o, _d.clone().applyAxisAngle(_r, -0.001749)); const hs_ = rc.intersectObject(face, false)[0]; if (hs_) s.sr = hs_.point.y - gy - I.staffZero(); }', 'main:sray');
main = once(main, 'tr: { u: S.U, m: S.reading, l: S.L, hz: rd.hz, v: rd.v } };', 'tr: { u: S.U, m: S.reading, l: S.L, s: S.sr, hz: rd.hz, v: rd.v } };', 'main:tr');
main = once(main, "if (kc === null) return say('اكتب قيمة K (انظر K النظري تحت الخانات)', 'warn');", "if (kc === null) return say('اكتب قيمة K (انظر K النظري تحت الخانات)', 'warn');\n  if (s === null) return say('اكتب S: قراءة شعيرة التصويب (القصيرة تحت المنتصف)', 'warn');", 'main:reqS');
main = once(main, 'es = S.U != null ? Math.max(Math.abs(u - S.U), Math.abs(l - S.L)) * 1000 : 0;', 'es = S.U != null ? Math.max(Math.abs(u - S.U), Math.abs(l - S.L), m != null ? Math.abs(m - S.reading) : 0, S.sr != null ? Math.abs(s - S.sr) : 0) * 1000 : 0;', 'main:es');
main = once(main, 'وS قراءة الشعيرة الوسطى', 'وS قراءة شعيرة التصويب (القصيرة تحت المنتصف)', 'main:steps1');
main = once(main, 'وق ع وق و وق س وK وسجّل', 'وق ع وق و وق س وS وK وسجّل', 'main:steps2');

// ---- index.html ----
html = once(html, 'placeholder="S (فارغ = ق و)"', 'placeholder="S (شعيرة التصويب)"', 'html:S');

if (fails.length) {
  console.log('✗ لم يُطبَّق التحديث ولم يتغيّر أي ملف. المشاكل:');
  fails.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
['main.js', 'index.html', 'instrument.js', 'world.js'].forEach(f => fs.copyFileSync(path.join(pub, f), path.join(pub, f + '.v5.bak')));
fs.writeFileSync(path.join(pub, 'main.js'), main);
fs.writeFileSync(path.join(pub, 'index.html'), html);
fs.writeFileSync(path.join(pub, 'instrument.js'), ins);
fs.writeFileSync(path.join(pub, 'world.js'), wor);
console.log('✓ تم التحديث (نسخ احتياطية: *.v5.bak)');
