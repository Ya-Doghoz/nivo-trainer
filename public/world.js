import * as THREE from 'three';

const V3 = THREE.Vector3;
export const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('c'), antialias: (window.devicePixelRatio || 1) < 2.5, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
export function setQuality(pr) { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pr)); }

export const scene = new THREE.Scene();
const HOR = new THREE.Color(0xcfe3f2);
scene.background = HOR.clone();
scene.fog = new THREE.Fog(HOR, 140, 2400);
const hemi = new THREE.HemisphereLight(0xe8f3ff, 0x5b6b3a, 1.5); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d0, 2.4); sun.position.set(60, 90, 40); scene.add(sun);

// ---------- أدوات ----------
export function mulberry32(a) {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = (i, j) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 4; i++) { s += a * vnoise(x * f, z * f); f *= 2; a *= 0.5; } return s; }

export function cylBetween(a, b, r, mat, seg = 8) {
  const d = new V3().subVectors(b, a), L = d.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, seg), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
  return m;
}

// ---------- معاملات العالم (من البذرة) ----------
export let P = null;
export const roadX = z => P.roadC + P.roadA * Math.sin(z * P.roadF + P.rp);

function makeParams(seed) {
  const r = mulberry32(seed * 7919 + 13);
  const tod = ['morning', 'noon', 'noon', 'evening'][Math.floor(r() * 4)];
  const env = {
    morning: { top: 0x5b8fd0, hor: 0xf1dcc4, sun: 0xffd9a8, si: 2.0, el: [22, 38] },
    noon: { top: 0x2f6fc8, hor: 0xcfe3f2, sun: 0xfff0d0, si: 2.4, el: [55, 75] },
    evening: { top: 0x45589c, hor: 0xf4c8a2, sun: 0xffb877, si: 1.9, el: [12, 24] }
  }[tod];
  const dry = r(), biomes = dry > 0.62 ? ['steppe', 'steppe', 'orchard'] : ['meadow', 'pinewood', 'orchard', 'meadow'];
  const el = (env.el[0] + r() * (env.el[1] - env.el[0])) * Math.PI / 180, az = r() * Math.PI * 2;
  return {
    seed, tod, env, dry, biome: biomes[Math.floor(r() * biomes.length)],
    amp: 2.2 + r() * 2.0, f: 0.0055 + r() * 0.0035, amp2: 0.25 + r() * 0.3, ox: r() * 500, oz: r() * 500,
    tx: (r() - 0.5) * 0.05, tz: (r() - 0.5) * 0.05, rim: 14 + r() * 22,
    roadC: (r() < 0.5 ? -1 : 1) * (30 + r() * 40), roadA: 6 + r() * 10, roadF: 0.015 + r() * 0.02, rp: r() * 6.28,
    sunDir: new V3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)),
    clouds: 6 + Math.floor(r() * 14)
  };
}

// NIVO-V10 — خريطة 1000 م: تضاريس وعرة + نهر مرن + جسور متعددة + أبعاد البيوت
const WH = 500, TERH = 1160;
const ridge = (x, z) => 1 - Math.abs(2 * vnoise(x, z) - 1);

function baseH(x, z) {
  const rr = Math.hypot(x, z);
  const far = smooth(90, 230, rr), rel = 0.5 + 0.5 * far;
  const wx = x + 30 * (vnoise(x * 0.008 + P.ox, z * 0.008 + P.oz) - 0.5), wz = z + 30 * (vnoise(x * 0.008 + P.oz, z * 0.008 + P.ox) - 0.5);
  const big = (fbm(wx * P.f + P.ox, wz * P.f + P.oz) - 0.47) * 2 * P.amp;
  const rg = 1 - Math.abs(2 * vnoise(wx * 0.018 + P.ox * 2.1, wz * 0.018 + P.oz * 1.7) - 1);
  const mid = (rg * rg - 0.3) * P.amp2 * 1.6 + (fbm(x * 0.03 + P.ox * 3, z * 0.03 + P.oz * 3) - 0.47) * 0.35;
  let h = (big + mid) * rel + (P.tx * x + P.tz * z) * (0.35 + 0.65 * far);
  const tz = smooth(0.58, 0.72, vnoise(x * 0.005 + P.ox * 1.9, z * 0.005 + P.oz * 1.1)) * far;
  if (tz > 0) { const s = 1.0, k = h / s, f = k - Math.floor(k); h += ((Math.floor(k) + smooth(0.6, 1.0, f)) * s - h) * 0.6 * tz; }
  // وعورة: جبال وتلال وأودية عميقة بعيداً عن منطقة العمل وعن النهر (أرض لا تنفع فيها الميرا)
  const f2 = smooth(170, 480, rr) * (RV ? smooth(25, 220, rvDist(x, z)) : 1);
  if (f2 > 0) {
    const mk = smooth(0.46, 0.7, fbm(x * 0.0021 + P.ox * 0.7, z * 0.0021 + P.oz * 0.7));
    const rd = ridge(x * 0.0042 + P.ox, z * 0.0042 + P.oz), hl = (fbm(x * 0.009 + P.ox * 1.1, z * 0.009 + P.oz * 1.1) - 0.45) * 2;
    const gv = smooth(0.87, 0.985, ridge(x * 0.011 + P.ox * 2, z * 0.011 + P.oz * 3));
    h += f2 * (mk * (P.mtn || 60) * (rd * rd + 0.22 * hl) + (1 - mk) * 9 * hl - gv * (4 + 7 * mk));
  }
  const rim = smooth(620, 1020, rr);
  return h + rim * rim * P.rim * 3.2 * (0.6 + 0.8 * vnoise(x * 0.01 + 5, z * 0.01 + 9));
}

