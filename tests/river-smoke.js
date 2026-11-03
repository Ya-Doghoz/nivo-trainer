// اختبار ظهور النهر: سطح الماء المرسوم يجب ألا يختفي تحت شبكة التضاريس (B-107).
// الاستعمال: node tests/river-smoke.js public/world.js
const fs = require('fs');
const file = process.argv[2] || 'public/world.js';
let src = fs.readFileSync(file, 'utf8');
src = src.split('\n').filter(l => !/^import /.test(l)).join('\n').replace(/\bexport (const|let|function|class)/g, '$1');
const U = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : k === 'length' ? 0 : U()), apply: () => U(), construct: () => U(), set: () => true });
const T = U();
class V3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; const self = new Proxy(this, { get: (t, k) => (k in t || typeof k === 'symbol' ? t[k] : () => self) }); return self; } clone() { return new V3(this.x, this.y, this.z); } multiplyScalar() { return this; } copy() { return this; } set() { return this; } }
const geoms = [];
class BufAttr { constructor(arr) { this.array = ArrayBuffer.isView(arr) ? arr : Float32Array.from(arr); this.needsUpdate = false; } }
class BufGeo { constructor() { this.attributes = {}; this.index = null; geoms.push(this); } setAttribute(n, a) { this.attributes[n] = a; return this; } setIndex(a) { this.index = Array.isArray(a) ? { array: Uint32Array.from(a) } : a; return this; } computeVertexNormals() { this.attributes.normal = new BufAttr(new Float32Array(this.attributes.position.array.length)); } }
const REAL = { Vector3: V3, BufferGeometry: BufGeo, Float32BufferAttribute: BufAttr, BufferAttribute: BufAttr };
const THREE = new Proxy(T, { get: (t, k) => (REAL[k] || T[k]) });
const body = `const window = { devicePixelRatio: 1, innerWidth: 800, innerHeight: 600, addEventListener(){} }; const document = { createElement: () => U(), getElementById: () => U(), querySelector: () => U(), body: U() }; const requestAnimationFrame = () => {};\n${src}\nreturn { regen, groundH, bridgeList, setWorldQuality: typeof setWorldQuality === 'function' ? setWorldQuality : undefined };`;
let api; try { api = new Function('THREE', 'U', body)(THREE, U); } catch (e) { console.log('FAIL تحميل world.js: ' + e.message); process.exit(1); }
let fails = 0; const P = m => console.log('PASS ' + m), F = m => { console.log('FAIL ' + m); fails++; };
for (const qual of api.setWorldQuality ? ['balanced', 'precise'] : ['balanced']) {
  if (api.setWorldQuality) api.setWorldQuality(qual);
  const cov = { near: [0, 0], far: [0, 0] };
  for (const sd of [11, 222, 3333, 44444, 555555, 7, 88, 999]) {
    geoms.length = 0; api.regen(sd);
    const bridges = api.bridgeList(), W = geoms.filter(g => g.attributes.position && g.attributes.uv && !g.attributes.color && g.index);
    W.forEach(g => {
      const p = g.attributes.position.array, ia = g.index.array, V = i => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
      for (let t = 0; t < ia.length; t += 3) {
        const A = V(ia[t]), B = V(ia[t + 1]), C = V(ia[t + 2]);
        for (const [a, b, c] of [[1, 1, 1], [2, 1, 0], [0, 2, 1], [1, 0, 2]]) {            // مركز المثلث + 3 نقاط على الأضلاع/الأطراف
          const w = a + b + c, x = (A[0] * a + B[0] * b + C[0] * c) / w, y = (A[1] * a + B[1] * b + C[1] * c) / w, z = (A[2] * a + B[2] * b + C[2] * c) / w;
          if (Math.abs(x) > 1100 || Math.abs(z) > 1100 || bridges.some(Bz => Math.hypot(x - Bz.x, z - Bz.z) < Bz.hl + 8)) continue;
          const tier = Math.max(Math.abs(x), Math.abs(z)) < 480 ? 'near' : 'far';
          cov[tier][1]++; if (y < api.groundH(x, z) - 0.03) cov[tier][0]++;
        }
      }
    });
  }
  const pc = k => (cov[k][1] ? 100 * cov[k][0] / cov[k][1] : 0);
  pc('near') < 3 && pc('far') < 3 && cov.near[1] + cov.far[1] > 500 ? P(`جودة ${qual}: سطح الماء ظاهر فوق الأرض (مغطّى قريباً ${pc('near').toFixed(1)}% · بعيداً ${pc('far').toFixed(1)}% من ${cov.near[1] + cov.far[1]} عيّنة)`) : F(`جودة ${qual}: النهر مغطّى بالتراب (قريباً ${pc('near').toFixed(1)}% · بعيداً ${pc('far').toFixed(1)}% من ${cov.near[1] + cov.far[1]} عيّنة)`);
}
if (api.setWorldQuality) api.setWorldQuality('balanced');
process.exit(fails ? 1 : 0);
