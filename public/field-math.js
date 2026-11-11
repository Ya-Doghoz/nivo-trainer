// حسابات المسح الحقلية النقية للميزات الجديدة (T-003) — بلا أي اعتماد على الواجهة
// الاصطلاحات كمَا في المشروع: أمتار، زوايا داخلية بالراديان، x شرق وz جنوب (الشمال = −z)،
// السمت 0 = الشمال باتجاه عقارب الساعة (مطابق لـ survey-math.azimuth).
import { DEG, TAU, azimuth } from './survey-math.js';

// ---------- إدخال الزوايا (درجات أو د-ق-ث، يقبل الأرقام العربية) ----------
const AR = '٠١٢٣٤٥٦٧٨٩';
const toLatin = s => s.replace(/[٠-٩]/g, d => String(AR.indexOf(d)));
/** "45" أو "45.5" أو "45 30" أو "45 30 15" أو «45°30'15"» → راديان، أو null عند الخطأ */
export function parseAngle(input) {
  const s = toLatin(String(input ?? '')).replace(/[°º˚]/g, ' ').replace(/[′'’]/g, ' ').replace(/[″"”]/g, ' ').replace(/,/g, '.').trim();
  if (!s) return null;
  const parts = s.split(/[\s:]+/).filter(Boolean);
  if (!parts.length || parts.length > 3) return null;
  const nums = [];
  for (const p of parts) {
    if (!/^\d*\.?\d*$/.test(p) || p === '' || p === '.') return null;
    const v = Number(p); if (!Number.isFinite(v)) return null; nums.push(v);
  }
  if (nums.length >= 2 && nums[1] >= 60) return null;
  if (nums.length >= 3 && nums[2] >= 60) return null;
  let d = nums[0] + (nums[1] || 0) / 60 + (nums[2] || 0) / 3600;
  if (!Number.isFinite(d)) return null;
  return d * DEG;
}

// ---------- أدوات نقاط عامة ----------
/** أقرب نقطة من pts إلى (x,z) ضمن نصف قطر r — وإلا null */
export function nearest(pts, x, z, r) {
  let best = null, bd = r;
  for (const p of pts) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
  return best;
}
/** مرشحو الالتقاط مرتّبون بالقرب (الأقرب أولاً). إن كان الأقرب هو آخر ما اختير فاختر الذي يليه —
 *  بديل المكبرة: اللمسة الثانية على المكان نفسه تنقل الاختيار إلى النقطة المتقاربة الأخرى (تدوير A,B,A…). */
export function cyclePick(cands, lastId) {
  if (!cands || !cands.length) return null;
  if (cands.length > 1 && lastId != null && cands[0].id === lastId) return cands[1];
  return cands[0];
}

// ---------- المضلعات ----------
/** إشارة مساحة مضلع بالإحداثيات (x,z): موجبة عندما يكون الدوران عكس عقارب الساعة على الشاشة (z نازل) */
export const signedArea = pts => { let s = 0; const n = pts.length; for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; s += p.x * q.z - q.x * p.z; } return s / 2; };
export const polyArea = pts => Math.abs(signedArea(pts));
export const polyPerimeter = pts => { let s = 0; const n = pts.length; for (let i = 0; i < n; i++) s += Math.hypot(pts[(i + 1) % n].x - pts[i].x, pts[(i + 1) % n].z - pts[i].z); return s; };
/** الزاوية الداخلية عند الرأس i (راديان، قد تتجاوز π للمقعّر) — orientation-aware */
export function interiorAngleAt(pts, i) {
  const n = pts.length, v = pts[i], prev = pts[(i - 1 + n) % n], next = pts[(i + 1) % n];
  const cw = (azimuth(v.x, v.z, next.x, next.z) - azimuth(v.x, v.z, prev.x, prev.z) + TAU) % TAU; // من الخلف إلى الأمام باتجاه عقارب الساعة
  return signedArea(pts) < 0 ? cw : TAU - cw;  // دوران عكس عقارب الساعة على الشاشة (z نازل) → الداخلية = عكس عقارب الساعة
}
/**
 * مقارنة مدخلات الطالب لمضلع مع القيم الفعلية.
 * verts: [{x,z}] · edgeIn: [رقم|null] طول الضلع الخارج من الرأس i · angIn: [راديان|null] الزاوية عند الرأس i
 * يعيد {perimeter, area, edgeAct[], angleAct[], edgeDiff[], angleDiff[]} (الفرق = المدخل − الفعلي، null بلا إدخال)
 */
export function polyCheck(verts, edgeIn, angIn) {
  const n = verts.length, edgeAct = [], angleAct = [], edgeDiff = [], angleDiff = [];
  for (let i = 0; i < n; i++) {
    const a = verts[i], b = verts[(i + 1) % n];
    edgeAct.push(Math.hypot(b.x - a.x, b.z - a.z));
    angleAct.push(interiorAngleAt(verts, i));
  }
  for (let i = 0; i < n; i++) {
    edgeDiff.push(edgeIn[i] == null ? null : edgeIn[i] - edgeAct[i]);
    angleDiff.push(angIn[i] == null ? null : angIn[i] - angleAct[i]);
  }
  return { perimeter: polyPerimeter(verts), area: polyArea(verts), edgeAct, angleAct, edgeDiff, angleDiff };
}

// ---------- المسار المساحي (Traverse) ----------
/**
 * o = { stations:[{x,z}] · legs:[{d,dir}] · mode:'ang'|'az' · closed · startAz (راديان أو null) }
 * legs[i] = الضلع الخارج من المحطة i (للمسار المغلق يتضمن عودة المحطة الأخيرة إلى الأولى):
 *   d = طوله (م) · dir = الزاوية الداخلية عند المحطة i (mode 'ang') أو سمت الضلع نفسه (mode 'az') — بالراديان.
 * أزيموت الضلع i (في وضع الزوايا): az[i] = az[i−1] + π + dir[i]، وأول ضلع = startAz أو سمته الحقيقي من الخريطة.
 * يعيد { coords, az[], az0, closure, perimeter, denom, angleSum, expSum, devs[], err } بالإحداثيات المحلية (x,z).
 */
export function traverseCompute(o) {
  const st = o.stations, legs = o.legs, n = st.length, closed = !!o.closed, mode = o.mode;
  const need = closed ? n : n - 1;
  if (n < (closed ? 3 : 2)) return { err: closed ? 'المسار المغلق يحتاج 3 محطات على الأقل' : 'المسار المفتوح يحتاج محطتين على الأقل' };
  if (legs.length < need) return { err: 'أضلعة ناقصة' };
  for (let i = 0; i < need; i++) {
    if (legs[i] == null || legs[i].d == null || !(legs[i].d > 0)) return { err: `أدخل طول الضلع الخارج من المحطة ${i + 1}` };
    if (legs[i].dir == null) return { err: mode === 'ang' ? `أدخل الزاوية عند المحطة ${i + 1}` : `أدخل اتجاه الضلع الخارج من المحطة ${i + 1}` };
  }
  const az = new Array(need);
  if (mode === 'az') { for (let i = 0; i < need; i++) az[i] = ((legs[i].dir % TAU) + TAU) % TAU; }
  else {
    az[0] = o.startAz != null ? ((o.startAz % TAU) + TAU) % TAU : azimuth(st[0].x, st[0].z, st[1].x, st[1].z);
    for (let i = 1; i < need; i++) az[i] = ((az[i - 1] + Math.PI + legs[i].dir) % TAU + TAU) % TAU;
  }
  const coords = [{ x: st[0].x, z: st[0].z }];
  for (let i = 0; i < need; i++) {
    const d = legs[i].d;
    coords.push({ x: coords[i].x + d * Math.sin(az[i]), z: coords[i].z - d * Math.cos(az[i]) }); // Δz = −d·cos(az) لأن الشمال = −z
  }
  const end = coords[need];
  const closure = closed ? Math.hypot(end.x - st[0].x, end.z - st[0].z) : Math.hypot(end.x - st[n - 1].x, end.z - st[n - 1].z);
  let perimeter = 0; for (let i = 0; i < need; i++) perimeter += legs[i].d;
  const devs = st.map((s, i) => Math.hypot(coords[i].x - s.x, coords[i].z - s.z)); // devs[0] = 0
  let angleSum = null, expSum = null;
  if (mode === 'ang' && closed) {
    angleSum = 0; for (let i = 0; i < n; i++) angleSum += legs[i].dir;  // يشمل زاوية المحطة الأولى (زاوية التحقق)
    expSum = signedArea(st) < 0 ? (n - 2) * Math.PI : (n + 2) * Math.PI; // دوران عكس عقارب الساعة على الشاشة → زوايا داخلية
  }
  const denom = closure > 1e-9 ? Math.max(1, Math.round(perimeter / closure)) : Infinity;
  return { coords, az, az0: az[0], closure, perimeter, denom, angleSum, expSum, devs, err: null };
}

// ---------- المقطع التضاريسي ----------
/** النقاط الواقعة على ممر corridor حول المستقيم أ→ب: [{p, d (م على المسار), off}] مرتبة حسب d */
export function pointsOnLine(pts, a, b, corridor) {
  const dx = b.x - a.x, dz = b.z - a.z, len2 = dx * dx + dz * dz;
  if (len2 < 1e-12) return [];
  const out = [];
  for (const p of pts) {
    const t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / len2;
    if (t < 0 || t > 1) continue;
    const off = Math.abs((p.x - a.x) * dz - (p.z - a.z) * dx) / Math.sqrt(len2);
    if (off <= corridor) out.push({ p, d: t * Math.sqrt(len2), off });
  }
  out.sort((u, v) => u.d - v.d);
  return out;
}

// ---------- الكنتور من نقاط الطالب ----------
/**
 * شبكة IDW فوق عقد كل خلية عند (x0 + i·dx, z0 + j·dz).
 * pts: [{x, z, v}] — عند التطابق التام مع نقطة تُعاد قيمتها نفسها.
 */
export function idwGrid(pts, x0, z0, nx, nz, dx, dz, power = 2) {
  const g = new Float64Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * dx, z = z0 + j * dz;
    let s = 0, w = 0, exact = null;
    for (const p of pts) {
      const d2 = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
      if (d2 < 1e-12) { exact = p.v; break; }
      const wq = 1 / Math.pow(d2, power / 2);
      s += p.v * wq; w += wq;
    }
    g[j * nx + i] = exact != null ? exact : s / w;
  }
  return g;
}