// ---------- النهر ----------
let RV = null, BRGS = [];
const rvCl = s => RV.off + RV.A1 * Math.sin(RV.k1 * s + RV.p1) + RV.A2 * Math.sin(RV.k2 * s + RV.p2);
const rvDcl = s => RV.A1 * RV.k1 * Math.cos(RV.k1 * s + RV.p1) + RV.A2 * RV.k2 * Math.cos(RV.k2 * s + RV.p2);
const rvHW = s => RV.w0 + RV.w1 * (vnoise(s * 0.02 + P.ox * 0.5, P.oz) - 0.5) * 2;
function rvDist(x, z) { const s = x * RV.dx + z * RV.dz, n = x * RV.nx + z * RV.nz, dc = rvDcl(s); return Math.abs(n - rvCl(s)) / Math.sqrt(1 + dc * dc); }
function wlAt(s) {
  const f = (s - RV.S0) / RV.ds, i = Math.max(0, Math.min(RV.wl.length - 2, Math.floor(f))), t = Math.max(0, Math.min(1, f - i));
  return RV.wl[i] * (1 - t) + RV.wl[i + 1] * t;
}
export function riverInfo(x, z) {
  if (!RV) return { d: 1e9, hw: 0, s: 0, wl: 0 };
  const s = x * RV.dx + z * RV.dz;
  return { d: rvDist(x, z), hw: rvHW(s), s, wl: wlAt(s) };
}
function makeRiver() {
  const r = mulberry32(P.seed * 101 + 77), ang = r() * Math.PI;
  P.mtn = 38 + 45 * r();
  RV = { dx: Math.cos(ang), dz: Math.sin(ang), nx: -Math.sin(ang), nz: Math.cos(ang), off: (r() - 0.5) * 680,
    A1: 40 + r() * 60, k1: 0.0035 + r() * 0.0035, p1: r() * 6.28, A2: 8 + r() * 14, k2: 0.018 + r() * 0.014, p2: r() * 6.28,
    w0: 3.4 + r() * 1.8, w1: 1.2, ds: 10, S0: -1300, wl: [], dir: 1 };
  // منسوب الماء: متوسط الأرض الأصلية على المجرى − 0.7 م، ويجري باتجاه انحدار الأرض
  const n = 261, raw = [];
  for (let i = 0; i < n; i++) { const s = RV.S0 + i * RV.ds, c = rvCl(s); raw.push(baseH(s * RV.dx + c * RV.nx, s * RV.dz + c * RV.nz)); }
  const q = Math.floor(n / 4), mean = (a, b) => { let t = 0; for (let i = a; i < b; i++) t += raw[i]; return t / (b - a); };
  RV.dir = mean(0, q) >= mean(n - q, n) ? 1 : -1;
  const avg = raw.map((_, i) => { let a = 0, k = 0; for (let j = Math.max(0, i - 8); j <= Math.min(n - 1, i + 8); j++) { a += raw[j]; k++; } return a / k; });
  const wl = new Array(n); let prev = Infinity;
  for (let t = 0; t < n; t++) { const i = RV.dir > 0 ? t : n - 1 - t; prev = Math.min(prev - 0.0006 * RV.ds, avg[i] - 0.7); wl[i] = prev; }
  RV.wl = wl;
  makeBridges();
}
// تحفير المجرى: قاع، ضفاف منحدرة، ثم انتقال تدريجي إلى الأرض المحيطة
function carve(h0, x, z) {
  const ri = riverInfo(x, z), d = ri.d, hw = ri.hw, BW = 9, FADE = 14;
  if (d > hw + BW + FADE) return h0;
  const wl = ri.wl;
  let target;
  if (d < hw) { const q = d / hw; target = wl - 0.2 - 0.9 * (1 - q * q); }
  else if (d < hw + BW) target = wl - 0.2 + 1.5 * smooth(0, 1, (d - hw) / BW);
  else target = wl + 1.3 + (d - hw - BW) * 0.02;
  const w = d < hw + BW ? 1 : 1 - smooth(hw + BW, hw + BW + FADE, d);
  return h0 + (target - h0) * w;
}
function terrainH(x, z) { const h0 = baseH(x, z); return RV ? carve(h0, x, z) : h0; }

// الجسور: عند كل تقاطع بين الطريق والنهر
function makeBridges() {
  BRGS = [];
  const cand = []; let grp = null;
  for (let z = -TERH + 40; z <= TERH - 40; z += 2) {
    const x = roadX(z), ri = riverInfo(x, z);
    if (ri.d < ri.hw + 6) { if (!grp || ri.d < grp.d) grp = { x, z, d: ri.d, hw: ri.hw }; }
    else if (grp) { cand.push(grp); grp = null; }
  }
  if (grp) cand.push(grp);
  cand.forEach(b => {
    if (b.d > b.hw + 1 || BRGS.some(o => Math.hypot(o.x - b.x, o.z - b.z) < 80)) return;
    const tx = roadX(b.z + 4) - roadX(b.z - 4), tz = 8, tl = Math.hypot(tx, tz), ux = tx / tl, uz = tz / tl;
    const ri = riverInfo(b.x, b.z), dc = rvDcl(ri.s);
    let rx = RV.dx + RV.nx * dc, rz = RV.dz + RV.nz * dc; const rl = Math.hypot(rx, rz); rx /= rl; rz /= rl;
    const cosf = Math.max(0.35, Math.abs(ux * -rz + uz * rx)), hl = (ri.hw + 6) / cosf + 3;
    const e1 = terrainH(b.x + ux * hl, b.z + uz * hl), e2 = terrainH(b.x - ux * hl, b.z - uz * hl);
    BRGS.push({ x: b.x, z: b.z, ux, uz, hl, hw: 2.1, y: Math.max(e1, e2, ri.wl + 1.1) + 0.12 });
  });
}
const onDeckOf = (B, x, z) => { const dx = x - B.x, dz = z - B.z; return Math.abs(dx * B.ux + dz * B.uz) <= B.hl && Math.abs(-dx * B.uz + dz * B.ux) <= B.hw; };
const deckAt = (x, z) => { for (const B of BRGS) if (onDeckOf(B, x, z)) return B; return null; };
const onDeck = (x, z) => !!deckAt(x, z);
// ارتفاع السطح الذي يقف عليه الجهاز/الميرا: الأرض أو سطح الجسر
export function groundH(x, z) {
  if (!P) return 0;
  const B = BRGS.length ? deckAt(x, z) : null;
  return B ? B.y : terrainH(x, z);
}
export const bridgeInfo = () => BRGS[0] || null;
export const bridgeList = () => BRGS;
export function isWater(x, z) { if (!RV) return false; const ri = riverInfo(x, z); return ri.d < ri.hw + 1.8 && !onDeck(x, z); }
const inRiver = (x, z, m = 0) => { if (!RV) return false; const ri = riverInfo(x, z); return ri.d < ri.hw + 1.8 + m; };
export function wetness(x, z) { if (!RV || onDeck(x, z)) return 0; const ri = riverInfo(x, z); return clamp(1 - (ri.d - ri.hw) / 16, 0, 1); }
const localDry = (x, z) => {
  if (!RV) return P.dry;
  const ri = riverInfo(x, z);
  return clamp(P.dry + (ri.d - 50) / 300 - 0.25 * clamp(1 - (ri.d - ri.hw) / 16, 0, 1), 0, 1);
};
export function inHouse(x, z) { return HOUSES.some(h => Math.hypot(x - h.x, z - h.z) < h.rad * 0.7); }
export function houseList() { return HOUSES.map(h => ({ x: h.x, z: h.z, w: h.rad, d: h.d, h: h.h, rot: h.rot })); }
// تصادم كرة نصف قطرها r مع مبنى (جدران + سقف هرمي): يعيد الموضع المُزاح والعمود على السطح
export function houseCollide(x, y, z, r = 0.8) {
  for (const h of HOUSES) {
    const dx = x - h.x, dz = z - h.z;
    if (dx * dx + dz * dz > (h.w * 0.9 + r) * (h.w * 0.9 + r)) continue;
    const ey = y - h.y0, top = h.h * 1.5;
    if (ey < -1 || ey > top + r) continue;
    const c = Math.cos(h.rot), s = Math.sin(h.rot), lx = dx * c - dz * s, lz = dx * s + dz * c;
    const body = ey <= h.h, k = body ? 1 : Math.max(0, 1 - (ey - h.h) / (h.h * 0.5));
    const hx = (body ? 0.5 : 0.55 * k) * h.w + r, hz = (body ? 0.4 : 0.44 * k) * h.w + r;
    if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) continue;
    const opts = [[hx - lx, 1, 0, 0], [hx + lx, -1, 0, 0], [hz - lz, 0, 0, 1], [hz + lz, 0, 0, -1], [top + r - ey, 0, 1, 0]];
    let b = opts[0]; for (const o of opts) if (o[0] < b[0]) b = o;
    const px = b[1] * b[0], pz = b[3] * b[0];
    return { x: x + px * c + pz * s, y: y + b[2] * b[0], z: z - px * s + pz * c, nx: b[1] * c + b[3] * s, ny: b[2], nz: -b[1] * s + b[3] * c };
  }
  return null;
}
export function riverPath() {
  if (!RV) return [];
  const o = [];
  for (let s = -1300; s <= 1300; s += 8) { const c = rvCl(s), x = s * RV.dx + c * RV.nx, z = s * RV.dz + c * RV.nz; if (Math.abs(x) < WH + 80 && Math.abs(z) < WH + 80) o.push({ x, z, hw: rvHW(s) + 1.8, s }); }
  return RV.dir > 0 ? o : o.reverse();      // بترتيب اتجاه الجريان
}
// أقرب موضع جاف (بعيد 6 م عن الماء وخارج المباني)
export function dryNear(x, z) {
  for (let rad = 0; rad < 260; rad += 3) for (let a = 0; a < 6.283; a += 0.7) {
    const px = Math.round(x + Math.cos(a) * rad), pz = Math.round(z + Math.sin(a) * rad), ri = riverInfo(px, pz);
    if (!isWater(px, pz) && !inHouse(px, pz) && ri.d > ri.hw + 6) return { x: px, z: pz };
  }
  return { x: Math.round(x), z: Math.round(z) };
}

