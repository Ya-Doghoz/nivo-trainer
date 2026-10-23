// اختبار دخان للعالم: يشغّل world.js بمجسّمات وهمية لـ THREE (بلا متصفح ولا GPU)
// الاستعمال: node tests/world-smoke.js public/world.js
const fs = require('fs');
const file = process.argv[2] || 'public/world.js';
let src = fs.readFileSync(file, 'utf8');
src = src.split('\n').filter(l => !/^import /.test(l)).join('\n').replace(/\bexport (const|let|function|class)/g, '$1');
const U = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : U()), apply: () => U(), construct: () => U(), set: () => true });
const T = U();
class V3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; const self = new Proxy(this, { get: (t, k) => (k in t || typeof k === 'symbol' ? t[k] : () => self) }); return self; }
  clone() { return new V3(this.x, this.y, this.z); } multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this; } copy(o) { this.x = o.x; this.y = o.y; this.z = o.z; return this; } set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
}
const THREE = new Proxy(T, { get: (t, k) => (k === 'Vector3' ? V3 : T[k]) });
const doc = { createElement: () => U(), getElementById: () => U(), querySelector: () => U(), body: U() };
const names = ['regen', 'mapImage', 'groundH', 'isWater', 'riverInfo', 'houseCollide', 'bridgeList', 'riverPath', 'houseList', 'inHouse', 'dryNear'];
const body = `const window = { devicePixelRatio: 1, innerWidth: 800, innerHeight: 600, addEventListener(){} }; const document = DOC; const requestAnimationFrame = () => {};\n${src}\nreturn { ${names.map(n => `${n}: typeof ${n} === 'function' ? ${n} : undefined`).join(', ')}, getHouses: () => HOUSES };`;
let api;
try { api = new Function('THREE', 'DOC', body)(THREE, doc); } catch (e) { console.log('FAIL تحميل world.js: ' + e.message); process.exit(1); }
const P = m => console.log('PASS ' + m), F = m => { console.log('FAIL ' + m); fails++; }, W = m => console.log('WARN ' + m);
let fails = 0;
const q = (a, p) => { a = a.slice().sort((x, y) => x - y); return a[Math.floor(a.length * p)]; };

for (const sd of [11, 222, 3333, 44444, 555555]) {
  try {
    const t0 = Date.now(); api.regen(sd); const ms = Date.now() - t0;
    ms < 8000 ? P(`regen(${sd}) بلا أخطاء (${ms} م.ث بمجسّمات)`) : W(`regen(${sd}) بطيء: ${ms} م.ث`);
    let nan = 0; const slopes = []; let hmax = 0;
    for (let k = 0; k < 300; k++) {
      const a = Math.random() * 6.283, d = Math.random() * 85, x = Math.cos(a) * d, z = Math.sin(a) * d, h = api.groundH(x, z);
      if (api.riverInfo) { const ri = api.riverInfo(x, z); if (ri.d < ri.hw + 30) continue; }      // ضفاف النهر منحدرة بطبيعتها
      if (!isFinite(h)) nan++; hmax = Math.max(hmax, Math.abs(h));
      slopes.push(Math.hypot(api.groundH(x + 3, z) - h, api.groundH(x, z + 3) - h) / 3);
    }
    nan ? F(`seed ${sd}: قيم غير منتهية في groundH (${nan})`) : P(`seed ${sd}: groundH منتهٍ دائماً`);
    q(slopes, 0.95) < 0.15 && hmax < 8 ? P(`seed ${sd}: منطقة العمل هادئة (ميل p95=${q(slopes, 0.95).toFixed(3)}, أعلى ارتفاع ${hmax.toFixed(1)} م)`) : F(`seed ${sd}: منطقة العمل وعرة (ميل p95=${q(slopes, 0.95).toFixed(3)}, ارتفاع ${hmax.toFixed(1)})`);
    const h1 = api.groundH(40, -25); api.regen(sd); api.groundH(40, -25) === h1 ? P(`seed ${sd}: توليد حتمي (نفس البذرة = نفس الأرض)`) : F(`seed ${sd}: التوليد غير حتمي`);
    const mi = api.mapImage(500, 64); mi ? P(`seed ${sd}: mapImage تعمل`) : F(`seed ${sd}: mapImage فشلت`);
    if (api.riverPath) { api.riverPath().length > 5 ? P(`seed ${sd}: النهر موجود (${api.riverPath().length} نقطة)`) : W(`seed ${sd}: لا نهر داخل الخريطة`); }
    if (api.houseCollide) {
      const H = api.getHouses();
      if (H.length) {
        const h = H[0], c = api.houseCollide(h.x, h.y0 + 1.5, h.z, 0.8), far = api.houseCollide(h.x + 80, h.y0 + 1.5, h.z, 0.8);
        c && !far ? P(`seed ${sd}: تصادم المبنى يدفع من الداخل ولا يلمس الخارج (${H.length} بيت)`) : F(`seed ${sd}: تصادم المبنى معطوب`);
      } else W(`seed ${sd}: لا بيوت`);
    }
  } catch (e) { F(`seed ${sd}: استثناء ${e.message}`); }
}
process.exit(fails ? 1 : 0);
