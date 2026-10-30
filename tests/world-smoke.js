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
const geoms = [];
class BufAttr { constructor(arr) { this.array = ArrayBuffer.isView(arr) ? arr : Float32Array.from(arr); this.needsUpdate = false; } }
class BufGeo { constructor() { this.attributes = {}; this.index = null; geoms.push(this); } setAttribute(n, a) { this.attributes[n] = a; return this; } setIndex(a) { this.index = Array.isArray(a) ? { array: Uint32Array.from(a) } : a; return this; } computeVertexNormals() { this.attributes.normal = new BufAttr(new Float32Array(this.attributes.position.array.length)); } }
const REAL_CLASSES = { Vector3: V3, BufferGeometry: BufGeo, Float32BufferAttribute: BufAttr, BufferAttribute: BufAttr };
const THREE = new Proxy(T, { get: (t, k) => (REAL_CLASSES[k] || T[k]) });
const doc = { createElement: () => U(), getElementById: () => U(), querySelector: () => U(), body: U() };
const names = ['regen', 'mapImage', 'groundH', 'terrainH', 'setWorldQuality', 'isWater', 'riverInfo', 'houseCollide', 'bridgeList', 'riverPath', 'houseList', 'inHouse', 'dryNear'];
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

// --- B-100/B-104: قرص الأرضية تحت التضريس + استمرار السطح عبر حدود الطبقات (لا خط ولا اختراق) ---
if (api.terrainH) {
  const rawSrc = fs.readFileSync(file, 'utf8'), fm = /fl\.position\.y = (-?\d+)/.exec(rawSrc);
  const sweep = quality => {
    if (api.setWorldQuality) api.setWorldQuality(quality);
    let minH = 1e9; const jumps = [];
    for (const sd of [11, 3333, 555555]) {
      api.regen(sd);
      for (let k = 0; k < 1500; k++) minH = Math.min(minH, api.groundH((Math.random() - 0.5) * 2300, (Math.random() - 0.5) * 2300));
      for (const B of [240, 480]) for (let k = 0; k < 150; k++) { const t = (Math.random() - 0.5) * 2 * (B - 1); jumps.push(Math.abs(api.groundH(B - 0.05, t) - api.groundH(B + 0.05, t)), Math.abs(api.groundH(t, B - 0.05) - api.groundH(t, B + 0.05))); }
    }
    return { minH, p95: q(jumps, 0.95), max: Math.max(...jumps) };
  };
  for (const qual of api.setWorldQuality ? ['balanced', 'precise'] : ['balanced']) {
    try {
      const r = sweep(qual);
      fm && +fm[1] < r.minH - 10 ? P(`جودة ${qual}: قرص الأرضية (${fm[1]} م) تحت أخفض أرض (${r.minH.toFixed(1)} م)`) : F(`جودة ${qual}: قرص الأرضية يحجب التضريس (قرص ${fm ? fm[1] : '؟'} م، أخفض أرض ${r.minH.toFixed(1)} م)`);
      r.p95 < 0.15 ? P(`جودة ${qual}: السطح متصل عبر حدود الطبقات 240/480 م (p95=${r.p95.toFixed(3)} م، أقصى ${r.max.toFixed(2)} م)`) : F(`جودة ${qual}: قفزة في السطح عند حدود الطبقات (p95=${r.p95.toFixed(2)} م) — خط ظاهر/اختراق`);
    } catch (e) { F(`جودة ${qual}: استثناء ${e.message}`); }
  }
  if (api.setWorldQuality) api.setWorldQuality('balanced');
}

