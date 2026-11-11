// المقطع التضاريسي (T-003): اختيار نقطتين على الخريطة ورسم مقطع الارتفاعات مع المسافة والميل
// والنقاط الواقعة على المسار نفسه (ممر ± 12 م) تظهر على المخطط مع مناسيبها.
import { $, toast } from './util.js';
import { ST } from './state.js';
import { trueRL, crd } from './job.js';
import { groundH } from './world.js';
import { azimuth, DEG } from './survey-math.js';
import { H } from './hooks.js';
import { drawMap } from './map.js';
import * as MV from './map-view.js';
import { pointsOnLine, nearest } from './field-math.js';

let A = null, B = null;      // {x, z, id}
const CORRIDOR = 12;        // م — عرض ممر «على نفس المسار»

// منسوب نقطة: منسوبها المسوّح إن وُجد (بيانات الطالب) وإلا منسوب الأرض الحقيقي حول BM
const zAt = p => { const t = trueRL(p); return t == null ? groundH(p.x, p.z) : t; };
const pickAt = (x, z) => { const p = nearest(ST.job.points, x, z, MV.hitR(15)); return p ? { x: p.x, z: p.z, id: p.id, elev: p.elev } : { x, z, id: null, elev: null }; };

H.addFeatTap('prof', (x, z) => {
  if (!A || (A && B)) { A = pickAt(x, z); B = null; toast('📍 بداية المقطع عند ' + (A.id || `E ${crd(A.x, A.z).E.toFixed(0)} N ${crd(A.x, A.z).N.toFixed(0)}`) + ' — انقر النقطة الثانية'); }
  else { B = pickAt(x, z); $('#profBox').open = true; toast('📉 رُسم المقطع — انظر لوحة المقطع التضاريسي'); }
  refresh();
});
H.addDrawer(draw);
H.addRefresh(refresh);
$('#profClear').onclick = () => { A = B = null; refresh(); drawMap(); toast('مُسح اختيار المقطع'); };
$('#profSwap').onclick = () => { if (A && B) { const t = A; A = B; B = t; refresh(); drawMap(); } };

function refresh() {
  const picks = $('#profPicks'), st = $('#profStats'), cv = $('#profC');
  if (!A) { picks.textContent = 'لم تُعيَّن نقطتان بعد.'; st.innerHTML = ''; drawChart(); return; }
  const nm = p => p.id ? `${p.id} (E ${crd(p.x, p.z).E.toFixed(1)} N ${crd(p.x, p.z).N.toFixed(1)})` : `نقطة حرة (${p.x.toFixed(0)}, ${p.z.toFixed(0)})`;
  picks.textContent = `من: ${nm(A)}${B ? ' ← إلى: ' + nm(B) : ' — انقر النقطة الثانية…'}`;
  if (!B) { st.innerHTML = ''; drawChart(); return; }
  const D = Math.hypot(B.x - A.x, B.z - A.z);
  const za = zAt(A), zb = zAt(B), dz = zb - za;
  const az = azimuth(A.x, A.z, B.x, B.z) / DEG;
  const onLine = pointsOnLine(ST.job.points, A, B, CORRIDOR);
  st.innerHTML =
    `<div>المسافة الأفقية: <b>${D.toFixed(2)} م</b> · فرق المنسوب: <b>${dz >= 0 ? '+' : ''}${dz.toFixed(2)} م</b> · الميل: <b>${(dz / D * 100).toFixed(2)}%</b>${Math.abs(dz) > 0.01 ? ` (1:${Math.abs(D / dz).toFixed(1)})` : ' (أفقي تقريباً)'}</div>` +
    `<div>المسافة المائلة: <b>${Math.hypot(D, dz).toFixed(2)} م</b> · الاتجاه أ←ب: <b>${az.toFixed(1)}°</b> · منسوب أ: <b>${za.toFixed(2)}</b> · منسوب ب: <b>${zb.toFixed(2)}</b></div>` +
    (onLine.length ? `<div class="ok">على المسار (± ${CORRIDOR} م): ${onLine.map(o => `${o.p.id} عند ${o.d.toFixed(0)} م${o.p.elev != null ? '' : ' (غير مسوّى)'}`).join(' · ')}</div>` : '<div class="note">لا نقاط على المسار نفسه.</div>');
  drawChart();
}