// سطح الماء: شريط يتبع المجرى بشيدر (تموّج + وهج + خطوط جريان)
let waterMat = null;
(function tickWater(t) { if (waterMat) waterMat.uniforms.uTime.value = t / 1000; requestAnimationFrame(tickWater); })(0);
function buildRiver() {
  if (!RV) return;
  const step = 6, S0 = -1300, n = Math.floor(2600 / step) + 1, pos = [], uv = [], idx = [], inb = [];
  let acc = 0, px = null, pz = null;
  for (let i = 0; i < n; i++) {
    const s = S0 + i * step, c = rvCl(s), dc = rvDcl(s), cx = s * RV.dx + c * RV.nx, cz = s * RV.dz + c * RV.nz;
    let tx = RV.dx + RV.nx * dc, tz = RV.dz + RV.nz * dc; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
    const hw = rvHW(s) + 2.0, y = wlAt(s) - 0.05;
    if (px !== null) acc += Math.hypot(cx - px, cz - pz);
    px = cx; pz = cz;
    pos.push(cx + tz * hw, y, cz - tx * hw, cx - tz * hw, y, cz + tx * hw);
    uv.push(acc / 6, 0, acc / 6, 1);
    inb.push(Math.abs(cx) < TERH - 10 && Math.abs(cz) < TERH - 10);
    if (i > 0 && inb[i] && inb[i - 1]) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  if (RV.dir < 0) for (let i = 0; i < uv.length; i += 2) uv[i] = acc / 6 - uv[i];     // الجريان نحو -s
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  waterMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uSun: { value: P.sunDir.clone() }, uDeep: { value: new THREE.Color(0x174562) }, uShal: { value: new THREE.Color(0x3f8a8e) }, uHor: { value: HOR.clone() } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; varying float vD;
void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vD = distance(cameraPosition, vW); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uSun; uniform vec3 uDeep; uniform vec3 uShal; uniform vec3 uHor; varying vec2 vUv; varying vec3 vW; varying float vD;
void main(){
  float edge = 1.0 - abs(vUv.y * 2.0 - 1.0);
  vec3 base = mix(uShal, uDeep, smoothstep(0.0, 0.7, edge));
  float t = uTime;
  vec2 q = vec2(vUv.x * 14.0 - t * 1.1, vUv.y * 6.0);
  vec3 n = normalize(vec3(sin(q.x * 1.7 + q.y * 2.1) * 0.12 + sin(vW.x * 0.9 + t) * 0.04, 1.0, cos(q.x * 1.3 - q.y * 1.7) * 0.12 + cos(vW.z * 0.8 - t * 0.9) * 0.04));
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  vec3 sky = mix(uHor, vec3(0.45, 0.65, 0.95), 0.5);
  vec3 col = mix(base, sky, clamp(fres * 0.9 + 0.12, 0.0, 1.0));
  float glint = pow(max(dot(reflect(-uSun, n), V), 0.0), 90.0) * 2.0;
  float streak = smoothstep(0.82, 1.0, sin(q.x * 3.0 + sin(q.y * 4.0) * 1.3)) * 0.12;
  col += vec3(1.0, 0.95, 0.85) * (glint + streak);
  col = mix(col, uHor, smoothstep(300.0, 2200.0, vD));
  gl_FragColor = vec4(col, 0.82 + 0.1 * (1.0 - edge));
  #include <colorspace_fragment>
}`
  });
  const m = new THREE.Mesh(geo, waterMat); m.frustumCulled = false; m.renderOrder = 2; W.add(m);
  BRGS.forEach(B => {
    const g = new THREE.Group(), wood = new THREE.MeshLambertMaterial({ color: 0x8a6a45 }), stone = new THREE.MeshLambertMaterial({ color: 0x9a9a98 }), L2 = B.hl * 2;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(B.hw * 2, 0.36, L2), stone); deck.position.y = -0.18; g.add(deck);
    [-1, 1].forEach(sx => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, L2), wood); rail.position.set(sx * (B.hw - 0.1), 0.95, 0); g.add(rail);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, L2), stone); curb.position.set(sx * (B.hw - 0.12), 0.2, 0); g.add(curb);
      for (let z = -B.hl + 1; z <= B.hl - 0.5; z += 3) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), wood); post.position.set(sx * (B.hw - 0.1), 0.5, z); g.add(post); }
      const ab = new THREE.Mesh(new THREE.BoxGeometry(B.hw * 2, 2.6, 0.8), stone); ab.position.set(0, -1.5, sx * (B.hl - 0.5)); g.add(ab);
    });
    g.position.set(B.x, B.y, B.z); g.rotation.y = Math.atan2(B.ux, B.uz); W.add(g);
  });
}

// ---------- بناء العالم ----------
let W = null, mapCache = null;
function disposeGroup(g) {
  g.traverse(o => {
    if (o.isInstancedMesh) o.dispose();
    if (o.geometry) o.geometry.dispose();
    const m = o.material;
    if (m) (Array.isArray(m) ? m : [m]).forEach(mm => { if (mm.map) mm.map.dispose(); mm.dispose(); });
  });
  scene.remove(g);
}

export function regen(seed) {
  if (W) disposeGroup(W);
  W = new THREE.Group(); scene.add(W);
  P = makeParams(seed); mapCache = null; makeRiver();
  HOR.set(P.env.hor); scene.background.copy(HOR); scene.fog.color.copy(HOR);
  sun.color.set(P.env.sun); sun.intensity = P.env.si; sun.position.copy(P.sunDir).multiplyScalar(120);
  hemi.intensity = 1.2 + 0.3 * P.sunDir.y;
  buildSky(); buildMountains(); buildTerrain(); buildRiver(); buildVeg(); buildHouses();
  return P;
}

function buildSky() {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { top: { value: new THREE.Color(P.env.top) }, hor: { value: new THREE.Color(P.env.hor) }, sunDir: { value: P.sunDir.clone() } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; varying vec3 vP;
void main(){
  vec3 n = normalize(vP); float h = clamp(n.y, 0.0, 1.0);
  vec3 c = mix(hor, top, pow(h, 0.5));
  float s = max(dot(n, sunDir), 0.0);
  c += vec3(1.0, 0.92, 0.75) * (pow(s, 800.0) * 3.0 + pow(s, 14.0) * 0.18);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`
  }));
  sky.renderOrder = -10; sky.frustumCulled = false; W.add(sky);

  const r = mulberry32(P.seed * 3 + 1), cv = document.createElement('canvas'); cv.width = 128; cv.height = 64;
  const c = cv.getContext('2d');
  for (let i = 0; i < 7; i++) {
    const x = 24 + i * 13 + r() * 6, y = 34 + r() * 8, rad = 14 + r() * 12;
    const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill();
  }
  const ct = new THREE.CanvasTexture(cv); ct.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < P.clouds; i++) {
    const a = r() * 6.283, d = 1200 + r() * 1400;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
    s.position.set(Math.cos(a) * d, 320 + r() * 260, Math.sin(a) * d); s.scale.set(480 + r() * 340, 210 + r() * 110, 1);
    W.add(s);
  }
}