/** Marching Squares: خطوط الكنتور عند منسوب level فوق شبكة vals (nx×nz عقد عند x0+i·dx, z0+j·dz) → مصفوفة مضلعات [[x,z],…] */
export function marchingSquares(vals, nx, nz, level, x0, z0, dx, dz) {
  const segs = [];
  const ex = (i, j) => x0 + i * dx, ez = (j) => z0 + j * dz;
  const lerp = (v0, v1, x, z, x2, z2) => { const t = (level - v0) / (v1 - v0); return [x + (x2 - x) * t, z + (z2 - z) * t]; };
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v0 = vals[j * nx + i], v1 = vals[j * nx + i + 1], v2 = vals[(j + 1) * nx + i + 1], v3 = vals[(j + 1) * nx + i];
    let c = (v0 >= level ? 1 : 0) | (v1 >= level ? 2 : 0) | (v2 >= level ? 4 : 0) | (v3 >= level ? 8 : 0);
    if (c === 0 || c === 15) continue;
    const e = [
      () => lerp(v0, v1, ex(i, j), ez(j), ex(i + 1, j), ez(j)),        // 0: بين (i,j) و (i+1,j)
      () => lerp(v1, v2, ex(i + 1, j), ez(j), ex(i + 1, j + 1), ez(j + 1)), // 1: بين (i+1,j) و (i+1,j+1)
      () => lerp(v2, v3, ex(i + 1, j + 1), ez(j + 1), ex(i, j + 1), ez(j + 1)), // 2
      () => lerp(v3, v0, ex(i, j + 1), ez(j + 1), ex(i, j), ez(j)),     // 3: بين (i,j+1) و (i,j)
    ];
    let pairs;
    if (c === 5 || c === 10) {
      const centerIn = (v0 + v1 + v2 + v3) / 4 >= level;
      pairs = (c === 5) === centerIn ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]];
    } else pairs = ({ 1: [[3, 0]], 2: [[0, 1]], 3: [[3, 1]], 4: [[1, 2]], 6: [[0, 2]], 7: [[2, 3]], 8: [[2, 3]], 9: [[0, 2]], 11: [[1, 2]], 12: [[3, 1]], 13: [[0, 1]], 14: [[3, 0]] })[c];
    for (const [a, b] of pairs) segs.push([e[a](), e[b]()]);
  }
  return chain(segs);
}
/** وصل مقاطع الكنتور إلى مضلعات (تطابق النهايات بتقريب 1e-6) */
function chain(segs) {
  const key = p => p[0].toFixed(6) + ',' + p[1].toFixed(6);
  const at = new Map(); segs.forEach((s, i) => { for (const p of s) { const k = key(p); if (!at.has(k)) at.set(k, []); at.get(k).push(i); } });
  const used = new Set(), out = [];
  for (let i = 0; i < segs.length; i++) {
    if (used.has(i)) continue;
    let line = [segs[i][0], segs[i][1]]; used.add(i);
    for (let guard = 0; guard < segs.length + 2; guard++) {
      const endK = key(line[line.length - 1]);
      const cands = (at.get(endK) || []).filter(x => !used.has(x));
      if (!cands.length) break;
      const nx2 = cands[0]; used.add(nx2);
      const s = segs[nx2];
      line.push(key(s[0]) === endK ? s[1] : s[0]);
      if (key(line[line.length - 1]) === key(line[0])) { line.pop(); break; } // مغلق: احذف التكرار الأخير
    }
    out.push(line);
  }
  return out;
}
