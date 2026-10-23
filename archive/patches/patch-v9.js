const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, 'public'), pat = path.join(__dirname, 'patch');
const P = n => fs.readFileSync(path.join(pat, n), 'utf8');
const rd = f => fs.readFileSync(path.join(pub, f), 'utf8');
let main = rd('main.js'), html = rd('index.html');
if (main.includes('NIVO-V9')) { console.log('✓ التحديث مطبّق مسبقاً'); process.exit(0); }
if (!main.includes('{ toast, onJobChanged, placeInstrument }')) { console.log('✗ طبّق patch-v8 أولاً'); process.exit(1); }
['drone.js', 'logbook.js'].forEach(f => { if (!fs.existsSync(path.join(pub, f))) { console.log('✗ ملف ناقص: public/' + f); process.exit(1); } });

const fails = [], warns = [];
const count = (s, a) => s.split(a).length - 1;
function once(s, a, b, tag) { const n = count(s, a); if (n !== 1) { fails.push(`${tag} (وُجد ${n} مرة)`); return s; } return s.replace(a, () => b); }
function between(s, a, b, mid, tag) {
  const n = count(s, a); if (n !== 1) { fails.push(`${tag}: بداية المقطع (وُجد ${n})`); return s; }
  const i = s.indexOf(a), j = s.indexOf(b, i + a.length); if (j < 0) { fails.push(`${tag}: نهاية المقطع`); return s; }
  return s.slice(0, i) + mid + s.slice(j);
}

// الاستيراد + مساحة الخريطة (240 م ← 300 م)
main = once(main, "bridgeInfo, dryNear } from './world.js';", "bridgeInfo, dryNear, riverInfo } from './world.js';", 'main:import');
main = once(main, 'const HALF = 120, mapC =', 'const HALF = 150, mapC =', 'main:half');
main = once(main, 'for (let g = -100; g <= 100; g += 20) {', 'for (let g = -Math.floor(HALF / 20) * 20; g <= HALF; g += 20) {', 'main:grid');
if (count(main, '-116, 116') < 1) fails.push('main:clamp (لم يُوجد -116, 116)');
else main = main.split('-116, 116').join('-(HALF - 4), HALF - 4');
if (count(main, 'mapImage(HALF, 240)') < 1) warns.push('لم أجد mapImage(HALF, 240) — دقة الخريطة بقيت كما هي');
else main = main.split('mapImage(HALF, 240)').join('mapImage(HALF, 280)');

// مهمة عشوائية: الجهاز لا يلزمه أن يكون قرب النهر
main = between(main, 'function randomJob(sd) {', '// ================= الكاميرا الخارجية =================', P('m9_job.txt'), 'main:job');

// ربط الدرون بحلقة العرض
main = once(main, 'function render() {', 'function render() {\n  if (window.NIVO && window.NIVO.droneActive && window.NIVO.droneActive()) { window.NIVO.droneRender(); return; }', 'main:render');
main = main.replace(/\s*$/, '\n') + 'Object.assign(window.NIVO, { job: () => job, half: () => HALF });\n// NIVO-V9\n';

html = once(html, '<script type="module" src="/extras.js"></script>', '<script type="module" src="/extras.js"></script>\n<script type="module" src="/drone.js"></script>\n<script type="module" src="/logbook.js"></script>', 'html:scripts');

if (fails.length) {
  console.log('✗ لم يُطبَّق التحديث ولم يتغيّر أي ملف. المشاكل:');
  fails.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
['main.js', 'index.html'].forEach(f => fs.copyFileSync(path.join(pub, f), path.join(pub, f + '.v8.bak')));
fs.writeFileSync(path.join(pub, 'main.js'), main);
fs.writeFileSync(path.join(pub, 'index.html'), html);
warns.forEach(w => console.log('⚠ ' + w));
['drone-sound.js', 'drone-worklet.js'].forEach(f => { if (!fs.existsSync(path.join(pub, f))) console.log('⚠ ناقص: public/' + f + ' — سيعمل الدرون بلا صوت (نفّذ خطوة النسخ ١)'); });
console.log('✓ تم التحديث (نسخ احتياطية: *.v8.bak). حدّث الصفحة بالكامل ثم اضغط «🌍 عالم جديد».');