function buildMountains() {
  [[2300, 0.55, 0x5f7894, 3.4], [1900, 0.4, 0x4f6a85, 2.7]].forEach(([R, mix, col, hs], k) => {
    const geo = new THREE.CylinderGeometry(R, R, 1, 120, 1, true), pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) { const a = Math.atan2(pos.getZ(i), pos.getX(i)); pos.setY(i, (18 + 85 * Math.pow(fbm(Math.cos(a) * 2.4 + P.ox + k * 7, Math.sin(a) * 2.4 + P.oz + k * 3), 1.7)) * hs); }
      else pos.setY(i, -10);
    }
    geo.computeVertexNormals();
    const c = new THREE.Color(P.env.hor).lerp(new THREE.Color(col), mix);
    W.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, fog: false })));
  });
  const fl = new THREE.Mesh(new THREE.CircleGeometry(3300, 48), new THREE.MeshLambertMaterial({ color: 0x3e5a2f }));
  fl.rotation.x = -Math.PI / 2; fl.position.y = -6; W.add(fl);
}

// ثلاث طبقات من الشبكة: دقيقة قرب المركز، متوسطة، وخشنة بعيداً (مع تنانير لإخفاء الشقوق)
const PGc = [0.2, 0.43, 0.14], PDc = [0.56, 0.48, 0.27];
function terrainColor(x, z, h, slope, out) {
  const rr = Math.hypot(x, z), dry = localDry(x, z);
  const n = fbm(x * 0.08 + P.ox, z * 0.08 + P.oz), m = vnoise(x * 0.4, z * 0.4);
  let cr = PGc[0] + (PDc[0] - PGc[0]) * dry + 0.1 * n, cg = PGc[1] + (PDc[1] - PGc[1]) * dry + 0.18 * n + 0.04 * m, cb = PGc[2] + (PDc[2] - PGc[2]) * dry + 0.05 * n;
  const fk = smooth(0.62, 0.68, vnoise(x * 0.017 + P.ox * 3, z * 0.017 + P.oz * 3)) * (1 - smooth(0.04, 0.12, slope)) * (1 - smooth(25, 55, h));
  if (fk > 0) { const t = vnoise(x * 0.09, z * 0.09) > 0.5 ? 1 : 0.8; cr += (0.62 * t - cr) * fk * 0.8; cg += (0.55 * t - cg) * fk * 0.8; cb += (0.28 - cb) * fk * 0.8; }
  const rk = clamp((slope - 0.12) * 4, 0, 1);
  cr += (0.47 + 0.1 * m - cr) * rk; cg += (0.45 + 0.08 * m - cg) * rk; cb += (0.4 + 0.06 * m - cb) * rk;
  const hi = smooth((P.mtn || 60) * 0.7, (P.mtn || 60) * 1.15, h);
  if (hi > 0) { cr += (0.78 - cr) * hi * 0.6; cg += (0.79 - cg) * hi * 0.6; cb += (0.8 - cb) * hi * 0.6; }
  const ri_ = riverInfo(x, z), rd = ri_.d < ri_.hw + 2.5 ? 0 : 1 - smooth(1.8, 3.4, Math.abs(x - roadX(z)));
  cr += (0.62 - cr) * rd; cg += (0.52 - cg) * rd; cb += (0.38 - cb) * rd;
  const mud = ri_.d < ri_.hw + 1.8 ? 1 : 1 - smooth(ri_.hw + 1.8, ri_.hw + 7, ri_.d);
  if (mud > 0) { cr += (0.3 - cr) * mud * 0.85; cg += (0.27 - cg) * mud * 0.85; cb += (0.19 - cb) * mud * 0.85; }
  out[0] = cr; out[1] = cg; out[2] = cb;
}
function tierMesh(half, cell, hole, mat) {
  const N = Math.round(2 * half / cell), n1 = N + 1;
  const cellIn = (i, j) => {
    if (i < 0 || j < 0 || i >= N || j >= N) return false;
    if (!hole) return true;
    const cx = -half + (i + 0.5) * cell, cz = -half + (j + 0.5) * cell;
    return !(Math.abs(cx) < hole && Math.abs(cz) < hole);
  };
  const H = new Float32Array(n1 * n1).fill(NaN);
  const hAt = (i, j) => { i = Math.min(N, Math.max(0, i)); j = Math.min(N, Math.max(0, j)); const k = j * n1 + i; if (H[k] !== H[k]) H[k] = terrainH(-half + i * cell, -half + j * cell); return H[k]; };
  const map = new Int32Array(n1 * n1).fill(-1), vi = [], tri = [];
  const use = k => { if (map[k] < 0) { map[k] = vi.length; vi.push(k); } return map[k]; };
  const edges = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (!cellIn(i, j)) continue;
    const ka = j * n1 + i, kb = ka + 1, kc = ka + n1, kd = kc + 1, a = use(ka), b = use(kb), c = use(kc), d = use(kd);
    tri.push(a, c, b, b, c, d);
    if (!cellIn(i, j - 1)) edges.push(ka, kb);
    if (!cellIn(i, j + 1)) edges.push(kc, kd);
    if (!cellIn(i - 1, j)) edges.push(ka, kc);
    if (!cellIn(i + 1, j)) edges.push(kb, kd);
  }
  const nv = vi.length, pos = [], col = [], uv = [], tmp = [0, 0, 0], colOf = [];
  for (let q = 0; q < nv; q++) {
    const k = vi[q], i = k % n1, j = (k / n1) | 0, x = -half + i * cell, z = -half + j * cell, y = hAt(i, j);
    const slope = Math.hypot(hAt(i + 1, j) - y, hAt(i, j + 1) - y) / cell;
    terrainColor(x, z, y, slope, tmp);
    pos.push(x, y, z); col.push(tmp[0], tmp[1], tmp[2]); uv.push(x * 0.157, z * 0.157);
    colOf.push([tmp[0], tmp[1], tmp[2]]);
  }
  // تنانير على الحواف
  let base = nv;
  const skirt = (k1, k2) => {
    [k1, k2].forEach(k => { const q = map[k], c = colOf[q], x = pos[q * 3], y = pos[q * 3 + 1], z = pos[q * 3 + 2]; pos.push(x, y, z); col.push(c[0], c[1], c[2]); uv.push(x * 0.157, z * 0.157); });
    [k1, k2].forEach(k => { const q = map[k], c = colOf[q], x = pos[q * 3], y = pos[q * 3 + 1] - 3, z = pos[q * 3 + 2]; pos.push(x, y, z); col.push(c[0] * 0.8, c[1] * 0.8, c[2] * 0.8); uv.push(x * 0.157, z * 0.157); });
    tri.push(base, base + 1, base + 3, base, base + 3, base + 2); base += 4;
  };
  for (let e = 0; e < edges.length; e += 2) skirt(edges[e], edges[e + 1]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(new Uint32Array(tri), 1));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat); W.add(m);
}
function buildTerrain() {
  const r0 = mulberry32(P.seed * 5 + 9), cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const c = cv.getContext('2d'); c.fillStyle = '#e0e0e0'; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) { const v = 150 + Math.floor(r0() * 90); c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(r0() * 256, r0() * 256, 1 + r0() * 2, 2 + r0() * 4); }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex, side: THREE.DoubleSide });
  tierMesh(240, 2.4, 0, mat);
  tierMesh(480, 4, 240, mat);
  tierMesh(TERH, 20, 480, mat);
}

