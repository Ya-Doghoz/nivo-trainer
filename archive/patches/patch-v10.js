const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, 'public'), pat = path.join(__dirname, 'patch');
const P = n => fs.readFileSync(path.join(pat, n), 'utf8');
const rd = f => fs.readFileSync(path.join(pub, f), 'utf8');
let main = rd('main.js'), wor = rd('world.js'), html = rd('index.html');
if (wor.includes('NIVO-V10')) { console.log('✓ التحديث مطبّق مسبقاً'); process.exit(0); }
if (!wor.includes('NIVO-V8') || !main.includes('NIVO-V9')) { console.log('✗ طبّق patch-v8 ثم patch-v9 أولاً'); process.exit(1); }
['drone.js', 'drone-config.js', 'logbook.js'].forEach(f => { if (!fs.existsSync(path.join(pub, f))) { console.log('✗ ملف ناقص: public/' + f); process.exit(1); } });
['w10_ground.txt', 'w10_terrain.txt', 'w10_veg.txt', 'w10_map.txt', 'w10_holder.txt'].forEach(f => { if (!fs.existsSync(path.join(pat, f))) { console.log('✗ ملف ناقص: patch/' + f); process.exit(1); } });

const fails = [];
const count = (s, a) => s.split(a).length - 1;
function once(s, a, b, tag) { const n = count(s, a); if (n !== 1) { fails.push(`${tag} (وُجد ${n} مرة)`); return s; } return s.replace(a, () => b); }
function between(s, a, b, mid, tag) {
  const n = count(s, a); if (n !== 1) { fails.push(`${tag}: بداية المقطع (وُجد ${n})`); return s; }
  const i = s.indexOf(a), j = s.indexOf(b, i + a.length); if (j < 0) { fails.push(`${tag}: نهاية المقطع`); return s; }
  return s.slice(0, i) + mid + s.slice(j);
}
function tail(s, a, mid, tag) { const n = count(s, a); if (n !== 1) { fails.push(`${tag} (وُجد ${n} مرة)`); return s; } return s.slice(0, s.indexOf(a)) + mid; }

// ---- world.js ----
wor = between(wor, '// NIVO-V8 — تضاريس + نهر + جسر', '// ---------- بناء العالم ----------', P('w10_ground.txt'), 'world:ground');
wor = between(wor, 'function buildTerrain() {', '// نباتات ومنازل موزَّعة على كل الخريطة', P('w10_terrain.txt'), 'world:terrain');
wor = between(wor, 'function buildVeg() {', '// إخفاء ما يحجب خطوط النظر بين مواضع الجهاز', P('w10_veg.txt'), 'world:veg');
wor = between(wor, '// ---------- صورة الخريطة (كنتورية) ----------', '// ---------- تدريج الميرا ----------', P('w10_map.txt'), 'world:map');
wor = tail(wor, 'const crossesWater = (x0, z0, x1, z1) =>', P('w10_holder.txt'), 'world:holder');
wor = once(wor, 'new THREE.Fog(HOR, 110, 560)', 'new THREE.Fog(HOR, 140, 2400)', 'world:fog');
wor = once(wor, 'new THREE.SphereGeometry(600, 32, 16)', 'new THREE.SphereGeometry(3000, 32, 16)', 'world:sky');
wor = once(wor, 'const a = r() * 6.283, d = 260 + r() * 120;', 'const a = r() * 6.283, d = 1200 + r() * 1400;', 'world:cloud1');
wor = once(wor, 's.position.set(Math.cos(a) * d, 90 + r() * 80, Math.sin(a) * d); s.scale.set(110 + r() * 80, 48 + r() * 25, 1);', 's.position.set(Math.cos(a) * d, 320 + r() * 260, Math.sin(a) * d); s.scale.set(480 + r() * 340, 210 + r() * 110, 1);', 'world:cloud2');
wor = once(wor, '[[470, 0.55, 0x5f7894, 1.0], [400, 0.4, 0x4f6a85, 0.8]]', '[[2300, 0.55, 0x5f7894, 3.4], [1900, 0.4, 0x4f6a85, 2.7]]', 'world:mtn');
wor = once(wor, 'new THREE.CircleGeometry(900, 48)', 'new THREE.CircleGeometry(3300, 48)', 'world:floor');
wor += '\n// NIVO-V10\n';

// ---- main.js: خريطة 1000×1000 م ----
main = once(main, "bridgeInfo, dryNear, riverInfo } from './world.js';", "bridgeInfo, bridgeList, dryNear, riverInfo } from './world.js';", 'main:import');
main = once(main, 'const HALF = 150, mapC =', 'const HALF = 500, MZ = 500 / 120, mapC =', 'main:half');
main = once(main, 'for (let g = -Math.floor(HALF / 20) * 20; g <= HALF; g += 20) {', 'for (let g = -Math.floor(HALF / 100) * 100; g <= HALF; g += 100) {', 'main:grid');
main = main.split('mapImage(HALF, 280)').join('mapImage(HALF, 320)');
main = once(main, 'const br = bridgeInfo();', '/* الجسور */', 'main:br1');
main = once(main, 'if (br) { const [bx, by] = w2m(br.x, br.z); c.save();', 'for (const br of bridgeList()) { const [bx, by] = w2m(br.x, br.z); c.save();', 'main:br2');
main = once(main, 'const t = nearAny(x, z, 9);', 'const t = nearAny(x, z, 9 * MZ);', 'main:tol1');
main = once(main, 'const s0 = nearOf(job.setups, x, z, 6);', 'const s0 = nearOf(job.setups, x, z, 6 * MZ);', 'main:tol2');
main = once(main, 'const p = nearOf(job.points, x, z, 10);', 'const p = nearOf(job.points, x, z, 10 * MZ);', 'main:tol3');
main = once(main, 'const t = nearAny(x, z, 6);', 'const t = nearAny(x, z, 6 * MZ);', 'main:tol4');
main = once(main, 'const t = nearAny(x, z, 8);', 'const t = nearAny(x, z, 8 * MZ);', 'main:tol5');
main = once(main, 'new THREE.PerspectiveCamera(50, 1, 0.1, 700)', 'new THREE.PerspectiveCamera(50, 1, 0.1, 3600)', 'main:far');
main = main.replace(/\s*$/, '\n') + '// NIVO-V10\n';

if (fails.length) {
  console.log('✗ لم يُطبَّق التحديث ولم يتغيّر أي ملف. المشاكل:');
  fails.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
['main.js', 'world.js'].forEach(f => fs.copyFileSync(path.join(pub, f), path.join(pub, f + '.v9.bak')));
fs.writeFileSync(path.join(pub, 'main.js'), main);
fs.writeFileSync(path.join(pub, 'world.js'), wor);
console.log('✓ تم التحديث (نسخ احتياطية: *.v9.bak). حدّث الصفحة بالكامل ثم اضغط «🌍 عالم جديد».');
