import * as THREE from 'three';
import { scene, groundH, mulberry32, renderer } from './world.js';

const V3 = THREE.Vector3, UP = new V3(0, 1, 0), TAU = Math.PI * 2, SEC = Math.PI / 648000;
export const R = 0.045, PITCH = 0.0005, EMAX = 0.015, S0 = 0.03, RH = 0.08;
// ring = حدّ "مُسوّى" (بالدقيقة القوسية)، comp = مدى المعوّض، vial = مدى عرض الفقاعة
export const TYPES = {
  level: { name: 'النيفو', trunH: 0.135, ring: 5, comp: 10, vial: 30 },
  theo: { name: 'التيودوليت', trunH: 0.19, ring: 0.5, comp: 0, vial: 4 },
  tach: { name: 'التاكيومتر اليدوي', trunH: 0.19, ring: 0.5, comp: 0, vial: 4 },
  ts: { name: 'التاكيومتر الآلي', trunH: 0.19, ring: 1, comp: 3, vial: 6 }
};
export let type = 'level';
export const TY = () => TYPES[type];
export const SCREWS = [
  { n: 'A', x: -0.866 * R, z: 0.5 * R },
  { n: 'B', x: 0.866 * R, z: 0.5 * R },
  { n: 'C', x: 0, z: -R }
];
export const LEGA = [0, 1, 2].map(i => Math.PI / 2 + i * 2 * Math.PI / 3);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- أخطاء الجهاز (مخفية وثابتة لكل بذرة وجهاز) ----------
export const ERR = { on: true, k: 1, v: {} };
export function setErrors(on, k, sd) {
  ERR.on = !!on; ERR.k = k || 1;
  const r = mulberry32((sd || 1) * 977 + 31), pick = mag => (r() < 0.5 ? -1 : 1) * (0.4 + 0.6 * r()) * mag;
  ERR.v = {
    level: { c: pick(12) },
    theo: { c: pick(8), i: pick(8), t: pick(6) },
    tach: { c: pick(20), i: pick(20), t: pick(12) },
    ts: { c: pick(4), i: pick(4), t: pick(3), edm0: pick(2.5) / 1000, ppm: pick(2) },
    staff: pick(3) / 1000
  };
}
const ev = key => (ERR.on && ERR.v[type] ? (ERR.v[type][key] || 0) * ERR.k : 0);
export const errArc = key => ev(key);
export const staffZero = () => (ERR.on ? ERR.v.staff * ERR.k : 0);
export const edmErr = () => ({ zero: ev('edm0'), ppm: ev('ppm') });
export function errReport() {
  if (!ERR.on) return ['محاكاة الأخطاء متوقفة.'];
  const v = ERR.v[type] || {}, k = ERR.k, L = [];
  if (type === 'level') {
    L.push(`خطأ خط النظر (collimation) = ${(v.c * k).toFixed(1)}″ ← ${(v.c * k * SEC * 30 * 1000).toFixed(1)} مم عند 30 م`);
    L.push('بقايا المعوّض ≈ 2% من الميلان على محور النظر');
  } else {
    L.push(`خطأ الفهرس الرأسي i = ${(v.i * k).toFixed(1)}″`, `خطأ انحراف خط النظر c = ${(v.c * k).toFixed(1)}″`, `خطأ المحور الأفقي (trunnion) = ${(v.t * k).toFixed(1)}″`);
    if (type === 'ts') L.push(`ثابت EDM = ${(v.edm0 * k * 1000).toFixed(1)} مم، معامل المقياس = ${(v.ppm * k).toFixed(1)} ppm`);
  }
  if (type !== 'ts') L.push(`خطأ صفر الميرا = ${(ERR.v.staff * k * 1000).toFixed(1)} مم`);
  return L;
}
setErrors(true, 1, 1);

