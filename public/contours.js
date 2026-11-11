// خريطة كنتورية من نقاط الطالب (T-003): IDW + Marching Squares فوق الخريطة، بفاصل كنتوري يختاره الطالب.
// الهدف التربوي: ربط القياسات الميدانية (المناسيب المسوّحة) بتمثيل سطح الأرض.
import { $, toast } from './util.js';
import { ST } from './state.js';
import { H } from './hooks.js';
import { drawMap } from './map.js';
import * as MV from './map-view.js';
import { idwGrid, marchingSquares } from './field-math.js';

let cache = null;   // {iv, lines:[{level, polylines}], n, min, max, fromN}
let show = true;

H.addFeatTap('cont', () => {
  $('#contBox').open = true;
  const n = surveyed().length;
  toast(n >= 3 ? '⛰ اضغط «ارسم» لتحديث كنتور نقاطك (' + n + ' نقاط مسوّاة)' : '⛰ سجّل مناسيب 3 نقاط على الأقل بأداة 🔍 ثم ارسم');
});
H.addDrawer(draw);
H.addRefresh(() => { if (cache) go(true); });       // تحديث تلقائي بعد تغيير منسوب/تراجع
$('#contGo').onclick = () => go(false);
$('#contShow').addEventListener('change', () => { show = $('#contShow').checked; drawMap(); });
$('[data-mt="cont"]').addEventListener('click', () => { $('#contBox').open = true; });

const surveyed = () => ST.job.points.filter(p => p.elev != null);

function go(quiet) {
  const pts = surveyed(), iv = parseFloat($('#contIv').value) || 1;
  if (pts.length < 3) {
    cache = null; $('#contInfo').textContent = `لديك ${pts.length} نقطة بمنسوب مسوّح — تحتاج 3 على الأقل. استعمل أداة 🔍 استعلام (أو حقل RL للـ BM في القائمة) لتسجيل مناسيب نقاطك.`;
    if (!quiet) toast('⛰ تحتاج 3 نقاط بمناسيب على الأقل');
    drawMap(); return;
  }
  const t0 = performance.now();
  // حدود الشبكة: صندوق النقاط + هامش
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
  const mx = Math.max(15, (x1 - x0) * 0.15, (z1 - z0) * 0.15);
  x0 -= mx; x1 += mx; z0 -= mx; z1 += mx;
  const cell = Math.max(1, Math.round(Math.max(x1 - x0, z1 - z0) / 150));
  const nx = Math.min(180, Math.max(8, Math.ceil((x1 - x0) / cell) + 1)), nz = Math.min(180, Math.max(8, Math.ceil((z1 - z0) / cell) + 1));
  const dx = (x1 - x0) / (nx - 1), dz = (z1 - z0) / (nz - 1);
  const g = idwGrid(pts.map(p => ({ x: p.x, z: p.z, v: p.elev })), x0, z0, nx, nz, dx, dz);
  let mn = Infinity, mxv = -Infinity;
  for (const v of g) { if (v < mn) mn = v; if (v > mxv) mxv = v; }
  const lines = [];
  const ivNice = iv;
  for (let lv = Math.ceil(mn / ivNice) * ivNice; lv <= mxv + 1e-9; lv += ivNice) {
    const polylines = marchingSquares(g, nx, nz, lv, x0, z0, dx, dz).filter(pl => pl.length >= 2);
    if (polylines.length) lines.push({ level: Math.round(lv * 100) / 100, polylines });
  }
  cache = { iv: ivNice, lines, n: pts.length, min: mn, max: mxv, fromN: pts.length };
  const ms = (performance.now() - t0).toFixed(0);
  $('#contInfo').innerHTML = `رُسم من <b>${pts.length}</b> نقطة (${pts.map(p => p.id).join('، ')}) · الفاصل <b>${ivNice} م</b> · <b>${lines.length}</b> خط كنتوري · مدى المناسيب ${mn.toFixed(2)} – ${mxv.toFixed(2)} م · زمن ${ms} مللي ثانية${(mxv - mn) / ivNice > 40 ? '<br><span class="warn">⚠ عدد الخطوط كبير — جرّب فاصلاً أكبر</span>' : ''}`;
  if (!quiet) toast('⛰ رُسم ' + lines.length + ' خط كنتوري بفاصل ' + ivNice + ' م');
  drawMap();
}

function draw(c) {
  if (!cache || !show || !cache.lines.length) return;
  const idxEvery = Math.max(1, Math.round(cache.iv * 5 / cache.iv) * 5); // خط دليل كل 5 أضعاف الفاصل تقريباً
  for (const ln of cache.lines) {
    const isIdx = Math.abs((ln.level / cache.iv) % 5) < 1e-6;
    c.strokeStyle = 'rgba(194,96,58,.9)';
    c.lineWidth = isIdx ? 2 : 1;
    for (const pl of ln.polylines) {
      c.beginPath();
      pl.forEach((p, i) => { const [x, y] = MV.w2m(p[0], p[1]); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      if (pl.length > 2) c.closePath();
      c.stroke();
    }
    if (isIdx) {  // تسمية على منتصف أطول مضلع
      let best = null, bl = 0;
      for (const pl of ln.polylines) if (pl.length > bl) { bl = pl.length; best = pl; }
      if (best) {
        const m = best[Math.floor(best.length / 2)], [x, y] = MV.w2m(m[0], m[1]);
        c.font = 'bold 10px sans-serif'; c.lineWidth = 3; c.strokeStyle = '#000';
        c.strokeText(String(ln.level), x + 3, y - 3);
        c.fillStyle = '#ffb387'; c.fillText(String(ln.level), x + 3, y - 3);
      }
    }
  }
}
