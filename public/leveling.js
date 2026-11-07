// التركيب والأرجل — استُخرج من main.js (B-003)
import { $, clamp, cap, wrapPi, TAU, toast, $$ } from './util.js';
import * as I from './instrument.js';
import { ST } from './state.js';

export const LC = ['#ff6b6b', '#51cf66', '#4dabf7'];
const lv = $('#lv'), lc = lv.getContext('2d'), LS = 300;
const KN = [{ x: 59, y: 202 }, { x: 241, y: 202 }, { x: 150, y: 45 }], NAMES = ['A', 'B', 'C'];
(function () { const d = Math.min(devicePixelRatio || 1, 2); lv.width = LS * d; lv.height = LS * d; lc.setTransform(d, 0, 0, d, 0, 0); })();
export function drawLevel() {
  const c = lc, T = I.getTilt(), ty = I.TY(), kind = I.type, h = I.st.heading, ax = Math.sin(h), ay = -Math.cos(h);
  c.clearRect(0, 0, LS, LS);
  c.strokeStyle = '#33425a'; c.lineWidth = 4; c.beginPath();
  KN.forEach((k, i) => (i ? c.lineTo(k.x, k.y) : c.moveTo(k.x, k.y))); c.closePath(); c.stroke();
  if (kind === 'theo' || kind === 'tach') {
    const b = (T.gx * Math.cos(h) + T.gz * Math.sin(h)) * 3437.75, half = 75, k = half / ty.vial;
    c.save(); c.translate(150, 150); c.rotate(h);
    c.fillStyle = '#0d2a22'; c.fillRect(-half, -14, 2 * half, 28); c.strokeStyle = '#5fd6b0'; c.lineWidth = 2; c.strokeRect(-half, -14, 2 * half, 28);
    for (let t = -4; t <= 4; t++) { c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(t * k, -14); c.lineTo(t * k, -8); c.stroke(); }
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-ty.ring * k, -14); c.lineTo(-ty.ring * k, 14); c.moveTo(ty.ring * k, -14); c.lineTo(ty.ring * k, 14); c.stroke();
    c.fillStyle = 'rgba(190,255,225,.9)'; c.beginPath(); c.ellipse(clamp(b * k, -half + 16, half - 16), 0, 16, 9, 0, 0, 7); c.fill();
    c.restore();
  } else {
    const k = 70 / (ty.vial / 3437.75);
    c.fillStyle = '#0d2a22'; c.beginPath(); c.arc(150, 150, 70, 0, 7); c.fill();
    c.strokeStyle = '#5fd6b0'; c.lineWidth = 2; c.stroke();
    c.setLineDash([4, 4]); c.strokeStyle = '#e6c84c'; c.beginPath(); c.arc(150, 150, 70 * ty.comp / ty.vial, 0, 7); c.stroke(); c.setLineDash([]);
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(150, 150, 70 * ty.ring / ty.vial, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(255,159,67,.9)'; c.lineWidth = 3; c.beginPath();
    c.moveTo(150 - ax * 66, 150 - ay * 66); c.lineTo(150 + ax * 66, 150 + ay * 66); c.stroke();
    let bx = T.gx * k, by = T.gz * k; const L = Math.hypot(bx, by);
    if (L > 61) { bx *= 61 / L; by *= 61 / L; }
    c.fillStyle = 'rgba(190,255,225,.9)'; c.beginPath(); c.arc(150 + bx, 150 + by, 9, 0, 7); c.fill();
  }
  c.fillStyle = '#ff9f43'; c.beginPath();
  c.moveTo(150 + ax * 80, 150 + ay * 80); c.lineTo(150 + ax * 64 - ay * 7, 150 + ay * 64 + ax * 7); c.lineTo(150 + ax * 64 + ay * 7, 150 + ay * 64 - ax * 7); c.fill();
  KN.forEach((k, i) => {
    c.fillStyle = '#c9ced6'; c.beginPath(); c.arc(k.x, k.y, 30, 0, 7); c.fill();
    c.strokeStyle = '#5b6573'; c.lineWidth = 3; c.stroke();
    const a = I.st.e[i] / I.PITCH * 2 * Math.PI;
    c.strokeStyle = '#d33'; c.lineWidth = 4; c.beginPath();
    c.moveTo(k.x + Math.cos(a) * 17, k.y + Math.sin(a) * 17); c.lineTo(k.x + Math.cos(a) * 28, k.y + Math.sin(a) * 28); c.stroke();
    c.fillStyle = '#2a2f38'; c.beginPath(); c.arc(k.x, k.y, 14, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(NAMES[i], k.x, k.y + 1);
    if (I.st.e[i] <= 0 || I.st.e[i] >= I.EMAX) { c.fillStyle = '#ff7b72'; c.font = '11px sans-serif'; c.fillText('نهاية', k.x, k.y + (i === 2 ? -40 : 42)); }
  });
  c.fillStyle = '#778'; c.font = '11px sans-serif'; c.textAlign = 'center'; c.fillText('شمال ↑', 150, 12);
  if (!I.st.mounted) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, LS, LS); c.fillStyle = '#fff'; c.font = '16px sans-serif'; c.fillText('ركّب الجهاز أولاً', 150, 150); }
}
const hv = $('#hv'), hc = hv.getContext('2d');
(function () { const d = Math.min(devicePixelRatio || 1, 2); hv.width = 180 * d; hv.height = 180 * d; hc.setTransform(d, 0, 0, d, 0, 0); })();
export function drawHead() {
  const c = hc, st = I.st, k = 48 / 0.05236;
  c.clearRect(0, 0, 180, 180);
  I.LEGA.forEach((a, i) => {
    const x = 90 + Math.cos(a) * 74, y = 90 + Math.sin(a) * 74;
    c.strokeStyle = '#33425a'; c.lineWidth = 3; c.beginPath(); c.moveTo(90, 90); c.lineTo(x, y); c.stroke();
    c.fillStyle = LC[i]; c.beginPath(); c.arc(x, y, 13, 0, 7); c.fill();
    c.fillStyle = '#000'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(i + 1), x, y + 1);
  });
  c.fillStyle = '#0d2a22'; c.beginPath(); c.arc(90, 90, 48, 0, 7); c.fill();
  c.strokeStyle = '#5fd6b0'; c.lineWidth = 2; c.stroke();
  c.setLineDash([4, 4]); c.strokeStyle = '#e6c84c'; c.beginPath(); c.arc(90, 90, 48 * 1.5 / 3, 0, 7); c.stroke(); c.setLineDash([]);
  c.strokeStyle = '#fff'; c.beginPath(); c.arc(90, 90, 48 * 0.5 / 3, 0, 7); c.stroke();
  let bx = st.tx * k, by = st.tz * k; const L = Math.hypot(bx, by);
  if (L > 40) { bx *= 40 / L; by *= 40 / L; }
  c.fillStyle = 'rgba(190,255,225,.9)'; c.beginPath(); c.arc(90 + bx, 90 + by, 7, 0, 7); c.fill();
}
const drag = new Map();
const lvPos = e => { const r = lv.getBoundingClientRect(), s = LS / (r.width || LS); return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s }; };
lv.addEventListener('pointerdown', e => {
  if (!I.st.mounted) return;
  const p = lvPos(e); let bi = -1, bd = 1e9;
  KN.forEach((k, i) => { const d = Math.hypot(p.x - k.x, p.y - k.y); if (d < bd) { bd = d; bi = i; } });
  if (bd > 50) return;
  cap(lv, e.pointerId);
  drag.set(e.pointerId, { i: bi, a: Math.atan2(p.y - KN[bi].y, p.x - KN[bi].x) });
});
lv.addEventListener('pointermove', e => {
  const d = drag.get(e.pointerId); if (!d) return;
  const p = lvPos(e), a = Math.atan2(p.y - KN[d.i].y, p.x - KN[d.i].x);
  const da = wrapPi(a - d.a); d.a = a;
  if (!Number.isFinite(da)) return;
  if (!I.turnScrew(d.i, da / TAU * (ST.fine ? 0.1 : 1))) toast('وصل البرغي نهاية مداه — أعِد باقي البراغي لمنتصف مداها');
});
const dEnd = e => drag.delete(e.pointerId);
lv.addEventListener('pointerup', dEnd);
lv.addEventListener('pointercancel', dEnd);
$$('[data-sc]').forEach(b => (b.onclick = () => {
  if (!I.st.mounted) return toast('ركّب الجهاز أولاً');
  const [i, d] = b.dataset.sc.split(',');
  if (!I.turnScrew(+i, +d * (ST.fine ? 1 / 40 : 0.125))) toast('وصل البرغي نهاية مداه');
}));