// نباتات ومنازل موزَّعة على كل الخريطة + إخلاء خطوط النظر ديناميكياً
let VEG = [], HOUSES = [];
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0);

export let vegK = 0.5;
export function setVegDensity(k) { vegK = k; }

function buildVeg() {
  VEG = [];
  const K = vegK, r = mulberry32(P.seed * 31 + 7), dummy = new THREE.Object3D(), c = new THREE.Color();
  const lam = () => new THREE.MeshLambertMaterial({ color: 0xffffff });
  const plain = (geo, mat, n) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; W.add(m); return m; };
  const reg = (geo, mat, n) => { const o = { mesh: plain(geo, mat, n), n: 0, max: n, xz: [], base: new Float32Array(n * 16), hid: new Uint8Array(n) }; VEG.push(o); return o; };
  const put = (o, x, z, rad) => {
    if (o.n >= o.max) return -1;
    dummy.updateMatrix(); dummy.matrix.toArray(o.base, o.n * 16); o.mesh.setMatrixAt(o.n, dummy.matrix); o.xz.push(x, z, rad);
    return o.n++;
  };
  const fin = o => { o.mesh.count = o.n; o.mesh.instanceMatrix.needsUpdate = true; if (o.mesh.instanceColor) o.mesh.instanceColor.needsUpdate = true; };
  const rndC = () => (r() - 0.5) * 540, rndF = () => (r() - 0.5) * 2 * (WH + 180);   // قرب المركز / على كامل الخريطة وما حولها
  const slopeAt = (x, z, gy) => Math.max(Math.abs(groundH(x + 3, z) - gy), Math.abs(groundH(x, z + 3) - gy)) / 3;

  // ---- أشجار: بقع غابات + أشجار منفردة + بساتين ----
  const trunkG = new THREE.CylinderGeometry(0.12, 0.2, 1, 6); trunkG.translate(0, 0.5, 0);
  const pineG = new THREE.ConeGeometry(1.2, 4.4, 7); pineG.translate(0, 2.2, 0);
  const roundG = new THREE.IcosahedronGeometry(1.5, 1), MAXT = 2400;
  const T0 = reg(trunkG, new THREE.MeshLambertMaterial({ color: 0x6b4a2b }), MAXT), T1 = reg(pineG, lam(), MAXT), T2 = reg(roundG, lam(), MAXT);
  const addTree = (x, z, kind, sc) => {
    if (T0.n >= MAXT || inRiver(x, z, 1.5)) return;
    const gy = groundH(x, z), pine = kind === 'pine', ol = kind === 'olive';
    dummy.rotation.set(0, r() * 6.28, 0);
    dummy.position.set(x, gy - 0.1, z); dummy.scale.set(sc, (pine ? 1.4 : 2.2) * sc, sc); put(T0, x, z, (pine ? 1.2 : 1.5) * sc);
    if (pine) {
      dummy.position.set(x, gy + 0.9 * sc, z); dummy.scale.set(sc, sc, sc);
      const k = put(T1, x, z, 1.2 * sc); if (k >= 0) { c.setHSL(0.33 + r() * 0.04, 0.45, 0.15 + r() * 0.08); T1.mesh.setColorAt(k, c); }
    } else {
      dummy.position.set(x, gy + (ol ? 1.9 : 2.9) * sc, z); dummy.scale.set(sc * (ol ? 0.9 : 1), sc * (ol ? 0.7 : 0.9), sc * (ol ? 0.9 : 1));
      const k = put(T2, x, z, 1.5 * sc);
      if (k >= 0) { const ld = localDry(x, z); if (ol) c.setHSL(0.22, 0.25, 0.38 + r() * 0.08); else c.setHSL(0.24 + r() * 0.08 - ld * 0.06, 0.5 - ld * 0.15, 0.26 + r() * 0.1); T2.mesh.setColorAt(k, c); }
    }
  };
  const thr = { pinewood: 0.5, meadow: 0.58, steppe: 0.66, orchard: 0.6 }[P.biome];
  const forest = (rnd, add, minR) => {
    const lim = T0.n + add;
    for (let i = 0; i < 90000 && T0.n < lim; i++) {
      const x = rnd(), z = rnd();
      if (Math.hypot(x, z) < minR || Math.abs(x - roadX(z)) < 6 || inRiver(x, z, 1.5)) continue;
      const gy = groundH(x, z);
      if (gy > (P.mtn || 60) * 0.75) continue;                                   // خط الأشجار
      const f = fbm(x * 0.011 + P.ox * 1.3, z * 0.011 + P.oz * 1.3) + wetness(x, z) * 0.3;
      if (f < thr || r() > Math.min(1, 0.15 + (f - thr) / 0.1)) continue;
      if (slopeAt(x, z, gy) > 0.9) continue;
      const pine = P.biome === 'pinewood' || gy > 25 ? r() < 0.8 : fbm(x * 0.02 + 3, z * 0.02) > 0.5 && P.dry < 0.6;
      addTree(x, z, pine ? 'pine' : 'round', 0.75 + r() * 0.7);
    }
  };
  forest(rndC, Math.round(300 * K), 55);
  forest(rndF, Math.round(1500 * K), 90);
  for (let i = 0, n = 0, lone = Math.round(40 * K); i < 6000 && n < lone; i++) {
    const x = rndF(), z = rndF();
    if (Math.hypot(x, z) < 40 || Math.abs(x - roadX(z)) < 6) continue;
    addTree(x, z, r() < 0.5 ? 'round' : 'pine', 0.9 + r() * 0.6); n++;
  }
  if (K >= 0.4) {
    const nOrch = (P.biome === 'orchard' ? 3 : 2);
    for (let k = 0; k < nOrch; k++) {
      const a = r() * 6.28, d = 70 + r() * 420, cx = Math.cos(a) * d, cz = Math.sin(a) * d, rot = r() * 3.14, cs = Math.cos(rot), sn = Math.sin(rot);
      if (slopeAt(cx, cz, groundH(cx, cz)) > 0.15) continue;
      for (let i = 0; i < 5; i++) for (let j = 0; j < 7; j++) { const px = (i - 2) * 7, pz = (j - 3) * 7; addTree(cx + px * cs - pz * sn, cz + px * sn + pz * cs, 'olive', 0.9 + r() * 0.2); }
    }
  }
  fin(T0); fin(T1); fin(T2);

  // ---- شجيرات وصخور (تُخلى حول النقاط) ----
  const bu = reg(new THREE.IcosahedronGeometry(0.5, 1), lam(), 1000);
  const bush = (rnd, add) => {
    const lim = bu.n + add;
    for (let i = 0; i < 20000 && bu.n < lim; i++) {
      const x = rnd(), z = rnd();
      if (Math.abs(x - roadX(z)) < 3.5 || inRiver(x, z, 0.5)) continue;
      if (fbm(x * 0.02 + P.ox, z * 0.02 + P.oz) + wetness(x, z) * 0.3 < 0.42 && r() > 0.2) continue;
      const sc = 0.5 + r() * 0.8, ld = localDry(x, z);
      dummy.position.set(x, groundH(x, z) + 0.25 * sc, z); dummy.rotation.set(0, r() * 6, 0); dummy.scale.set(sc * 1.2, sc * 0.8, sc * 1.2);
      const k = put(bu, x, z, 0.6 * sc); if (k >= 0) { c.setHSL(0.26 - ld * 0.08 + r() * 0.05, 0.45 - ld * 0.15, 0.2 + r() * 0.1); bu.mesh.setColorAt(k, c); }
    }
  };
  bush(rndC, Math.round(220 * K)); bush(rndF, Math.round(500 * K));
  fin(bu);
  const rk = reg(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0x8a8d90 }), 900);
  const rock = (rnd, add, k) => {
    const lim = rk.n + add;
    for (let i = 0; i < 20000 && rk.n < lim; i++) {
      const x = rnd(), z = rnd(), gy = groundH(x, z), sl = slopeAt(x, z, gy);
      if (r() > 0.2 + sl * k || inRiver(x, z, 0.5)) continue;
      const sc = 0.15 + r() * r() * (k > 9 ? 2.2 : 0.9);
      dummy.position.set(x, gy + sc * 0.2, z); dummy.rotation.set(r() * 3, r() * 3, r() * 3); dummy.scale.set(sc, sc * 0.6, sc * 0.9); put(rk, x, z, 0.8 * sc);
    }
  };
  rock(rndC, Math.round(60 + 90 * Math.min(K, 1.2)), 9); rock(rndF, Math.round(300 + 200 * Math.min(K, 1.2)), 14);
  fin(rk);

  // ---- أعشاب وأزهار قرب منطقة العمل (لا تحجب الرؤية) ----
  const tuftG = new THREE.ConeGeometry(0.07, 0.4, 4); tuftG.translate(0, 0.2, 0);
  const tf = plain(tuftG, lam(), 9000), nT = Math.round(5000 + 2500 * K); let nf = 0;
  for (let i = 0; i < 30000 && nf < nT; i++) {
    const x = rndC(), z = rndC();
    if (Math.abs(x - roadX(z)) < 2.5 || inRiver(x, z, 0.3)) continue;
    const sc = 0.6 + r() * 1.2, ld = localDry(x, z);
    dummy.position.set(x, groundH(x, z), z); dummy.rotation.set(0, r() * 6, 0); dummy.scale.set(sc, sc, sc); dummy.updateMatrix();
    tf.setMatrixAt(nf, dummy.matrix); c.setHSL(0.22 - ld * 0.06 + r() * 0.08, 0.5 - ld * 0.2, 0.25 + r() * 0.15); tf.setColorAt(nf++, c);
  }
  tf.count = nf; tf.instanceMatrix.needsUpdate = true; if (tf.instanceColor) tf.instanceColor.needsUpdate = true;
  if (P.dry < 0.7 && K > 0) {
    const fl = plain(new THREE.SphereGeometry(0.06, 5, 4), lam(), 1500), nFl = Math.round(700 * K); let nl = 0;
    const pal = [0xffffff, 0xffd84a, 0xc58bff, 0xff7a7a];
    for (let i = 0; i < 6000 && nl < nFl; i++) {
      const x = rndC(), z = rndC();
      if (Math.abs(x - roadX(z)) < 2.5 || inRiver(x, z, 0.3) || fbm(x * 0.03 + P.ox * 2, z * 0.03 + P.oz * 2) < 0.5) continue;
      dummy.position.set(x, groundH(x, z) + 0.22, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      fl.setMatrixAt(nl, dummy.matrix); c.setHex(pal[Math.floor(r() * 4)]); fl.setColorAt(nl++, c);
    }
    fl.count = nl; fl.instanceMatrix.needsUpdate = true; if (fl.instanceColor) fl.instanceColor.needsUpdate = true;
  }
  // ---- قصب على ضفاف النهر ----
  if (RV) {
    const re = reg(new THREE.ConeGeometry(0.05, 1.5, 4), lam(), 1600); re.mesh.geometry.translate(0, 0.75, 0);
    for (let i = 0; i < 40000 && re.n < Math.round(1300 * Math.min(1, K + 0.3)); i++) {
      const s = (r() - 0.5) * 1800, cl = rvCl(s), side = r() < 0.5 ? -1 : 1, off = rvHW(s) + 1.8 + (r() - 0.35) * 3.5;
      const dc = rvDcl(s), tl = Math.hypot(RV.dx + RV.nx * dc, RV.dz + RV.nz * dc), tx = (RV.dx + RV.nx * dc) / tl, tz = (RV.dz + RV.nz * dc) / tl;
      const x = s * RV.dx + cl * RV.nx - tz * side * off, z = s * RV.dz + cl * RV.nz + tx * side * off;
      if (Math.abs(x) > WH + 150 || Math.abs(z) > WH + 150) continue;
      const ri = riverInfo(x, z); if (ri.d < ri.hw + 1.0) continue;
      for (let q = 0; q < 3; q++) {
        const px = x + (r() - 0.5) * 0.8, pz = z + (r() - 0.5) * 0.8, sc = 0.6 + r() * 0.9;
        dummy.position.set(px, groundH(px, pz), pz); dummy.rotation.set((r() - 0.5) * 0.25, r() * 6, (r() - 0.5) * 0.25); dummy.scale.set(sc, sc, sc);
        const kk = put(re, px, pz, 0.3); if (kk >= 0) { c.setHSL(0.17 + r() * 0.06, 0.45, 0.3 + r() * 0.12); re.mesh.setColorAt(kk, c); }
      }
    }
    fin(re);
  }
  // ---- أعمدة كهرباء بمحاذاة الطريق ----
  const wood = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
  const pg = plain(new THREE.CylinderGeometry(0.09, 0.11, 8, 6), wood, 60), ca = plain(new THREE.BoxGeometry(2.2, 0.12, 0.12), wood, 60); let np = 0;
  for (let z = -WH - 100; z <= WH + 100 && np < 60; z += 45) {
    const x = roadX(z) + 4.5;
    if (inRiver(x, z, 4) || deckAt(x, z)) continue;
    dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.position.set(x, groundH(x, z) + 4, z); dummy.updateMatrix(); pg.setMatrixAt(np, dummy.matrix);
    dummy.position.y += 3.6; dummy.updateMatrix(); ca.setMatrixAt(np++, dummy.matrix);
  }
  pg.count = ca.count = np; pg.instanceMatrix.needsUpdate = true; ca.instanceMatrix.needsUpdate = true;
}

