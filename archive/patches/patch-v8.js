const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, 'public'), pat = path.join(__dirname, 'patch');
const P = n => fs.readFileSync(path.join(pat, n), 'utf8');
const rd = f => fs.readFileSync(path.join(pub, f), 'utf8');
let main = rd('main.js'), html = rd('index.html'), wor = rd('world.js');
if (wor.includes('NIVO-V8')) { console.log('✓ التحديث مطبّق مسبقاً'); process.exit(0); }
if (!wor.includes('NIVO-V7') || !main.includes('NIVO-V5')) { console.log('✗ طبّق التحديثات السابقة أولاً (patch-v5 ثم v6 ثم v7)'); process.exit(1); }
['survey-math.js', 'extras.js', 'targets.js'].forEach(f => { if (!fs.existsSync(path.join(pub, f))) { console.log('✗ ملف ناقص: public/' + f); process.exit(1); } });

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
function tail(s, a, mid, tag) {
  const n = count(s, a);
  if (n !== 1) { fails.push(`${tag} (وُجد ${n} مرة)`); return s; }
  return s.slice(0, s.indexOf(a)) + mid;
}

// ---- world.js ----
wor = between(wor, 'export function groundH(x, z) {', '// ---------- بناء العالم ----------', P('w8_ground.txt'), 'world:ground');
wor = once(wor, 'P = makeParams(seed); mapCache = null;', 'P = makeParams(seed); mapCache = null; makeRiver();', 'world:regen1');
wor = once(wor, 'buildSky(); buildMountains(); buildTerrain(); buildVeg(); buildHouses();', 'buildSky(); buildMountains(); buildTerrain(); buildRiver(); buildVeg(); buildHouses();', 'world:regen2');
// تضاريس الشبكة وألوانها
wor = once(wor, 'hs[i] = groundH(p.getX(i), p.getZ(i)); p.setY(i, hs[i]);', 'hs[i] = terrainH(p.getX(i), p.getZ(i)); p.setY(i, hs[i]);', 'world:t1');
wor = once(wor, 'let cr = gr[0] + (dr[0] - gr[0]) * dry + 0.1 * n, cg = gr[1] + (dr[1] - gr[1]) * dry + 0.18 * n + 0.04 * m, cb = gr[2] + (dr[2] - gr[2]) * dry + 0.05 * n;',
  'const ld = localDry(x, z); let cr = gr[0] + (dr[0] - gr[0]) * ld + 0.1 * n, cg = gr[1] + (dr[1] - gr[1]) * ld + 0.18 * n + 0.04 * m, cb = gr[2] + (dr[2] - gr[2]) * ld + 0.05 * n;', 'world:t2');
wor = once(wor, 'const rd = 1 - smooth(1.8, 3.4, Math.abs(x - roadX(z)));', 'const ri_ = riverInfo(x, z), rd = ri_.d < ri_.hw + 2.5 ? 0 : 1 - smooth(1.8, 3.4, Math.abs(x - roadX(z)));', 'world:t3');
wor = once(wor, 'col[i * 3] = cr; col[i * 3 + 1] = cg; col[i * 3 + 2] = cb;',
  '{ const mud = ri_.d < ri_.hw + 1.8 ? 1 : 1 - smooth(ri_.hw + 1.8, ri_.hw + 7, ri_.d); if (mud > 0) { cr += (0.3 - cr) * mud * 0.85; cg += (0.27 - cg) * mud * 0.85; cb += (0.19 - cb) * mud * 0.85; } }\n    col[i * 3] = cr; col[i * 3 + 1] = cg; col[i * 3 + 2] = cb;', 'world:t4');
