// عرض الخريطة (T-003 / B-011): نافذة الإحداثيات والتكبير والتحريك ومقياس الرسم
// map.js يملك الأدوات؛ هذه الوحدة تملك «كيف نرى»: cx/cz مركز الإطار وppm بكسل لكل متر.
import { ST } from './state.js';
import { mapImage } from './world.js';

const HALF = 500;                 // مطابق لـ HALF في map.js (حدود العالم)
const LEVELS = [500, 250, 125, 62.5, 31.25]; // مستويات صورة الخريطة (نصف عرضها بالمتر)
const D_MAX = 25;                 // أقل أمتار عبر الشاشة عند أقصى تكبير
const UI = 0.0002645833;          // طول البكسل CSS بالمتر بافتراض 96dpi

let MS = 480, DPR = 1;            // حجم اللوحة بالبكسل المنطقي ونسبة الجهاز
const view = { cx: 0, cz: 0, ppm: 0.48 };

export function setMS(ms, dpr) { MS = ms; DPR = dpr; clampView(); }
export const ppm = () => view.ppm;
export function w2m(x, z) { return [(x - view.cx) * view.ppm + MS / 2, (z - view.cz) * view.ppm + MS / 2]; }
export function m2w(px, py) { return [(px - MS / 2) / view.ppm + view.cx, (py - MS / 2) / view.ppm + view.cz]; }
export function visible() { const h = MS / 2 / view.ppm; return { x0: view.cx - h, x1: view.cx + h, z0: view.cz - h, z1: view.cz + h }; }
export function gridStep() { const t = 55 / view.ppm; for (const s of [1, 2, 5, 10, 20, 50, 100, 200, 500]) if (s >= t) return s; return 500; }
/** نصف قطر التقاط بالنقاط (بالمتر) مكيف مع التكبير — pxRec البكسل المطلوب على الشاشة */
export function hitR(pxRec = 16) { return Math.min(60, Math.max(3, pxRec / view.ppm)); }
export function clampView() { view.ppm = Math.min(Math.max(view.ppm, MS / (2 * HALF)), MS / D_MAX); const h = MS / 2 / view.ppm, m = HALF - Math.min(h, HALF); view.cx = Math.min(Math.max(view.cx, -m), m); view.cz = Math.min(Math.max(view.cz, -m), m); }
export function zoomAt(px, py, f) { const [x, z] = m2w(px, py); view.ppm = Math.min(Math.max(view.ppm * f, MS / (2 * HALF)), MS / D_MAX); view.cx = x - (px - MS / 2) / view.ppm; view.cz = z - (py - MS / 2) / view.ppm; clampView(); }
export function zoomWorld(wx, wz, f, px, py) { view.ppm = Math.min(Math.max(view.ppm * f, MS / (2 * HALF)), MS / D_MAX); view.cx = wx - (px - MS / 2) / view.ppm; view.cz = wz - (py - MS / 2) / view.ppm; clampView(); }
export function panBy(dx, dy) { view.cx -= dx / view.ppm; view.cz -= dy / view.ppm; clampView(); }
export function home() { view.cx = 0; view.cz = 0; view.ppm = MS / (2 * HALF); applyImage(); }

// ---------- صورة الخريطة (إعادة توليد بمستوى أدق عند نهاية الإيماءة) ----------
let settling = false, imgT = null;
export const gestureActive = on => { settling = on; };
export function ensureImage() { if (!settling) applyImage(); }
export function requestImage(cb) { clearTimeout(imgT); imgT = setTimeout(() => { applyImage(); if (cb) cb(); }, 170); }
function applyImage() {
  const hv = MS / 2 / view.ppm, need = Math.max(Math.abs(view.cx), Math.abs(view.cz)) + hv + 1;
  let lvl = LEVELS[0];                       // الأوسع افتراضاً: عند العرض الكامل (need > 500) تبقى الصورة 500 م لا تختفي
  for (const L of LEVELS) if (need <= L) { lvl = L; break; }
  if (!ST.mapImg || ST.mapImg.half !== lvl) ST.mapImg = mapImage(lvl, 480);
}

// ---------- مقياس الرسم المتغير + سهم الشمال ----------
export function drawScaleBar(c) {
  const mpp = 1 / view.ppm, N = Math.round(mpp / UI);
  const target = 90, cand = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  let len = cand[cand.length - 1]; for (const s of cand) if (s >= target * mpp) { len = s; break; }
  const px = len * view.ppm, x0 = 10, y0 = MS - 16;
  c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(x0 - 4, y0 - 12, px + 8, 22);
  c.fillStyle = '#fff'; c.fillRect(x0, y0 - 6, px / 2, 4);
  c.strokeStyle = '#fff'; c.lineWidth = 1; c.strokeRect(x0 + px / 2, y0 - 6, px / 2, 4);
  c.font = 'bold 11px sans-serif'; c.textAlign = 'left';
  c.fillText(`${len} م`, x0 + px + 6, y0 - 2);
  c.fillText(`مقياس 1:${N.toLocaleString('en')}`, x0 + 2, y0 - 8);
  c.textAlign = 'start';
}