function buildHouses() {
  HOUSES = [];
  const r = mulberry32(P.seed * 17 + 3), taken = [];
  const house = (x, z) => {
    if (inRiver(x, z, 16) || Math.hypot(x, z) < 70 || Math.abs(x - roadX(z)) < 10) return false;
    if (taken.some(t => Math.hypot(t.x - x, t.z - z) < 16)) return false;
    const gy = groundH(x, z), sl = Math.max(Math.abs(groundH(x + 5, z) - gy), Math.abs(groundH(x - 5, z) - gy), Math.abs(groundH(x, z + 5) - gy), Math.abs(groundH(x, z - 5) - gy)) / 5;
    if (sl > 0.22) return false;
    const w = 6 + r() * 5, h = 3.5 + r() * 2, g = new THREE.Group(), rot = r() * 3;
    const wallM = new THREE.MeshLambertMaterial({ color: [0xd9c9a8, 0xe8e0d0, 0xcfc0a0, 0xe0d2b8][Math.floor(r() * 4)] });
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.8), wallM); wall.position.y = h / 2; g.add(wall);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.78, h * 0.5, 4), new THREE.MeshLambertMaterial({ color: r() < 0.5 ? 0x9a4a32 : 0x6e5a4a })); roof.rotation.y = Math.PI / 4; roof.position.y = h + h * 0.25; roof.scale.z = 0.8; g.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2, 0.1), new THREE.MeshLambertMaterial({ color: 0x5a3a22 })); door.position.set(0, 1, w * 0.4 + 0.02); g.add(door);
    const found = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 1.8, w * 0.82), new THREE.MeshLambertMaterial({ color: 0x8c8574 })); found.position.y = -0.8; g.add(found);
    g.position.set(x, gy, z); g.rotation.y = rot; W.add(g);
    HOUSES.push({ g, x, z, rad: w, w, d: w * 0.8, h, rot, y0: gy }); taken.push({ x, z });
    return true;
  };
  const nv = 3 + Math.floor(r() * 3);
  for (let v = 0; v < nv; v++) {
    const a = r() * 6.283, d = 140 + r() * 400, vx = Math.cos(a) * d, vz = Math.sin(a) * d, n = 3 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) for (let t = 0; t < 8; t++) if (house(vx + (r() - 0.5) * 80, vz + (r() - 0.5) * 80)) break;
  }
  for (let i = 0; i < 7; i++) for (let t = 0; t < 8; t++) { const a = r() * 6.283, d = 90 + r() * 480; if (house(Math.cos(a) * d, Math.sin(a) * d)) break; }
}