// --- B-104: الفيزياء (groundH) تساوي الشبكة المرسومة فعلاً: لا اختراق للأرض ولا طفو ---
if (api.terrainH) {
  const meshTest = quality => {
    if (api.setWorldQuality) api.setWorldQuality(quality);
    geoms.length = 0; api.regen(11);
    const tiers = geoms.filter(g => g.attributes.position && g.attributes.color && g.attributes.position.array.length > 3 * 5000 && g.index).map(g => {
      const pa = g.attributes.position.array, nv = (() => { let n = 0; for (let i = 0; i < g.index.array.length; i++) n = Math.max(n, g.index.array[i]); return n + 1; })();
      const map = new Map(), key = (x, z) => Math.round(x * 100) + ',' + Math.round(z * 100); let x0 = 1e9, z0 = 1e9, c = 1e9;
      const xs = new Set(); for (let v = 0; v < Math.min(nv, 3000); v++) xs.add(Math.round(pa[v * 3] * 1000));
      const xsa = [...xs].sort((a, b) => a - b); for (let i = 1; i < xsa.length; i++) c = Math.min(c, (xsa[i] - xsa[i - 1]) / 1000);
      for (let v = 0; v < nv; v++) { map.set(key(pa[v * 3], pa[v * 3 + 2]), v); x0 = Math.min(x0, pa[v * 3]); z0 = Math.min(z0, pa[v * 3 + 2]); }
      const vt = new Map(), ia = g.index.array; for (let t = 0; t < ia.length; t += 3) for (let k = 0; k < 3; k++) { const v = ia[t + k]; if (v < nv) (vt.get(v) || vt.set(v, []).get(v)).push(t); }
      return { pa, map, key, x0, z0, c, vt, ia };
    });
    const meshAt = (x, z) => {
      for (const G of tiers) {
        const X0 = G.x0 + Math.floor((x - G.x0) / G.c + 1e-9) * G.c, Z0 = G.z0 + Math.floor((z - G.z0) / G.c + 1e-9) * G.c;
        const ks = [[X0, Z0], [X0 + G.c, Z0], [X0, Z0 + G.c], [X0 + G.c, Z0 + G.c]].map(([a, b]) => G.map.get(G.key(a, b)));
        if (ks.some(v => v === undefined)) continue;
        for (const t of G.vt.get(ks[0]) || []) for (const t2 of [t]) {
          const tri = [G.ia[t2], G.ia[t2 + 1], G.ia[t2 + 2]]; if (!tri.every(v => ks.includes(v))) continue;
          const P3 = tri.map(v => [G.pa[v * 3], G.pa[v * 3 + 1], G.pa[v * 3 + 2]]), [A, B, C] = P3;
          const d = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]), l1 = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / d, l2 = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / d, l3 = 1 - l1 - l2;
          if (l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6) return l1 * A[1] + l2 * B[1] + l3 * C[1];
        }
        for (const v of ks.slice(1)) for (const t of G.vt.get(v) || []) {
          const tri = [G.ia[t], G.ia[t + 1], G.ia[t + 2]]; if (!tri.every(w => ks.includes(w))) continue;
          const [A, B, C] = tri.map(w => [G.pa[w * 3], G.pa[w * 3 + 1], G.pa[w * 3 + 2]]);
          const d = (B[2] - C[2]) * (A[0] - C[0]) + (C[0] - B[0]) * (A[2] - C[2]), l1 = ((B[2] - C[2]) * (x - C[0]) + (C[0] - B[0]) * (z - C[2])) / d, l2 = ((C[2] - A[2]) * (x - C[0]) + (A[0] - C[0]) * (z - C[2])) / d, l3 = 1 - l1 - l2;
          if (l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6) return l1 * A[1] + l2 * B[1] + l3 * C[1];
        }
      }
      return null;
    };
    const bridges = api.bridgeList ? api.bridgeList() : [];
    let worst = 0, n = 0, miss = 0;
    for (let k = 0; k < 600; k++) {
      const x = (Math.random() - 0.5) * 2200, z = (Math.random() - 0.5) * 2200;
      if (bridges.some(B => Math.hypot(x - B.x, z - B.z) < B.hl + 6)) continue;
      const mh = meshAt(x, z); if (mh === null) { miss++; continue; }
      worst = Math.max(worst, Math.abs(mh - api.groundH(x, z))); n++;
    }
    return { worst, n, miss, tiers: tiers.length };
  };
  for (const qual of api.setWorldQuality ? ['balanced', 'precise'] : ['balanced']) {
    try {
      const r = meshTest(qual);
      r.tiers >= 3 && r.n > 200 && r.worst < 0.01 ? P(`جودة ${qual}: groundH تطابق الشبكة المرسومة (أقصى فرق ${r.worst.toFixed(4)} م على ${r.n} نقطة)`) : F(`جودة ${qual}: groundH لا تطابق الشبكة المرسومة (أقصى فرق ${r.worst.toFixed(2)} م، طبقات ${r.tiers}، نقاط ${r.n}، مفقودة ${r.miss}) — اختراق/طفو`);
    } catch (e) { F(`جودة ${qual}: استثناء في اختبار الشبكة ${e.message}`); }
  }
  if (api.setWorldQuality) api.setWorldQuality('balanced');
}
process.exit(fails ? 1 : 0);