// النباتات والمباني
wor = once(wor, 'if (T0.n >= MAXT) return;', 'if (T0.n >= MAXT || inRiver(x, z, 1.5)) return;', 'world:v1');
wor = once(wor, 'if (Math.hypot(x, z) < 55 || Math.abs(x - roadX(z)) < 6) continue;', 'if (Math.hypot(x, z) < 55 || Math.abs(x - roadX(z)) < 6 || inRiver(x, z, 2)) continue;', 'world:v2');
wor = once(wor, 'const f = fbm(x * 0.011 + P.ox * 1.3, z * 0.011 + P.oz * 1.3);', 'const f = fbm(x * 0.011 + P.ox * 1.3, z * 0.011 + P.oz * 1.3) + wetness(x, z) * 0.3;', 'world:v3');
wor = once(wor, 'if (Math.abs(x - roadX(z)) < 3.5) continue;', 'if (Math.abs(x - roadX(z)) < 3.5 || inRiver(x, z, 0.5)) continue;', 'world:v4');
wor = once(wor, 'if (fbm(x * 0.02 + P.ox, z * 0.02 + P.oz) < 0.42 && r() > 0.2) continue;', 'if (fbm(x * 0.02 + P.ox, z * 0.02 + P.oz) + wetness(x, z) * 0.3 < 0.42 && r() > 0.2) continue;', 'world:v5');
wor = once(wor, 'if (r() > 0.2 + sl * 9) continue;', 'if (r() > 0.2 + sl * 9 || inRiver(x, z, 0.5)) continue;', 'world:v6');
wor = once(wor, 'fin(rk);', `fin(rk);
  // قصب وأعشاب مائلة على ضفاف النهر
  if (RV) {
    const re = reg(new THREE.ConeGeometry(0.05, 1.5, 4), lam(), 700); re.mesh.geometry.translate(0, 0.75, 0);
    for (let i = 0; i < 20000 && re.n < Math.round(600 * Math.min(1, K + 0.3)); i++) {
      const s = (r() - 0.5) * 680, cl = rvCl(s), side = r() < 0.5 ? -1 : 1, off = rvHW(s) + 1.8 + (r() - 0.35) * 3.5;
      const dc = rvDcl(s), tl = Math.hypot(RV.dx + RV.nx * dc, RV.dz + RV.nz * dc), tx = (RV.dx + RV.nx * dc) / tl, tz = (RV.dz + RV.nz * dc) / tl;
      const x = s * RV.dx + cl * RV.nx - tz * side * off, z = s * RV.dz + cl * RV.nz + tx * side * off;
      if (Math.abs(x) > 270 || Math.abs(z) > 270) continue;
      const ri = riverInfo(x, z); if (ri.d < ri.hw + 1.0) continue;
      for (let q = 0; q < 3; q++) {
        const px = x + (r() - 0.5) * 0.8, pz = z + (r() - 0.5) * 0.8, sc = 0.6 + r() * 0.9;
        dummy.position.set(px, groundH(px, pz), pz); dummy.rotation.set((r() - 0.5) * 0.25, r() * 6, (r() - 0.5) * 0.25); dummy.scale.set(sc, sc, sc);
        const kk = put(re, px, pz, 0.3); if (kk >= 0) { c.setHSL(0.17 + r() * 0.06, 0.45, 0.3 + r() * 0.12); re.mesh.setColorAt(kk, c); }
      }
    }
    fin(re);
  }`, 'world:v7');
wor = once(wor, 'if (Math.abs(x - roadX(z)) < 2.5) continue;', 'if (Math.abs(x - roadX(z)) < 2.5 || inRiver(x, z, 0.3)) continue;', 'world:v8');
wor = once(wor, 'tf.setMatrixAt(nf, dummy.matrix); c.setHSL(0.22 - P.dry * 0.06 + r() * 0.08, 0.5 - P.dry * 0.2, 0.25 + r() * 0.15); tf.setColorAt(nf++, c);',
  'tf.setMatrixAt(nf, dummy.matrix); { const ld = localDry(x, z); c.setHSL(0.22 - ld * 0.06 + r() * 0.08, 0.5 - ld * 0.2, 0.25 + r() * 0.15); } tf.setColorAt(nf++, c);', 'world:v9');