// إخفاء ما يحجب خطوط النظر بين مواضع الجهاز والنقاط، وما حول النقاط نفسها
export function clearVeg(points, setups) {
  const pts = points.concat(setups), segs = [], Z0 = new THREE.Matrix4().makeScale(0, 0, 0);
  points.forEach(p => setups.forEach(s => segs.push([s.x, s.z, p.x, p.z])));
  const sd = (x, z, s) => {
    const dx = s[2] - s[0], dz = s[3] - s[1], t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x - s[0] - t * dx, z - s[1] - t * dz);
  };
  const blocked = (x, z, rad) => pts.some(q => Math.hypot(x - q.x, z - q.z) < rad + 3.5) || segs.some(s => sd(x, z, s) < rad + 2.2);
  const m = new THREE.Matrix4();
  VEG.forEach(o => {
    let dirty = false;
    for (let i = 0; i < o.n; i++) {
      const hide = blocked(o.xz[i * 3], o.xz[i * 3 + 1], o.xz[i * 3 + 2]);
      if (hide !== !!o.hid[i]) { o.hid[i] = hide ? 1 : 0; o.mesh.setMatrixAt(i, hide ? Z0 : m.fromArray(o.base, i * 16)); dirty = true; }
    }
    if (dirty) o.mesh.instanceMatrix.needsUpdate = true;
  });
  HOUSES.forEach(h => { h.g.visible = true; });
}

// ---------- صورة الخريطة (كنتورية) ----------
export function mapImage(half = 120, res = 240) {
  if (mapCache && mapCache.seed === P.seed && mapCache.half === half && mapCache.res === res) return mapCache;
  const n = res + 2, step = 2 * half / res, hs = new Float32Array(n * n);
  let mn = 1e9, mx = -1e9;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const h = terrainH(-half + (i - 0.5) * step, -half + (j - 0.5) * step); hs[j * n + i] = h; if (h < mn) mn = h; if (h > mx) mx = h; }
  const range = Math.max(0.5, mx - mn), iv = range > 160 ? 10 : range > 80 ? 5 : range > 40 ? 2.5 : range > 14 ? 2 : range > 7 ? 1 : range > 3.5 ? 0.5 : 0.25;
  const cv = document.createElement('canvas'); cv.width = cv.height = res;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(res, res);
  for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const k = (j + 1) * n + (i + 1), h = hs[k], t = (h - mn) / range;
    const dx = (hs[k + 1] - hs[k - 1]) / (2 * step), dz = (hs[k + n] - hs[k - n]) / (2 * step);
    const sh = clamp((0.5 * dx + 0.7 + 0.5 * dz) / Math.sqrt(dx * dx + 1 + dz * dz) / 0.99 * 1.2, 0.45, 1.15);
    let r, g, b;
    if (t < 0.5) { const u = t / 0.5; r = 0.38 + 0.47 * u; g = 0.64 + 0.18 * u; b = 0.38 + 0.1 * u; }
    else { const u = (t - 0.5) / 0.5; r = 0.85 - 0.2 * u; g = 0.82 - 0.35 * u; b = 0.48 - 0.15 * u; }
    r *= sh; g *= sh; b *= sh;
    const x = -half + (i + 0.5) * step, z = -half + (j + 0.5) * step;
    if (Math.floor(h / iv) !== Math.floor(hs[k + 1] / iv) || Math.floor(h / iv) !== Math.floor(hs[k + n] / iv)) { r *= 0.55; g *= 0.55; b *= 0.55; }
    if (Math.abs(x - roadX(z)) < 1.6 + step * 0.3) { r = 0.78; g = 0.66; b = 0.5; }
    { const ri = riverInfo(x, z); if (ri.d < ri.hw + 1.8) { r = 0.16; g = 0.42; b = 0.72; } else if (ri.d < ri.hw + 5) { r *= 0.8; g *= 0.88; } if (onDeck(x, z)) { r = 0.6; g = 0.5; b = 0.38; } }
    const o = (j * res + i) * 4; img.data[o] = r * 255; img.data[o + 1] = g * 255; img.data[o + 2] = b * 255; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  mapCache = { canvas: cv, mn, mx, iv, half, res, seed: P.seed };
  return mapCache;
}

