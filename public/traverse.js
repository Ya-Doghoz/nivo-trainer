// المسار المساحي Traverse (T-003): محطات متتابعة بالنقر + أطوال وزوايا/اتجاهات بخانات فارغة
// ثم حساب الإحداثيات وخطأ الإغلاق ودقة 1:N ومجموع الزوايا والمقارنة مع مواضع المحطات الحقيقية.
import { $, toast } from './util.js';
import { ST } from './state.js';
import { crd } from './job.js';
import { H } from './hooks.js';
import { drawMap, pushUndo } from './map.js';
import * as MV from './map-view.js';
import { parseAngle, nearest, traverseCompute } from './field-math.js';

// حالة المسار بيانات داخل ST.job.shapes (تُحفظ مع المهمة وتعود بعد إعادة التحميل)
const shapes = () => (ST.job.shapes || (ST.job.shapes = {}));
const TV = () => { const sh = shapes(); return sh.traverse || (sh.traverse = { stations: [], legs: [] }); };
let comp = null;  // نتيجة آخر حساب (تعاد على اللوحة)
H.addFeatTap('trav', (x, z) => {
  const tv = TV();
  const p = nearest(ST.job.points, x, z, MV.hitR(15));
  const s = { x: p ? p.x : x, z: p ? p.z : z, label: p ? p.id : null };
  pushUndo();
  tv.stations.push(s); tv.legs.push({ d: null, dir: null });
  $('#travBox').open = true;
  toast(`🧭 محطة ${nextTlabel(tv)} ${p ? 'على نقطة ' + p.id : ''} — أطوالها وزواياها في لوحة المسار`);
  comp = null; render();
});
H.addDrawer(draw);
H.addRefresh(() => { comp = null; render(); });
$('#travMode').addEventListener('change', render);
$('#travClosed').addEventListener('change', () => { const tv = TV(); tv.closed = $('#travClosed').checked; comp = null; render(); });
$('#travClear').onclick = () => { pushUndo(); shapes().traverse = { stations: [], legs: [], closed: $('#travClosed').checked }; comp = null; render(); drawMap(); toast('مُسح المسار'); };
$('#travCalc').onclick = () => { comp = compute(); render(); };
$('#travAz0').addEventListener('change', () => { comp = null; render(); });
$('#travTable').addEventListener('change', e => {
  const t = e.target;
  if (!t.dataset.leg) return;
  const tv = TV(), leg = tv.legs[+t.dataset.leg];
  if (!leg) return;
  const v = t.dataset.kind === 'd' ? parseFloat(t.value) : parseAngle(t.value);
  if (t.value !== '' && v == null) { t.classList.add('bad'); return; }
  t.classList.remove('bad'); t.classList.toggle('ok', v != null);
  if (t.value === '') { leg[t.dataset.kind] = null; } else { leg[t.dataset.kind] = v; }
  if (t.dataset.kind === 'dir') leg.dirTxt = t.value;
  comp = null;
});
$('#travTable').addEventListener('click', e => {
  const b = e.target.closest('button[data-del]'); if (!b) return;
  const tv = TV(), i = +b.dataset.del;
  if (i < 0 || i >= tv.stations.length) return;
  pushUndo();
  tv.stations.splice(i, 1); tv.legs.splice(i, 1);
  comp = null; render(); drawMap();
});