wor = once(wor, 'if (Math.abs(x - roadX(z)) < 2.5 || fbm(x * 0.03 + P.ox * 2, z * 0.03 + P.oz * 2) < 0.5) continue;', 'if (Math.abs(x - roadX(z)) < 2.5 || inRiver(x, z, 0.3) || fbm(x * 0.03 + P.ox * 2, z * 0.03 + P.oz * 2) < 0.5) continue;', 'world:v10');
wor = once(wor, 'const house = (x, z) => {', 'const house = (x, z) => { if (inRiver(x, z, 14)) return;', 'world:h1');
wor = once(wor, 'HOUSES.forEach(h => { h.g.visible = !blocked(h.x, h.z, h.rad + 4); });', 'HOUSES.forEach(h => { h.g.visible = true; });', 'world:h2');
wor = once(wor, 'if (Math.abs(x - roadX(z)) < 1.6) { r = 0.78; g = 0.66; b = 0.5; }',
  'if (Math.abs(x - roadX(z)) < 1.6) { r = 0.78; g = 0.66; b = 0.5; }\n    { const ri = riverInfo(x, z); if (ri.d < ri.hw + 1.8) { r = 0.16; g = 0.42; b = 0.72; } else if (ri.d < ri.hw + 5) { r *= 0.8; g *= 0.88; } if (onDeck(x, z)) { r = 0.6; g = 0.5; b = 0.38; } }', 'world:map');
wor = tail(wor, 'export function sendTo(pt) {', P('w8_holder.txt'), 'world:holder');

// ---- main.js ----
main = once(main, "setMarkers, mulberry32, setVegDensity } from './world.js';", "setMarkers, mulberry32, setVegDensity, isWater, inHouse, wetness, riverPath, houseList, bridgeInfo, dryNear } from './world.js';", 'main:import');
main = once(main, "import * as I from './instrument.js';", "import * as I from './instrument.js';\nimport * as SM from './survey-math.js';", 'main:sm');
main = once(main, 'const wrapPi = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };', 'const wrapPi = SM.wrapPi;', 'main:wrap');
main = between(main, 'const dms = (rad, res = 5) =>', 'function showErr(m) {', 'const dms = SM.dms;\n\n', 'main:dms');
main = between(main, 'function ttCalc(r) {', 'function ttRender() {', P('m8_ttcalc.txt'), 'main:ttcalc');
main = between(main, 'function updK() {', "$('#btnTcRec').onclick = () => {", P('m8_updk.txt'), 'main:updk');
main = between(main, 'function randomJob(sd) {', '// ================= الكاميرا الخارجية =================', P('m8_job.txt'), 'main:job');
main = between(main, 'function drawMap() {', 'function renderPtBtns() {', P('m8_map.txt'), 'main:map');
// قراءة الميرا على طول الميرا (تأخذ الميلان في الحسبان)
main = once(main, 's.reading = h.point.y - gy - (ts ? 0 : I.staffZero());', 'const rdg = pt => face.worldToLocal(_t.copy(pt)).y + 2; s.reading = ts ? h.point.y - gy : rdg(h.point);', 'main:rd1');
main = once(main, 's.U = hu.point.y - gy - I.staffZero(); s.L = hl.point.y - gy - I.staffZero();', 's.U = rdg(hu.point); s.L = rdg(hl.point);', 'main:rd2');
main = once(main, 's.sr = hs_.point.y - gy - I.staffZero();', 's.sr = rdg(hs_.point);', 'main:rd3');
main = main.replace(/\s*$/, '\n') + "Object.assign(window.NIVO || (window.NIVO = {}), { toast, onJobChanged, placeInstrument });\n";

// ---- index.html ----
html = once(html, '<button data-mt="del">🗑 حذف</button>', '<button data-mt="move">✋ تحريك</button><button data-mt="pin">📌 تثبيت</button><button data-mt="del">🗑 حذف</button>', 'html:tools');
html = once(html, '<div class="row"><label>العدسة العينية</label>', P('h8_tilt.txt') + '<div class="row"><label>العدسة العينية</label>', 'html:tilt');
html = once(html, '<script type="module" src="/main.js"></script>', '<script type="module" src="/main.js"></script>\n<script type="module" src="/extras.js"></script>', 'html:extras');

if (fails.length) {
  console.log('✗ لم يُطبَّق التحديث ولم يتغيّر أي ملف. المشاكل:');
  fails.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
['main.js', 'index.html', 'world.js'].forEach(f => fs.copyFileSync(path.join(pub, f), path.join(pub, f + '.v7.bak')));
fs.writeFileSync(path.join(pub, 'main.js'), main);
fs.writeFileSync(path.join(pub, 'index.html'), html);
fs.writeFileSync(path.join(pub, 'world.js'), wor);
console.log('✓ تم التحديث (نسخ احتياطية: *.v7.bak). حدّث الصفحة ثم اضغط «🌍 عالم جديد» لترى النهر.');