// ---------- تدريج الميرا ----------
function staffTexture(pattern, label) {
  const Wd = 144, H = 4000, PW = 76, cv = document.createElement('canvas'); cv.width = Wd; cv.height = H;
  const c = cv.getContext('2d'), Y = h => H - h * 1000;
  c.fillStyle = '#f6f3e6'; c.fillRect(0, 0, Wd, H);
  c.fillStyle = '#161616';
  for (let i = 0; i < 400; i += 2) c.fillRect(0, Y((i + 1) / 100), PW, 10);
  if (pattern === 'E') for (let k = 0; k < 80; k++) c.fillRect(k % 2 === 0 ? 0 : PW - 16, Y((5 * k + 5) / 100), 16, 50);
  else { c.fillStyle = '#c11'; for (let k = 0; k < 80; k++) c.fillRect(0, Y((5 * k + 5) / 100) - 1, PW, 3); }
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  const cx = PW + (Wd - PW) / 2;
  for (let n = 0; n < 40; n++) {
    const m = Math.floor(n / 10), d = n % 10, y0 = Y(n / 10);
    c.fillStyle = m % 2 === 1 ? '#d11' : '#111';
    if (label === 'dots') {
      c.font = 'bold 56px sans-serif'; c.fillText(String(d), cx, y0 - 12);
      for (let j = 0; j < m; j++) { c.beginPath(); c.arc(cx + (j - (m - 1) / 2) * 14, y0 - 80, 5, 0, 7); c.fill(); }
    } else if (n > 0 && label === 'pair') { c.font = 'bold 46px sans-serif'; c.fillText(`${m}${d}`, cx, y0 - 30); }
    else if (n > 0 && label === 'stack') { c.font = 'bold 40px sans-serif'; c.fillText(String(m), cx, y0 - 52); c.fillText(String(d), cx, y0 - 10); }
    else if (n > 0 && label === 'dec') { c.font = 'bold 38px sans-serif'; c.fillText(`${m},${d}`, cx, y0 - 30); }
    c.fillStyle = '#666'; c.fillRect(PW, y0 - 1, Wd - PW, 2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}

// ---------- علامات نقاط المهمة ----------
const markGroup = new THREE.Group(); scene.add(markGroup);
function makeLabel(txt, color) {
  const cv = document.createElement('canvas'); cv.width = 192; cv.height = 96;
  const c = cv.getContext('2d');
  c.fillStyle = color; c.beginPath(); c.roundRect ? c.roundRect(8, 8, 176, 80, 28) : c.rect(8, 8, 176, 80); c.fill();
  c.fillStyle = '#fff'; c.font = 'bold 54px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, 96, 52);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false })); s.scale.set(2.6, 1.3, 1);
  return s;
}
export function setMarkers(points, setups) {
  while (markGroup.children.length) {
    const o = markGroup.children.pop();
    if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
    if (o.geometry) o.geometry.dispose();
  }
  points.forEach(p => {
    const gy = groundH(p.x, p.z);
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 8), new THREE.MeshLambertMaterial({ color: p.bm ? 0x2ea043 : 0xdd2222 }));
    peg.position.set(p.x, gy + 0.06, p.z); markGroup.add(peg);
    const sp = makeLabel(p.id, p.bm ? '#2ea043' : '#e8402a'); sp.position.set(p.x, gy + 5.4, p.z); markGroup.add(sp);
  });
  setups.forEach(s => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.1, 24), new THREE.MeshBasicMaterial({ color: 0x4dabf7, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(s.x, groundH(s.x, s.z) + 0.05, s.z); markGroup.add(ring);
  });
  clearVeg(points, setups);
}

// ---------- الميرا + الشخص ----------
export const instPos = { x: 0, z: 0 };
export const holder = { group: new THREE.Group(), face: null, station: null, target: null, walking: false, legs: [], phase: 0 };
scene.add(holder.group);

export function setStaffStyle(pattern, label) {
  const m = holder.face.material;
  if (m.map) m.map.dispose();
  m.map = staffTexture(pattern, label); m.needsUpdate = true;
}

(function build() {
  const g = holder.group, L = c => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.152, 4, 0.022), L(0xb9bec6)); body.position.y = 2; g.add(body);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.144, 4), new THREE.MeshBasicMaterial({ map: staffTexture('E', 'dots') }));
  face.position.set(0, 2, 0.0115); g.add(face); holder.face = face;
  const Pn = new THREE.Group(); Pn.position.set(0, 0, -0.42); g.add(Pn);
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); Pn.add(m); return m; };
  for (const s of [-1, 1]) {
    const lg = new THREE.Group(); lg.position.set(s * 0.1, 0.92, 0); Pn.add(lg);
    const th = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.9, 10), L(0x2f4a7a)); th.position.y = -0.45; lg.add(th);
    const bt = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.26), L(0x222222)); bt.position.set(0, -0.9, 0.06); lg.add(bt);
    holder.legs.push(lg);
  }
  add(new THREE.BoxGeometry(0.42, 0.56, 0.24), L(0xff7a00), 0, 1.22, 0);
  add(new THREE.BoxGeometry(0.43, 0.05, 0.245), L(0xd6ff3a), 0, 1.3, 0);
  add(new THREE.SphereGeometry(0.11, 16, 12), L(0xe0b48a), 0, 1.66, 0);
  add(new THREE.SphereGeometry(0.125, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), L(0xffd21f), 0, 1.68, 0);
  add(new THREE.BoxGeometry(0.2, 0.015, 0.1), L(0xffd21f), 0, 1.68, 0.12);
  for (const s of [-1, 1]) {
    const sh = new V3(s * 0.25, 1.42, 0), hd = new V3(s * 0.125, 1.15, 0.4);
    Pn.add(cylBetween(sh, hd, 0.045, L(0xff7a00)));
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), L(0xe0b48a)); h.position.copy(hd); Pn.add(h);
  }
})();

export function faceInstrument() {
  if (holder.walking) return;
  const p = holder.group.position;
  holder.group.rotation.y = Math.atan2(instPos.x - p.x, instPos.z - p.z);
}
export function placeHolderAt(pt) {
  holder.group.position.set(pt.x, groundH(pt.x, pt.z), pt.z);
  holder.walking = false; holder.station = pt;
  holder.legs.forEach(l => (l.rotation.x = 0));
  faceInstrument();
}
const crossesWater = (x0, z0, x1, z1) => { for (let t = 0; t <= 1; t += 0.02) if (isWater(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return true; return false; };
function planRoute(x0, z0, x1, z1) {
  if (!BRGS.length || !crossesWater(x0, z0, x1, z1)) return [];
  let best = null;
  for (const B of BRGS) {
    const e = B.hl + 1.5, a = { x: B.x - B.ux * e, z: B.z - B.uz * e }, b = { x: B.x + B.ux * e, z: B.z + B.uz * e };
    const d1 = Math.hypot(x0 - a.x, z0 - a.z) + Math.hypot(x1 - b.x, z1 - b.z), d2 = Math.hypot(x0 - b.x, z0 - b.z) + Math.hypot(x1 - a.x, z1 - a.z);
    const dd = Math.min(d1, d2) + 2 * e;
    if (!best || dd < best.dd) best = { dd, pts: d1 <= d2 ? [a, b] : [b, a] };
  }
  return best.pts;
}
export function sendTo(pt) {
  if (!pt || holder.walking || (holder.station && holder.station.id === pt.id)) return false;
  const g = holder.group.position;
  holder.route = planRoute(g.x, g.z, pt.x, pt.z);   // يعبر النهر عبر أقرب جسر مناسب
  holder.target = pt; holder.walking = true; holder.station = null;
  return true;
}
export function updateHolder(dt) {
  if (!holder.walking) return;
  const g = holder.group, wp = holder.route && holder.route.length ? holder.route[0] : null, t = wp || holder.target;
  const dx = t.x - g.position.x, dz = t.z - g.position.z, d = Math.hypot(dx, dz);
  if (d < 0.2) { if (wp) { holder.route.shift(); return; } placeHolderAt(holder.target); return; }
  const k = Math.min(3.2 * dt, d) / d;
  g.position.x += dx * k; g.position.z += dz * k;
  g.position.y = groundH(g.position.x, g.position.z);
  g.rotation.y = Math.atan2(dx, dz);
  holder.phase += dt * 9;
  holder.legs[0].rotation.x = Math.sin(holder.phase) * 0.6;
  holder.legs[1].rotation.x = -Math.sin(holder.phase) * 0.6;
}

// NIVO-V10