function nextTlabel(tv) { return 'T' + tv.stations.length; }
function render() {
  const tv = TV(), mode = $('#travMode').value, closed = $('#travClosed').checked, box = $('#travTable');
  if (tv.closed !== undefined) $('#travClosed').checked = tv.closed;
  const n = tv.stations.length, need = closed ? n : Math.max(0, n - 1);
  let html = '';
  tv.stations.forEach((s, i) => {
    const leg = tv.legs[i] || { d: null, dir: null };
    const c = crd(s.x, s.z);
    const isLast = i === n - 1;
    const toLbl = closed && isLast ? '← إلى T1' : isLast ? '' : `إلى T${i + 2}`;
    html += `<div class="trow"><b style="min-width:26px">T${i + 1}${s.label ? `<span class="mx" style="font-size:10px">(${s.label})</span>` : ''}</b>` +
      `<span class="mx" style="font-size:10px">E ${c.E.toFixed(0)} N ${c.N.toFixed(0)}</span>` +
      `<input type="number" inputmode="decimal" step="0.001" placeholder="الطول${toLbl ? ' ' + toLbl : ''} (م)" data-leg="${i}" data-kind="d" value="${leg.d != null ? +leg.d.toFixed(3) : ''}" ${isLast && !closed ? 'disabled' : ''}>` +
      `<input type="text" inputmode="decimal" placeholder="${mode === 'ang' ? 'زاوية عندها °' : 'اتجاه الضلع °'}" data-leg="${i}" data-kind="dir" value="${leg.dirTxt || ''}">` +
      `<button data-del="${i}" title="حذف المحطة">✕</button></div>`;
  });
  box.innerHTML = html || '<p class="note">انقر محطات على الخريطة بأداة 🧭 مسار — تظهر هنا تلقائياً.</p>';
  renderRes();
}
function renderRes() {
  const tv = TV(), box = $('#travRes'), mode = $('#travMode').value, closed = $('#travClosed').checked;
  const n = tv.stations.length;
  if (!n) { box.innerHTML = ''; return; }
  if (!comp) { box.innerHTML = n < (closed ? 3 : 2) ? `<p class="note">${closed ? 'يحتاج 3 محطات على الأقل.' : 'يحتاج محطتين على الأقل.'}</p>` : '<p class="note">أدخل الأطوال والزوايا ثم اضغط «🧮 احسب وتحقّق».</p>'; return; }
  if (comp.err) { box.innerHTML = `<div class="stat bad">⚠ ${comp.err}</div>`; return; }
  const verdict = comp.denom >= 5000 ? '<span class="ok">جيد جداً ✓</span>' : comp.denom >= 2000 ? '<span class="warn">مقبول</span>' : '<span class="bad">ضعيف — راجع قياساتك</span>';
  let html = `<table><tr><th>المحطة</th><th>E محسوب</th><th>N محسوب</th><th>E حقيقي</th><th>N حقيقي</th><th>Δ (م)</th></tr>`;
  tv.stations.forEach((s, i) => {
    const cp = crd(comp.coords[i].x, comp.coords[i].z), ct = crd(s.x, s.z), dv = comp.devs[i];
    html += `<tr><td>T${i + 1}</td><td>${cp.E.toFixed(2)}</td><td>${cp.N.toFixed(2)}</td><td>${ct.E.toFixed(2)}</td><td>${ct.N.toFixed(2)}</td><td class="${dv < 0.05 ? 'ok' : dv < 0.5 ? 'warn' : 'bad'}">${dv.toFixed(3)}</td></tr>`;
  });
  html += '</table>';
  html += `<div class="st">خطأ الإغلاق: <b>${comp.closure.toFixed(3)} م</b> · المحيط: <b>${comp.perimeter.toFixed(1)} م</b> · دقة المسار: <b>${Number.isFinite(comp.denom) ? '1:' + comp.denom.toLocaleString('en') : '∞ (مغلق تماماً)'}</b> — ${verdict}</div>`;
  if (comp.angleSum != null) {
    const dSum = comp.angleSum * 180 / Math.PI, dExp = comp.expSum * 180 / Math.PI, dMis = (comp.angleSum - comp.expSum) * 180 / Math.PI;
    html += `<div class="st">مجموع زواياك: <b>${dSum.toFixed(3)}°</b> · المتوقع: <b>${dExp.toFixed(0)}°</b> (امشِ عكس عقارب الساعة) · فرق الزوايا: <b>${dMis.toFixed(3)}°</b> ${Math.abs(dMis) < 1 ? '<span class="ok">✓</span>' : '<span class="warn">⚠ راجع الزوايا</span>'}</div>`;
  }
  box.innerHTML = html;
}
function compute() {
  const tv = TV(), mode = $('#travMode').value, closed = $('#travClosed').checked;
  const az0 = parseAngle($('#travAz0').value);
  return traverseCompute({ stations: tv.stations, legs: tv.legs, mode, closed, startAz: az0 });
}
function draw(c) {
  const tv = TV(); if (!tv.stations.length) return;
  // أضلاع المسار (متقطعة إن لم يُحسب)
  c.setLineDash(comp ? [] : [6, 4]); c.strokeStyle = 'rgba(77,171,247,.95)'; c.lineWidth = 2;
  c.beginPath();
  tv.stations.forEach((s, i) => { const [x, y] = MV.w2m(s.x, s.z); i ? c.lineTo(x, y) : c.moveTo(x, y); });
  if ($('#travClosed').checked) { const [x0, y0] = MV.w2m(tv.stations[0].x, tv.stations[0].z); c.lineTo(x0, y0); }
  c.stroke(); c.setLineDash([]);
  // المحطات: مربعات خضراء — تسميتها أسفل يسار الرمز عمداً: أسماء النقاط في drawMap فوق يمين
  // الرمز نفسه، فلا يتكدّس الاسمان فوق بعض عندما تقع المحطة على نقطة مسجلة.
  tv.stations.forEach((s, i) => {
    const [x, y] = MV.w2m(s.x, s.z);
    c.fillStyle = '#2ea043'; c.strokeStyle = '#fff'; c.lineWidth = 1.5;
    c.fillRect(x - 6, y - 6, 12, 12); c.strokeRect(x - 6, y - 6, 12, 12);
    c.font = 'bold 12px sans-serif'; c.lineWidth = 3; c.strokeStyle = '#000'; c.textAlign = 'right';
    c.strokeText('T' + (i + 1), x - 9, y + 15); c.fillStyle = '#7ee787'; c.fillText('T' + (i + 1), x - 9, y + 15);
    c.textAlign = 'start';
    if (comp && !comp.err && comp.devs[i] > 0.05) {
      const [cx, cy] = MV.w2m(comp.coords[i].x, comp.coords[i].z);
      c.strokeStyle = '#ff7b72'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x, y); c.lineTo(cx, cy); c.stroke();
      c.fillStyle = '#ff7b72'; c.beginPath(); c.moveTo(cx, cy - 5); c.lineTo(cx + 5, cy + 4); c.lineTo(cx - 5, cy + 4); c.closePath(); c.fill();
    }
  });
  // خط الإغلاق: من نهاية المحسوب إلى البداية
  if (comp && !comp.err && comp.closure > 0.02) {
    const end = comp.coords[comp.coords.length - 1], st0 = tv.stations[0];
    const [ex, ey] = MV.w2m(end.x, end.z), [sx, sy] = MV.w2m(st0.x, st0.z);
    c.setLineDash([3, 3]); c.strokeStyle = '#ff7b72'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(ex, ey); c.lineTo(sx, sy); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#ff7b72'; c.font = 'bold 11px sans-serif';
    c.fillText(comp.closure.toFixed(2) + ' م', (ex + sx) / 2 + 4, (ey + sy) / 2);
  }
}