function drawChart() {
  const cv = $('#profC'), c = cv.getContext('2d');
  const cw = cv.clientWidth || 470, ch = 170, d = Math.min(devicePixelRatio || 1, 2);
  cv.width = cw * d; cv.height = ch * d; c.setTransform(d, 0, 0, d, 0, 0);
  c.clearRect(0, 0, cw, ch);
  c.fillStyle = '#0a0d12'; c.fillRect(0, 0, cw, ch);
  if (!A || !B) { c.fillStyle = '#8a96a8'; c.font = '12px sans-serif'; c.textAlign = 'center'; c.fillText('عيّن نقطتين بأداة 📉 مقطع ثم انقر على الخريطة', cw / 2, ch / 2); return; }
  const D = Math.hypot(B.x - A.x, B.z - A.z) || 1;
  const n = Math.max(80, Math.min(400, Math.round(D / 0.5)));
  const xs = [], zs = [];
  for (let i = 0; i <= n; i++) { const t = i / n; xs.push(A.x + (B.x - A.x) * t); zs.push(A.z + (B.z - A.z) * t); }
  const zsV = zs.map((z, i) => zAt({ x: xs[i], z }));
  let mn = Math.min(...zsV, zAt(A), zAt(B)), mx = Math.max(...zsV, zAt(A), zAt(B));
  const pad = Math.max(0.5, (mx - mn) * 0.12); mn -= pad; mx += pad;
  const L = 40, R = 12, T = 14, Bm = 26, pw = cw - L - R, ph = ch - T - Bm;
  const X = dm => L + dm / D * pw, Y = v => T + (mx - v) / (mx - mn) * ph;
  // شبكة المحورين
  c.strokeStyle = '#1d2733'; c.lineWidth = 1; c.fillStyle = '#8a96a8'; c.font = '10px sans-serif'; c.textAlign = 'center';
  const stepD = niceStep(D / 6), stepZ = niceStep((mx - mn) / 4);
  for (let dm = 0; dm <= D + 1e-9; dm += stepD) { c.beginPath(); c.moveTo(X(dm), T); c.lineTo(X(dm), T + ph); c.stroke(); c.fillText(fmtAxis(dm) + ' م', X(dm), ch - 8); }
  c.textAlign = 'right';
  for (let v = Math.ceil(mn / stepZ) * stepZ; v <= mx + 1e-9; v += stepZ) { c.beginPath(); c.moveTo(L, Y(v)); c.lineTo(L + pw, Y(v)); c.stroke(); c.fillText(fmtAxis(v), L - 4, Y(v) + 3); }
  // المساحة تحت المقطع
  c.beginPath(); c.moveTo(X(0), Y(zsV[0]));
  for (let i = 1; i <= n; i++) c.lineTo(X(i / n * D), Y(zsV[i]));
  c.lineTo(X(D), T + ph); c.lineTo(X(0), T + ph); c.closePath();
  c.fillStyle = 'rgba(126,231,135,.18)'; c.fill();
  // خط المقطع
  c.beginPath(); c.moveTo(X(0), Y(zsV[0]));
  for (let i = 1; i <= n; i++) c.lineTo(X(i / n * D), Y(zsV[i]));
  c.strokeStyle = '#7ee787'; c.lineWidth = 2; c.stroke();
  // النقاط على المسار نفسه
  const onLine = pointsOnLine(ST.job.points, A, B, CORRIDOR);
  for (const o of onLine) {
    const surveyed = o.p.elev != null, v = surveyed ? o.p.elev : zAt(o.p);
    c.beginPath(); c.arc(X(o.d), Y(v), 4, 0, 7);
    if (surveyed) { c.fillStyle = '#ffd34d'; c.fill(); }
    c.strokeStyle = surveyed ? '#fff' : '#ffd34d'; c.lineWidth = 1.5; c.stroke();
    c.fillStyle = surveyed ? '#ffd34d' : '#8a96a8'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center';
    c.fillText(o.p.id, X(o.d), Y(v) - 7);
  }
  // علامتا أ وب
  c.setLineDash([4, 3]); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(X(0), T); c.lineTo(X(0), T + ph); c.moveTo(X(D), T); c.lineTo(X(D), T + ph); c.stroke(); c.setLineDash([]);
  c.fillStyle = '#fff'; c.font = 'bold 11px sans-serif'; c.textAlign = 'left';
  c.fillText('أ', X(0) + 4, T + 10); c.textAlign = 'right'; c.fillText('ب', X(D) - 4, T + 10);
  c.textAlign = 'start';
}

function draw(c) {
  if (!A) return;
  const [ax, ay] = MV.w2m(A.x, A.z);
  if (B) {
    const [bx, by] = MV.w2m(B.x, B.z);
    c.setLineDash([6, 4]); c.strokeStyle = 'rgba(126,231,135,.9)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.setLineDash([]);
    // ممر ± 12 م
    const an = Math.atan2(by - ay, bx - ax), w = Math.min(12, 12) * MV.ppm();
    c.fillStyle = 'rgba(126,231,135,.10)';
    c.save(); c.translate((ax + bx) / 2, (ay + by) / 2); c.rotate(an);
    c.fillRect(-Math.hypot(bx - ax, by - ay) / 2, -w, Math.hypot(bx - ax, by - ay), w * 2); c.restore();
    mark(c, bx, by, 'ب', '#7ee787');
  }
  mark(c, ax, ay, 'أ', '#ffd34d');
}
function mark(c, x, y, t, col) {
  c.fillStyle = col; c.strokeStyle = '#000'; c.lineWidth = 2;
  c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill(); c.stroke();
  c.fillStyle = '#000'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(t, x, y + 0.5); c.textBaseline = 'alphabetic'; c.textAlign = 'start';
}
const niceStep = t => { const p = Math.pow(10, Math.floor(Math.log10(Math.max(1e-6, t)))); for (const m of [1, 2, 5, 10]) if (m * p >= t) return m * p; return 10 * p; };
const fmtAxis = v => Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(0) : (Math.round(v * 100) / 100).toString();