const std = (c, r = 0.5, m = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const M = {
  yellow: std(0xf0b400), dark: std(0x2a2a2e, 0.7, 0), silver: std(0xc4c9cf, 0.35, 0.4), steel: std(0x8d949c, 0.4, 0.4),
  wood: std(0xc08a45, 0.8, 0), red: std(0xdd2222, 0.6, 0), bub: std(0xe8ffff, 0.2, 0), rubber: std(0x151515, 0.9, 0),
  thBody: std(0xd9dee6, 0.42, 0.15), thAcc: std(0x2f6fed, 0.4, 0.2),
  tcBody: std(0x5e7160, 0.5, 0.15), tcAcc: std(0xb4925a, 0.35, 0.5),
  tsBody: std(0xeef0f3, 0.4, 0.1), tsAcc: std(0xff7a00, 0.45, 0.1),
  glass: new THREE.MeshPhongMaterial({ color: 0x66b6ff, transparent: true, opacity: 0.45, shininess: 90 }),
  lens: new THREE.MeshPhongMaterial({ color: 0x4f8fe8, transparent: true, opacity: 0.6, shininess: 120, specular: 0xffffff }),
  mirror: new THREE.MeshPhongMaterial({ color: 0xe6f1fb, specular: 0xffffff, shininess: 250, side: THREE.DoubleSide }),
  darkD: std(0x2a2a2e, 0.7, 0)
};
M.darkD.side = THREE.DoubleSide;
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
const cyl = (r, h, seg = 24, r2 = r) => new THREE.CylinderGeometry(r, r2, h, seg);
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const rz = m => { m.rotation.x = Math.PI / 2; return m; };

export const st = {
  H: 1.75, leg: [0, 0, 0], legLock: [false, false, false], e: [EMAX / 2, EMAX / 2, EMAX / 2],
  heading: 0, vz: Math.PI / 2, hz0: 0, idx: 0, explode: 0, exTarget: 0, mounted: false, clamp: false, clampV: false, tx: 0, tz: 0, Hc: 1.75
};

function headState() {
  let sx = 0, sz = 0, sy = 0;
  for (let i = 0; i < 3; i++) { const y = st.H + st.leg[i]; sx += y * RH * Math.cos(LEGA[i]); sz += y * RH * Math.sin(LEGA[i]); sy += y; }
  st.tx = 2 * sx / (3 * RH * RH); st.tz = 2 * sz / (3 * RH * RH); st.Hc = sy / 3;
  return st;
}
export const headTiltDeg = () => Math.atan(Math.hypot(st.tx, st.tz)) * 180 / Math.PI;

const rig = new THREE.Group(); scene.add(rig);
export const rigPos = rig.position;
const tripod = new THREE.Group(), headG = new THREE.Group(), instRoot = new THREE.Group(), rotating = new THREE.Group();
rig.add(tripod, headG, instRoot); instRoot.add(rotating);
const tripAnchor = new THREE.Object3D(); rig.add(tripAnchor);
const blob = new THREE.Mesh(new THREE.CircleGeometry(1.0, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
rig.add(blob);

function numSprite(n, col) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d');
  c.fillStyle = col; c.beginPath(); c.arc(32, 32, 29, 0, 7); c.fill();
  c.fillStyle = '#000'; c.font = 'bold 38px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(n), 32, 35);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false })); s.scale.set(0.16, 0.16, 1); s.renderOrder = 5;
  return s;
}
const LCOL = ['#ff6b6b', '#51cf66', '#4dabf7'];

// ---------- أرجل الحامل ----------
const FEET = LEGA.map(a => new V3(0.72 * Math.cos(a), 0.03, 0.72 * Math.sin(a)));
const legs = FEET.map((F, i) => {
  const up = mesh(cyl(0.03, 1, 10), M.wood), lo = mesh(cyl(0.022, 1, 10), M.steel);
  const collar = new THREE.Group(); collar.add(mesh(cyl(0.04, 0.08, 12), M.dark));
  const lever = new THREE.Group(); lever.position.set(0.04, 0, 0); lever.add(mesh(box(0.06, 0.014, 0.024), M.red, 0.03, 0, 0)); collar.add(lever);
  const shoe = mesh(new THREE.ConeGeometry(0.035, 0.1, 8), M.silver); shoe.rotation.x = Math.PI;
  const num = numSprite(i + 1, LCOL[i]);
  tripod.add(up, lo, collar, shoe, num);
  return { up, lo, collar, lever, shoe, num };
});
const _A = new V3(), _P = new V3(), _dir = new V3(), _D = new V3(), _s1 = new V3(), _s2 = new V3(), _n = new V3();
function orient(m, a, b) {
  _D.subVectors(b, a); const L = _D.length() || 1e-6;
  m.position.copy(a).addScaledVector(_D, 0.5);
  m.quaternion.setFromUnitVectors(UP, _D.multiplyScalar(1 / L)); m.scale.set(1, L, 1);
}
function rebuildFeet() {
  LEGA.forEach((a, i) => {
    const x = 0.72 * Math.cos(a), z = 0.72 * Math.sin(a);
    FEET[i].set(x, groundH(rig.position.x + x, rig.position.z + z) - rig.position.y + 0.03, z);
    legs[i].shoe.position.set(x, FEET[i].y + 0.05, z);
    legs[i].num.position.set(x * 1.15, FEET[i].y + 0.5, z * 1.15);
  });
  _n.crossVectors(_s1.subVectors(FEET[1], FEET[0]), _s2.subVectors(FEET[2], FEET[0])).normalize();
  if (_n.y < 0) _n.negate();
  blob.quaternion.setFromUnitVectors(new V3(0, 0, 1), _n);
  blob.position.set((FEET[0].x + FEET[1].x + FEET[2].x) / 3, (FEET[0].y + FEET[1].y + FEET[2].y) / 3 - 0.012, (FEET[0].z + FEET[1].z + FEET[2].z) / 3);
}
function updateLegs() {
  legs.forEach((lg, i) => {
    _A.set(RH * Math.cos(LEGA[i]), st.H + st.leg[i] - 0.04, RH * Math.sin(LEGA[i]));
    _dir.subVectors(FEET[i], _A); const L = _dir.length(); _dir.multiplyScalar(1 / L);
    const U = Math.min(0.62, L * 0.45); _P.copy(_A).addScaledVector(_dir, U);
    orient(lg.up, _A, _P); orient(lg.lo, _P, FEET[i]);
    lg.collar.position.copy(_P); lg.collar.quaternion.setFromUnitVectors(UP, _dir);
    lg.lever.rotation.z = st.legLock[i] ? 0 : 1.3;
  });
}

headG.add(mesh(cyl(0.1, 0.035, 6, 0.085), M.wood, 0, -0.0175, 0));
headG.add(mesh(cyl(0.09, 0.006, 24), M.silver, 0, -0.003, 0));

// ---------- سجل الأجزاء (لكل جهاز أجزاؤه) ----------
export const parts = [];
let tag = 'all';
function addPart(key, name, desc, obj, parent, home, off) {
  obj.position.copy(home); parent.add(obj);
  const p = { key, name, desc, obj, anchor: obj, home: home.clone(), off: off || new V3(), type: tag };
  parts.push(p); return p;
}
export const partsFor = () => parts.filter(p => p.type === 'all' || (p.type === type && !custom[type]));
parts.push({ key: 'tripod', name: 'الحامل الثلاثي', desc: 'يرفع الجهاز لمستوى النظر. تُباعَد قوائمه وتُغرَز أطرافها، ويُضبط طول كل ساق لجعل رأسه أفقياً تقريباً قبل التسوية الدقيقة بالبراغي.', obj: tripAnchor, anchor: tripAnchor, home: new V3(), off: new V3(), fixed: true, type: 'all' });
parts.push({ key: 'legclamp', name: 'بزال تثبيت الساق', desc: 'يُحرَّر لتغيير طول الساق (ينزلق القسم السفلي) ثم يُربَط بإحكام. ساق غير مربوطة قد تنزلق وتخرّب التسوية.', obj: legs[0].collar, anchor: legs[0].collar, home: new V3(), off: new V3(), fixed: true, type: 'all' });

function arms(g, mat, h, w) {
  g.add(new THREE.Mesh(cyl(0.04, h * 1.02), mat));
  SCREWS.forEach(s => { const b = mesh(box(R + 0.012, h, w), mat, s.x / 2, 0, s.z / 2); b.rotation.y = Math.atan2(-s.z, s.x); g.add(b); });
}

const hvG = new THREE.Group();
hvG.add(mesh(cyl(0.012, 0.006), M.dark, 0, 0.003, 0), mesh(new THREE.SphereGeometry(0.0095, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.glass, 0, 0.006, 0));
const hvBubble = mesh(new THREE.SphereGeometry(0.0028, 10, 8), M.bub, 0, 0.012, 0); hvG.add(hvBubble);
addPart('headvial', 'كمانة رأس الحامل', 'فقاعة دائرية صغيرة على رأس الحامل تبيّن ميله التقريبي قبل التسوية بالبراغي. تتجه نحو الجهة الأعلى؛ اجعلها قرب المركز بتعديل أطوال الأرجل. كمانة الجهاز نفسه هي الأدق.', hvG, headG, new V3(0, 0.003, 0.083), new V3(0, 0.06, 0.14));

const boltG = new THREE.Group();
boltG.add(mesh(cyl(0.01, 0.09, 10), M.silver, 0, 0, 0), mesh(cyl(0.028, 0.018, 14), M.dark, 0, -0.05, 0));
addPart('bolt', 'المسمار المركزي', 'يمرّ من أسفل رأس الحامل إلى قاعدة الجهاز ويثبّته. يُربَط جيداً بعد وضع الجهاز.', boltG, headG, new V3(0, -0.07, 0), new V3(0, -0.2, 0));

const trivetG = new THREE.Group(); arms(trivetG, M.silver, 0.008, 0.022);
addPart('trivet', 'الصفيحة القاعدية', 'تستند إلى رأس الحامل، وتستقر عليها أطراف براغي التسوية الثلاثة.', trivetG, headG, new V3(0, 0.004, 0), new V3(0, 0.07, 0));

const screwParts = [];
SCREWS.forEach(s => {
  const g = new THREE.Group(), shaft = mesh(cyl(0.006, 1, 10), M.silver), knob = new THREE.Group();
  knob.add(mesh(cyl(0.02, 0.012, 14), M.dark), mesh(box(0.004, 0.003, 0.016), M.red, 0, 0.007, -0.01));
  g.add(mesh(new THREE.SphereGeometry(0.008, 12, 8), M.silver), shaft, knob);
  const p = addPart('screw' + s.n, 'برغي التسوية ' + s.n, 'دورانه مع عقارب الساعة يرفع ذلك الطرف من القاعدة. يُدار برغيّان بالإبهامين بعكس بعضهما لتحريك الفقاعة، ثم يُضبط الثالث وحده.', g, rig, new V3(s.x, 0, s.z), new V3(s.x / R * 0.1, 0.17, s.z / R * 0.1));
  p.shaft = shaft; p.knob = knob; screwParts.push(p);
});

const tribG = new THREE.Group(); arms(tribG, M.dark, 0.012, 0.026);
addPart('tribrach', 'قاعدة التسوية', 'تحمل الجهاز وتميل بحسب ارتفاع البراغي الثلاثة، فيميل معها المحور الرأسي للجهاز.', tribG, instRoot, new V3(0, 0.006, 0), new V3(0, 0.30, 0));

function circleMat() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 64;
  const c = cv.getContext('2d'); c.fillStyle = '#ececec'; c.fillRect(0, 0, 1024, 64); c.fillStyle = '#111';
  for (let d = 0; d < 360; d += 2) {
    const x = d / 360 * 1024, mj = d % 10 === 0;
    c.fillRect(x, 0, mj ? 3 : 1.5, mj ? 30 : 18);
    if (d % 30 === 0) { c.font = 'bold 20px sans-serif'; c.fillText(String(d), x + 4, 54); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
}
const hcG = new THREE.Group(); hcG.add(new THREE.Mesh(cyl(0.062, 0.012, 48), [circleMat(), M.silver, M.silver]));
addPart('hcircle', 'الدائرة الأفقية', 'دائرة مدرّجة تُقرأ عليها زوايا الدوران الأفقي (0–360°). في التيودوليت الرقمي والتاكيومتر الآلي تُقرأ على الشاشة، وفي اليدوي من ميكروسكوب القراءة.', hcG, instRoot, new V3(0, 0.018, 0), new V3(0, 0.42, 0));

// ================= أجزاء النيفو =================
tag = 'level';
const housing = new THREE.Group();
housing.add(new THREE.Mesh(cyl(0.05, 0.062, 32), M.yellow), mesh(cyl(0.052, 0.01, 32), M.dark, 0, -0.025, 0), mesh(box(0.07, 0.03, 0.12), M.yellow, 0, 0.045, 0));
addPart('housing', 'الهيكل الدوّار', 'يحمل المنظار ويدور حول المحور الرأسي فوق الدائرة الأفقية.', housing, rotating, new V3(0, 0.055, 0), new V3(0, 0.54, 0));

const clampG = new THREE.Group(), leverG = new THREE.Group();
leverG.add(mesh(box(0.03, 0.008, 0.01), M.dark, -0.015, 0, 0)); clampG.add(leverG, mesh(cyl(0.007, 0.012, 10), M.silver));
addPart('clamp', 'مثبّت الحركة الأفقية', 'عند ربطه يُقفل الدوران الحر للمنظار ويُفعَّل برغي الحركة البطيئة.', clampG, housing, new V3(-0.052, 0, 0), new V3(-0.15, 0, 0));

const slowG = new THREE.Group(); const sk = mesh(cyl(0.016, 0.022, 16), M.dark); sk.rotation.z = Math.PI / 2; slowG.add(sk);
addPart('slow', 'برغي الحركة البطيئة', 'برغي لانهائي الدوران لضبط اتجاه المنظار بدقة نحو الميرا بعد ربط المثبّت.', slowG, housing, new V3(0.056, 0, 0), new V3(0.15, 0, 0));

const scopeG = new THREE.Group();
scopeG.add(rz(mesh(cyl(0.04, 0.11, 32), M.yellow)), rz(mesh(cyl(0.0405, 0.012, 32), M.dark)),
  rz(mesh(cyl(0.03, 0.05, 24), M.dark, 0, 0, 0.07)), rz(mesh(cyl(0.03, 0.04, 24), M.dark, 0, 0, -0.07)),
  mesh(box(0.07, 0.008, 0.09), M.yellow, 0, 0.044, 0));
addPart('telescope', 'المنظار', 'تكبيره نحو 24×، وبداخله شعيرات. خط النظر هو الشعيرة الأفقية، وبالمعوّض يصبح أفقياً تلقائياً.', scopeG, rotating, new V3(0, 0.135, 0), new V3(0, 0.76, 0));

const objG = new THREE.Group();
objG.add(rz(mesh(cyl(0.034, 0.045, 24), M.dark)), rz(mesh(new THREE.CylinderGeometry(0.037, 0.037, 0.035, 24, 1, true), M.darkD, 0, 0, -0.04)));
const og = mesh(new THREE.CircleGeometry(0.03, 24), M.lens, 0, 0, -0.0235); og.rotation.y = Math.PI; objG.add(og);
addPart('objective', 'العدسة الشيئية', 'تجمع الضوء من الميرا وتكوّن صورتها في مستوى الشعيرات. الظلّة الأمامية تحميها من وهج الشمس.', objG, scopeG, new V3(0, 0, -0.115), new V3(0, 0, -0.22));

const eyeG = new THREE.Group();
eyeG.add(rz(mesh(cyl(0.018, 0.06, 20), M.dark)), rz(mesh(cyl(0.024, 0.016, 20), M.rubber, 0, 0, 0.032)), mesh(new THREE.CircleGeometry(0.012, 16), M.glass, 0, 0, 0.0405));
addPart('eyepiece', 'العدسة العينية', 'تكبّر الصورة والشعيرات. غطاؤها المطاطي يريح العين.', eyeG, scopeG, new V3(0, 0, 0.115), new V3(0, 0, 0.22));

const dioG = new THREE.Group(); dioG.add(rz(mesh(cyl(0.028, 0.014, 14), M.dark)), mesh(box(0.004, 0.003, 0.012), M.red, 0, 0.0285, 0));
addPart('diopter', 'حلقة ضبط العينية', 'تُدار أولاً حتى تصبح الشعيرات حادّة وسوداء (تعويض نظر المراقب).', dioG, scopeG, new V3(0, 0, 0.085), new V3(0, 0.09, 0.1));

const focG = new THREE.Group(); const fk = mesh(cyl(0.024, 0.018, 14), M.dark); fk.rotation.z = Math.PI / 2; focG.add(fk);
const fc = mesh(cyl(0.01, 0.006, 10), M.silver, 0.011, 0, 0); fc.rotation.z = Math.PI / 2; focG.add(fc);
addPart('focus', 'برغي التبئير', 'يحرّك عدسة داخلية لتصبح صورة الميرا واضحة على مستوى الشعيرات (لإزالة البارالاكس).', focG, scopeG, new V3(0.05, 0, -0.015), new V3(0.16, 0, 0));

const sightG = new THREE.Group();
sightG.add(rz(mesh(cyl(0.007, 0.1, 12), M.dark)), mesh(box(0.012, 0.014, 0.03), M.dark, 0, -0.01, 0),
  mesh(new THREE.TorusGeometry(0.0095, 0.0015, 8, 16), M.silver, 0, 0, -0.05), mesh(new THREE.TorusGeometry(0.006, 0.0015, 8, 16), M.silver, 0, 0, 0.05));
addPart('sight', 'المنظار الأولي', 'منظار صغير (هدّافة) فوق الجهاز للتوجيه التقريبي نحو الميرا: انظر عبر الحلقة الخلفية ثم الأمامية حتى ترى الميرا، ثم انتقل للمنظار الرئيسي.', sightG, scopeG, new V3(0, 0.058, 0), new V3(0, 0.22, 0));

const vialG = new THREE.Group();
vialG.add(mesh(cyl(0.015, 0.008), M.dark, 0, 0.004, 0), mesh(new THREE.SphereGeometry(0.0125, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.glass, 0, 0.008, 0));
const vr = new THREE.Mesh(new THREE.RingGeometry(0.0035, 0.0045, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
vr.rotation.x = -Math.PI / 2; vr.position.y = 0.0085; vialG.add(vr);
const bubble = mesh(new THREE.SphereGeometry(0.0035, 10, 8), M.bub, 0, 0.0165, 0); vialG.add(bubble);
const vialPart = addPart('vial', 'الفقاعة الدائرية', 'تُظهر أفقية الجهاز. تتجه الفقاعة نحو الجهة الأعلى؛ اجعلها داخل الدائرة الصغيرة.', vialG, scopeG, new V3(-0.026, 0.048, -0.02), new V3(-0.1, 0.1, -0.06));

const mirG = new THREE.Group();
const plate = mesh(box(0.034, 0.002, 0.03), M.mirror); plate.rotation.x = 3 * Math.PI / 4; mirG.add(plate);
mirG.add(mesh(box(0.003, 0.032, 0.003), M.dark, 0.0175, -0.016, 0), mesh(box(0.003, 0.032, 0.003), M.dark, -0.0175, -0.016, 0));
addPart('mirror', 'مرآة الفقاعة', 'مرآة مائلة 45° فوق الفقاعة تعكس صورتها نحو جهة العدسة العينية، فيراها المراقب وهو ينظر في المنظار دون أن يتحرك.', mirG, scopeG, new V3(-0.026, 0.08, -0.012), new V3(-0.1, 0.24, 0.06));

const compG = new THREE.Group();
compG.add(mesh(box(0.028, 0.028, 0.05), M.silver), mesh(cyl(0.004, 0.02, 8), M.dark, 0, -0.024, 0), mesh(new THREE.SphereGeometry(0.007, 10, 8), M.red, 0, -0.038, 0));
addPart('comp', 'المعوّض الآلي', 'ينتج خط نظر أفقياً تلقائياً حين يكون ميلان المحور ضمن ±10′. خارج هذا المدى يتوقف وتصبح القراءات خاطئة.', compG, scopeG, new V3(0, 0, 0.02), new V3(0, -0.14, 0.1));

// ================= التيودوليت والتاكيومترات =================
// NIVO-V5 — نماذج أكثر واقعية + انعكاسات معدنية + دعم نماذج Blender المخصّصة
export const custom = {};
const ttTel = {}, plateBubs = {};
let idxBub = null;
const tm = (c, r, m) => { const x = std(c, r, m); x.envMapIntensity = 0.9; return x; };
const MT = {
  dark: tm(0x26282c, 0.55, 0.2), silver: tm(0xd2d6db, 0.25, 0.85), steel: tm(0x9aa1a9, 0.3, 0.8), rubber: tm(0x121212, 0.9, 0),
  thBody: tm(0xcfd6de, 0.38, 0.35), thAcc: tm(0x2f6fed, 0.35, 0.3),
  tcBody: tm(0x56695a, 0.45, 0.3), tcAcc: tm(0xc9a45f, 0.3, 0.8),
  tsBody: tm(0xf1f3f6, 0.35, 0.2), tsAcc: tm(0xff7a00, 0.4, 0.2)
};
MT.darkD = MT.dark.clone(); MT.darkD.side = THREE.DoubleSide;
import('/three/examples/jsm/environments/RoomEnvironment.js').then(mod => {
  const env = new THREE.PMREMGenerator(renderer).fromScene(new mod.RoomEnvironment(renderer), 0.04).texture;
  Object.values(MT).forEach(x => { x.envMap = env; x.needsUpdate = true; });
}).catch(() => { /* بدون انعكاسات */ });

// مقبض مسنّن (knurled)
function knurl(r, h, n, mat) {
  const g = new THREE.Group(); g.add(new THREE.Mesh(cyl(r - 0.0008, h, 24), mat));
  for (let i = 0; i < n; i++) { const a = i / n * TAU, b = mesh(box(0.0016, h, 0.0022), mat, Math.cos(a) * r, 0, Math.sin(a) * r); b.rotation.y = -a; g.add(b); }
  return g;
}
// دعامتان على شكل حرف U مدرّجتان بحواف منحنية
function uBracket(a1, H, gap, yb, D, mat) {
  const s = new THREE.Shape(), a0 = a1 + 0.008, g = gap / 2, r = 0.01;
  s.moveTo(-a0, 0); s.lineTo(a0, 0); s.lineTo(a1, H - r); s.quadraticCurveTo(a1 - 0.002, H, a1 - r - 0.002, H);
  s.lineTo(g + r, H); s.quadraticCurveTo(g, H, g, H - r); s.lineTo(g, yb); s.lineTo(-g, yb); s.lineTo(-g, H - r);
  s.quadraticCurveTo(-g, H, -g - r, H); s.lineTo(-a1 + r + 0.002, H); s.quadraticCurveTo(-a1 + 0.002, H, -a1, H - r); s.lineTo(-a0, 0);
  const geo = new THREE.ExtrudeGeometry(s, { depth: D, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 6 });
  geo.translate(0, 0, -D / 2);
  return new THREE.Mesh(geo, mat);
}
function screenTex(ts) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 192;
  const x = c.getContext('2d');
  x.fillStyle = '#1b1f26'; x.fillRect(0, 0, 128, 192);
  x.fillStyle = '#8fe3a0'; x.fillRect(8, 8, 112, 72);
  x.fillStyle = '#12301c'; x.font = 'bold 14px monospace';
  x.fillText('Hz 0°00′00″', 14, 30); x.fillText('V  90°00′00″', 14, 50); if (ts) x.fillText('SD ---.---', 14, 70);
  x.fillStyle = '#9aa4b4';
  for (let r = 0; r < 4; r++) for (let q = 0; q < 3; q++) x.fillRect(12 + q * 38, 94 + r * 22, 30, 15);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildTT(kind) {
  const ts = kind === 'ts', tc = kind === 'tach';
  const body = ts ? MT.tsBody : tc ? MT.tcBody : MT.thBody, acc = ts ? MT.tsAcc : tc ? MT.tcAcc : MT.thAcc;
  tag = kind;
  // القاعدة الدوّارة: قرص + حلقة مسننة للحركة السفلية + دعامتا U
  const al = new THREE.Group();
  al.add(new THREE.Mesh(cyl(0.064, 0.05, 40, 0.072), body), mesh(cyl(0.075, 0.006, 40), acc, 0, -0.018, 0));
  const kr = knurl(0.0745, 0.014, 40, MT.dark); kr.position.y = -0.03; al.add(kr);
  const br = uBracket(ts ? 0.096 : 0.092, 0.161, 0.116, 0.05, ts ? 0.1 : 0.085, body); br.position.set(0, 0.025, 0); al.add(br);
  const lc = mesh(cyl(0.034, 0.012, 32), body, -0.1, 0.141, 0); lc.rotation.z = Math.PI / 2;
  const lp = mesh(cyl(0.013, 0.014, 16), acc, -0.109, 0.141, 0); lp.rotation.z = Math.PI / 2;
  al.add(lc, lp);
  for (const sx of [-1, 1]) al.add(mesh(box(0.004, 0.08, 0.05), acc, sx * 0.0995, 0.07, 0));
  addPart(kind + 'al', 'القاعدة الدوّارة والدعامتان', 'تدور حول المحور الرأسي فوق الدائرة الأفقية، وتحمل الدعامتين اللتين يدور بينهما المنظار حول المحور الأفقي (trunnion). الحلقة المسننة السفلية للحركة الأفقية السفلى.', al, rotating, new V3(0, 0.049, 0), new V3(0, 0.54, 0));

  if (ts) {
    const hd = new THREE.Group();
    [-0.028, 0.028].forEach(z => { const arc = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.008, 8, 28, Math.PI), body); arc.position.z = z; hd.add(arc); });
    hd.add(mesh(box(0.06, 0.016, 0.07), body, 0, 0.072, 0));
    addPart('tshd', 'مقبض الحمل', 'لحمل الجهاز. لا تحمله من المنظار أبداً.', hd, al, new V3(0, 0.186, 0), new V3(0, 0.2, 0));
    const bt = new THREE.Group(); bt.add(mesh(box(0.03, 0.08, 0.07), MT.dark), mesh(box(0.004, 0.05, 0.05), acc, 0.016, 0, 0));
    addPart('tsbat', 'البطارية', 'حزمة بطارية قابلة للشحن تُركَّب على الدعامة اليمنى. أطفئ الجهاز قبل نزعها.', bt, al, new V3(0.118, 0.05, 0), new V3(0.18, 0, 0));
  }
  if (!ts) {
    const pb = new THREE.Group(), tube = mesh(cyl(0.008, 0.052, 12), M.glass); tube.rotation.z = Math.PI / 2;
    const bb = mesh(new THREE.SphereGeometry(0.0042, 10, 8), M.bub); bb.scale.x = 2.4; plateBubs[kind] = bb;
    pb.add(mesh(box(0.06, 0.008, 0.02), MT.dark, 0, -0.008, 0), tube, bb);
    addPart(kind + 'bub', 'كمانة الصفيحة (الأنبوبية)', 'حساسيتها نحو 40″ للتدريجة وموازية للمحور الأفقي. تُسوّى بتوجيهها موازية لبرغيَّين ثم تدوير الجهاز 90° وضبط البرغي الثالث، وتُعاد حتى تبقى في المركز عند أي اتجاه.', pb, al, new V3(0, 0.083, -0.015), new V3(0, 0.12, -0.1));
  }
  if (!tc) {
    const dp = new THREE.Group(), scr = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.075), new THREE.MeshBasicMaterial({ map: screenTex(ts) }));
    scr.rotation.y = -Math.PI / 2; scr.position.x = -0.0045;
    dp.add(mesh(box(0.008, 0.085, 0.058), MT.dark), scr);
    addPart(kind + 'dp', ts ? 'الشاشة ولوحة المفاتيح' : 'الشاشة الرقمية', ts ? 'تعرض Hz وV وSD وميلان المحور، وتسجّل القياسات وتحسب الإحداثيات.' : 'تعرض Hz وV بدقة 5″ مع مفتاح 0SET لتصفير الزاوية الأفقية.', dp, al, new V3(-0.115, 0.1, 0), new V3(-0.16, 0, 0));
  }
  if (tc) {
    // كمانة الدائرة الرأسية (الفهرس) + برغي الفهرس
    const iv = new THREE.Group(), tb = mesh(cyl(0.007, 0.06, 12), M.glass); tb.rotation.x = Math.PI / 2;
    idxBub = mesh(new THREE.SphereGeometry(0.0038, 10, 8), M.bub); idxBub.scale.z = 2.4;
    const kn = knurl(0.012, 0.02, 16, MT.dark); kn.rotation.z = Math.PI / 2; kn.position.z = 0.05;
    iv.add(mesh(box(0.012, 0.016, 0.07), MT.dark, 0, -0.01, 0), tb, idxBub, kn);
    addPart('tcidx', 'كمانة الدائرة الرأسية وبرغي الفهرس', 'كمانة الفهرس: يجب تمركزها ببرغي الفهرس قبل كل قراءة رأسية، فهي التي تحدّد صفر الدائرة الرأسية. خطؤها يدخل مباشرة في زاوية V.', iv, al, new V3(0.113, 0.06, -0.005), new V3(0.17, 0.05, 0));
    // ميكروسكوب القراءة
    const mic = new THREE.Group(), mt = rz(mesh(cyl(0.011, 0.09, 14), MT.dark)); mt.rotation.x = Math.PI / 2 - 0.5;
    mic.add(mt, mesh(cyl(0.015, 0.012, 14), MT.rubber, 0, 0.0216, 0.0396));
    addPart('tcmic', 'ميكروسكوب قراءة الدوائر', 'ينظر منه المراقب إلى الدائرتين الأفقية والرأسية فيرى تدريج الدرجات ومقياس الدقائق ويقرأ يدوياً.', mic, al, new V3(-0.1, 0.12, 0.05), new V3(-0.16, 0.1, 0.1));
    // مرآة الإضاءة
    const mi = new THREE.Group(), md = mesh(cyl(0.024, 0.004, 20), M.mirror); md.rotation.x = 0.8; mi.add(md, mesh(cyl(0.004, 0.05, 8), MT.steel, 0, -0.025, 0));
    addPart('tcmir', 'مرآة الإضاءة', 'تعكس ضوء النهار إلى داخل الجهاز لإضاءة تدريج الدوائر قبل القراءة.', mi, al, new V3(0.085, 0.035, 0.07), new V3(0.16, -0.05, 0.1));
  }
  const tg = new THREE.Group();
  [[-0.005, 0.035, acc], [-0.005, -0.03, MT.dark], [0.035, 0.035, MT.dark], [0.035, -0.03, acc]].forEach(([y, z, mm]) => { const k = knurl(0.012, 0.018, 16, mm); k.rotation.z = Math.PI / 2; k.position.set(0.112, y, z); tg.add(k); });
  addPart(kind + 'tg', 'مثبّتات وبراغي الحركة البطيئة', 'مثبّت وبرغي حركة بطيئة للأفقي ومثلهما للرأسي: اربط المثبّت أولاً ثم دقّق التوجيه بالبرغي.', tg, al, new V3(0, 0, 0), new V3(0.16, 0, 0));
  const pl = new THREE.Group(); pl.add(mesh(cyl(0.012, 0.045, 12), MT.dark), mesh(cyl(0.006, 0.02, 8), ts ? M.red : MT.silver, 0, -0.03, 0));
  addPart(kind + 'pl', ts ? 'الشاقول الليزري' : 'الشاقول البصري', ts ? 'يسقط نقطة ليزر على العلامة الأرضية لمركزة الجهاز فوقها.' : 'ينظر منه المراقب إلى العلامة الأرضية لمركزة الجهاز فوقها.', pl, al, new V3(0, -0.012, 0.06), new V3(0, -0.12, 0.1));

  // المنظار على المحور الأفقي (يدور رأسياً)
  const tel = new THREE.Group(); ttTel[kind] = tel;
  const tr = ts ? 0.034 : 0.03, ax = mesh(cyl(0.008, 0.2, 10), MT.steel); ax.rotation.z = Math.PI / 2;
  tel.add(rz(mesh(cyl(tr, 0.17, 28), body)), ax, rz(mesh(cyl(tr + 0.004, 0.012, 28), acc)));
  addPart(kind + 'tel', 'المنظار', ts ? 'يدور رأسياً (الوجه I والوجه II) ويشترك مع EDM في المحور البصري. الشعيرات للتوجيه، والتكبير نحو 30×.' : tc ? 'منظار ذاتي الاختزال: الشبكة فيها شعيرة رأسية وأربع شعيرات أفقية (ق ع وق و وق س وS) وقطعة مائلة تخرج من الشعيرة العليا. المسافة الأفقية D = (ق ع − ق س)×100 بلا حاجة لـ cos²α.' : 'يدور رأسياً (الوجه I والوجه II). فيه شعيرة رأسية وأفقية وشعيرتا ستاديا: D = 100·s·cos²α و V = 50·s·sin2α.', tel, rotating, new V3(0, 0.19, 0), new V3(0, 0.8, 0));
  const ob = new THREE.Group();
  ob.add(rz(mesh(cyl(tr, 0.06, 28, tr + 0.012), MT.dark)), rz(mesh(new THREE.CylinderGeometry(tr + 0.014, tr + 0.014, 0.04, 28, 1, true), MT.darkD, 0, 0, -0.045)));
  const og2 = mesh(new THREE.CircleGeometry(tr + 0.008, 28), M.lens, 0, 0, -0.0305); og2.rotation.y = Math.PI; ob.add(og2);
  addPart(kind + 'ob', 'العدسة الشيئية', 'مخروطية تجمع الضوء من الهدف وتكوّن صورته في مستوى الشعيرات. الظلّة الأمامية تحميها من الوهج.', ob, tel, new V3(0, 0, -0.115), new V3(0, 0, -0.22));
  const ey = new THREE.Group(); ey.add(rz(mesh(cyl(0.016, 0.07, 20, 0.024), MT.dark)), rz(mesh(cyl(0.027, 0.016, 20), MT.rubber, 0, 0, 0.038)));
  addPart(kind + 'ey', 'العدسة العينية', 'تكبّر الصورة والشعيرات؛ تُضبط أولاً حتى تصبح الشعيرات حادّة. غطاؤها المطاطي يريح العين.', ey, tel, new V3(0, 0, 0.13), new V3(0, 0, 0.22));
  const fr = new THREE.Group(), fk2 = knurl(0.022, 0.016, 26, MT.dark); fk2.rotation.z = Math.PI / 2; fk2.position.x = 0.042;
  fr.add(fk2, rz(mesh(cyl(tr + 0.006, 0.02, 28), acc)));
  addPart(kind + 'fr', 'برغي التبئير', 'يُدار حتى تتضح صورة الهدف على مستوى الشعيرات (بلا بارالاكس).', fr, tel, new V3(0, 0, -0.035), new V3(0, 0.14, 0));
  const vc = new THREE.Group(), vd = new THREE.Mesh(tc ? cyl(0.05, 0.008, 44) : cyl(0.045, 0.008, 32), tc ? [circleMat(), MT.silver, MT.silver] : body);
  vd.rotation.z = Math.PI / 2; vc.add(vd);
  addPart(kind + 'vc', 'الدائرة الرأسية', 'تدور مع المنظار وتعطي زاوية الزنت Z (0° للأعلى و90° أفقياً). في الوجه II تقرأ 360° − Z.', vc, tel, new V3(0.104, 0, 0), new V3(0.16, 0, 0));
  const sg = new THREE.Group(); sg.add(rz(mesh(cyl(0.006, 0.1, 10), MT.dark)), mesh(new THREE.TorusGeometry(0.008, 0.0015, 8, 16), MT.silver, 0, 0, -0.05));
  addPart(kind + 'sg', 'المنظار الأولي', 'هدّافة فوق المنظار للتوجيه التقريبي قبل النظر في المنظار الرئيسي.', sg, tel, new V3(0, tr + 0.012, 0), new V3(0, 0.2, 0));
  if (ts) {
    const ed = new THREE.Group();
    ed.add(mesh(box(0.05, 0.03, 0.04), MT.dark), mesh(box(0.022, 0.02, 0.004), M.lens, -0.012, 0, -0.021), mesh(box(0.022, 0.02, 0.004), M.lens, 0.012, 0, -0.021));
    addPart('tsed', 'وحدة قياس المسافة EDM', 'ترسل حزمة تحت حمراء إلى المنشور العاكس وتحسب المسافة المائلة من زمن/طور عودتها. لا تعيد إشارة إن لم تكن الشعيرة على المنشور.', ed, tel, new V3(0, tr + 0.02, -0.1), new V3(0, 0.14, -0.2));
    const cp = new THREE.Group();
    cp.add(mesh(box(0.028, 0.028, 0.05), MT.silver), mesh(cyl(0.004, 0.02, 8), MT.dark, 0, -0.024, 0), mesh(new THREE.SphereGeometry(0.007, 10, 8), M.red, 0, -0.038, 0));
    addPart('tscp', 'المعوّض ثنائي المحور', 'يقيس الميلان في اتجاهين ويصحّح قراءة الزاوية الرأسية ضمن ±3′. خارج المدى تظهر رسالة خطأ وتعود القراءات غير مصحّحة.', cp, tel, new V3(0, 0, 0.02), new V3(0, -0.15, 0.1));
  }
}
buildTT('theo'); buildTT('tach'); buildTT('ts');
tag = 'all';

// ---------- التحديث ----------
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new V3(), _f = new V3(), _u = new V3(), _o = new V3();
let T = { gx: 0, gz: 0, arc: 0 };
export const getTilt = () => T;
// قراءة كمانة الدائرة الرأسية (بالدقائق القوسية): ميل الجهاز على محور النظر + برغي الفهرس
export const indexBubble = () => (((T.gx * Math.sin(st.heading) - T.gz * Math.cos(st.heading)) + st.idx) * 3437.75);

function sanitize() {
  if (!Number.isFinite(st.heading)) st.heading = 0;
  if (!Number.isFinite(st.vz)) st.vz = Math.PI / 2;
  if (!Number.isFinite(st.H)) st.H = 1.45;
  for (let i = 0; i < 3; i++) { if (!Number.isFinite(st.e[i])) st.e[i] = EMAX / 2; if (!Number.isFinite(st.leg[i])) st.leg[i] = 0; }
}

export function update(dt) {
  sanitize();
  st.explode += (st.exTarget - st.explode) * Math.min(1, dt * 4);
  if (Math.abs(st.exTarget - st.explode) < 0.001) st.explode = st.exTarget;
  const hs = headState();
  headG.position.set(0, hs.Hc, 0);
  headG.quaternion.setFromUnitVectors(UP, _v.set(-hs.tx, 1, -hs.tz).normalize());
  tripAnchor.position.set(0.3, hs.Hc * 0.55, 0.45);
  updateLegs();
  headG.getWorldQuaternion(_q);
  _v.set(hs.tx, 0, hs.tz).multiplyScalar(0.18).applyQuaternion(_q.invert());
  let hx = _v.x, hz = _v.z; const hl = Math.hypot(hx, hz);
  if (hl > 0.0065) { hx *= 0.0065 / hl; hz *= 0.0065 / hl; }
  hvBubble.position.set(hx, 0.006 + Math.sqrt(0.0095 ** 2 - (hx * hx + hz * hz)) - 0.0035, hz);
  let sx = 0, sz = 0, sy = 0;
  SCREWS.forEach((s, i) => {
    const y0 = hs.Hc + hs.tx * s.x + hs.tz * s.z + 0.008, len = S0 + st.e[i], p = screwParts[i];
    p.home.set(s.x, y0, s.z);
    p.shaft.scale.y = len; p.shaft.position.y = len / 2;
    p.knob.position.y = len + 0.018; p.knob.rotation.y = -st.e[i] / PITCH * 2 * Math.PI;
    const y = y0 + len; sx += y * s.x; sz += y * s.z; sy += y;
  });
  const gx = 2 * sx / (3 * R * R), gz = 2 * sz / (3 * R * R);
  T = { gx, gz, arc: Math.hypot(gx, gz) * 3437.75 };
  instRoot.position.set(0, sy / 3, 0);
  instRoot.quaternion.setFromUnitVectors(UP, _v.set(-gx, 1, -gz).normalize());
  rotating.rotation.y = -st.heading;
  const tr = Math.PI / 2 - st.vz;
  ttTel.theo.rotation.x = tr; ttTel.tach.rotation.x = tr; ttTel.ts.rotation.x = tr;
  const pbb = plateBubs[type];
  if (pbb) { const b = gx * Math.cos(st.heading) + gz * Math.sin(st.heading); pbb.position.x = clamp(b * 10.3, -0.02, 0.02); }
  if (type === 'tach' && idxBub) idxBub.position.z = clamp(indexBubble() * 0.0035, -0.022, 0.022);
  for (const p of parts) if (!p.fixed) p.obj.position.copy(p.home).addScaledVector(p.off, st.explode);
  vialPart.obj.getWorldQuaternion(_q);
  _v.set(gx, 0, gz).multiplyScalar(1.375).applyQuaternion(_q.invert());
  let bx = _v.x, bz = _v.z; const bl = Math.hypot(bx, bz);
  if (bl > 0.0075) { bx *= 0.0075 / bl; bz *= 0.0075 / bl; }
  bubble.position.set(bx, 0.008 + Math.sqrt(0.0125 ** 2 - (bx * bx + bz * bz)) - 0.004, bz);
}

// وضع كاميرا المنظار (مع أخطاء خط النظر وانحراف المحور)
export function scopePose(cam) {
  rig.updateMatrixWorld(true);
  const ty = TY(), tt = type !== 'level';
  _o.set(0, ty.trunH, 0); instRoot.localToWorld(_o);
  _q2.multiplyQuaternions(instRoot.quaternion, rotating.quaternion);
  cam.position.copy(_o);
  if (tt) {
    const c = ev('c') * SEC, tz = ev('t') * SEC, ph = st.vz;
    _f.set(Math.sin(c), Math.cos(ph) * Math.cos(c), -Math.sin(ph) * Math.cos(c));
    const fx0 = _f.x * Math.cos(tz) - _f.y * Math.sin(tz), fy0 = _f.x * Math.sin(tz) + _f.y * Math.cos(tz);
    _f.x = fx0; _f.y = fy0; _f.applyQuaternion(_q2);
    _u.set(0, 1, 0).applyQuaternion(_q2); cam.up.copy(_u);
  } else {
    _f.set(0, 0, -1).applyQuaternion(_q2);
    if (T.arc <= ty.comp) {
      _f.y = 0; _f.normalize();
      const ga = T.gx * Math.sin(st.heading) - T.gz * Math.cos(st.heading);
      const el = ev('c') * SEC + 0.02 * ga, ce = Math.cos(el);
      _f.set(_f.x * ce, Math.sin(el), _f.z * ce); cam.up.set(0, 1, 0);
    } else { _u.set(0, 1, 0).applyQuaternion(_q2); cam.up.copy(_u); }
  }
  _f.add(_o); cam.lookAt(_f);
}

// قراءات الدوائر كما يراها المراقب
export function readings() {
  const ty = TY(), face = st.vz < Math.PI ? 1 : 2;
  let v = st.vz + ev('i') * SEC, comp = false;
  if (type === 'ts' && T.arc <= ty.comp) {
    _q.multiplyQuaternions(instRoot.quaternion, rotating.quaternion).multiply(ttTel.ts.quaternion);
    _f.set(0, 0, -1).applyQuaternion(_q);
    const z = Math.acos(clamp(_f.y, -1, 1));
    v = (face === 1 ? z : TAU - z) + ev('i') * SEC; comp = true;
  }
  if (type === 'tach') v = st.vz + st.idx + ev('i') * SEC + 0.001749;
  return { hz: (((st.heading - st.hz0) % TAU) + TAU) % TAU, v: ((v % TAU) + TAU) % TAU, face, comp };
}

// ---------- واجهة برمجية ----------
export function setType(t) {
  type = t;
  parts.forEach(p => { if (p.type !== 'all') p.obj.visible = p.type === t && !custom[p.type]; });
}
export function setRig(x, z) { rig.position.set(x, groundH(x, z), z); rebuildFeet(); }
export function setHeight(h) { st.H = clamp(h, 1.1, 1.8); }
export function setLeg(i, m) { st.leg[i] = clamp(m, -0.025, 0.025); }
export function setLegLock(i, b) { st.legLock[i] = b; }
export function setExplode(on) { st.exTarget = on ? 1 : 0; }
export function setMounted(b) { st.mounted = b; instRoot.visible = b; trivetG.visible = b; screwParts.forEach(p => (p.obj.visible = b)); }
export function setClamp(b) { st.clamp = b; leverG.rotation.z = b ? 0 : -0.9; }
export function nudgeIdx(arcmin) { st.idx = clamp(st.idx + arcmin / 3437.75, -25 / 3437.75, 25 / 3437.75); }
export function turnScrew(i, turns) {
  const n = st.e[i] + turns * PITCH;
  st.e[i] = clamp(n, 0, EMAX);
  return n >= 0 && n <= EMAX;
}
export function levelLegsNow() { st.leg = [0, 0, 0]; }
export function levelScrewsNow() {
  const hs = headState();
  st.e = SCREWS.map(s => clamp(EMAX / 2 - (hs.tx * s.x + hs.tz * s.z), 0, EMAX));
}
// عند التركيب لا يكون الجهاز مُسوّى: براغي التسوية في أوضاع عشوائية
function randomizeScrews() { st.e = st.e.map(() => clamp(EMAX / 2 + (Math.random() - 0.5) * 0.004, 0, EMAX)); }
export function mount() { if (st.mounted) return; setMounted(true); randomizeScrews(); }
export function quickMount() { st.H = 1.45; st.legLock = [true, true, true]; mount(); }
export function quickLevel() {
  if (!st.mounted) quickMount();
  st.leg = [0, 0, 0]; st.e = [EMAX / 2, EMAX / 2, EMAX / 2]; st.legLock = [true, true, true];
}
// legs: 'random' | 'level' ، state: 'off' | 'mounted' | 'leveled'
export function reset(legs, state) {
  st.explode = 0; st.exTarget = 0; st.heading = 0; st.vz = Math.PI / 2; st.hz0 = Math.random() * TAU; st.clampV = false;
  st.idx = (Math.random() - 0.5) * 2 * (8 / 3437.75);
  st.e = [EMAX / 2, EMAX / 2, EMAX / 2];
  setMounted(false); setClamp(false);
  if (legs === 'level') { st.H = 1.45; st.leg = [0, 0, 0]; st.legLock = [true, true, true]; }
  else { st.H = 1.75; st.leg = [0, 1, 2].map(() => (Math.random() - 0.5) * 0.008); st.legLock = [false, false, false]; }
  if (state === 'mounted' || state === 'leveled') {
    const keep = st.leg.slice();
    quickMount();
    st.leg = legs === 'level' ? [0, 0, 0] : keep;
  }
  if (state === 'leveled') quickLevel();
}
rebuildFeet();
setType('level');
reset('random', 'off');
export { rig, instRoot, rotating, ttTel };
