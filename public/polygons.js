// المضلعات (T-003): رسم مضلع من نقاط الخريطة، خانات فارغة لطول كل ضلع (رقاقة على منتصف الضلع
// على الخريطة + جدول) وللزاوية عند كل رأس، والمقارنة بالقيم الفعلية بعد الإدخال فقط.
import { $, toast } from './util.js';
import { ST } from './state.js';
import { ptById, nextId } from './job.js';
import { H } from './hooks.js';
import { drawMap, pushUndo } from './map.js';
import { onJobChanged } from './transfer.js';
import * as MV from './map-view.js';
import { isWater } from './world.js';
import { parseAngle, nearest, polyCheck } from './field-math.js';

const shapes = () => (ST.job.shapes || (ST.job.shapes = {}));
const polys = () => (shapes().polys || (shapes().polys = []));
let active = 0;                  // فهرس المضلع النشط
let pop = null;                  // {kind:'edge'|'ang', poly, i, x, z} — نافذة الإدخال

const vertsOf = poly => poly.verts.map(id => ptById(id)).filter(Boolean);
const ACT = () => polys()[Math.min(active, polys().length - 1)];

H.addFeatTap('poly', (x, z) => {
  hidePop();
  let ps = polys();
  // مضلع نشط مفتوح؟ الرأس الأول يغلقه
  let p = ACT();
  if (p && !p.closed && p.verts.length >= 3) {
    const first = ptById(p.verts[0]);
    if (first && Math.hypot(first.x - x, first.z - z) <= MV.hitR(16)) { closePoly(); return; }
  }
  // نقر على رأس المضلع النشط المغلق → نافذة زاويته، وعلى ضلعه → نافذة طوله (الرأس أولاً)
  if (p && p.closed) {
    const vi = vertHit(p, x, z);
    if (vi != null) { openPop('ang', p, vi, x, z); return; }
    const hit = edgeHit(p, x, z);
    if (hit != null) { openPop('edge', p, hit, x, z); return; }
  }
  // وإلا: إضافة رأس (نقطة موجودة أو جديدة)
  if (!p || p.closed) { p = { verts: [], edges: [], angles: [], closed: false }; ps.push(p); active = ps.length - 1; toast('⬛ بدأ مضلع جديد — انقر الرؤوس بالتتابع'); }
  const ex = nearest(ST.job.points, x, z, MV.hitR(15));
  if (ex) {
    if (p.verts.includes(ex.id)) return toast('الرأس ' + ex.id + ' موجود في المضلع مسبقاً');
    pushUndo(); p.verts.push(ex.id); p.edges.push(null); p.angles.push(null); toast('رأس على نقطة ' + ex.id);
  }
  else {
    if (isWater(x, z)) return toast('💧 لا يمكن وضع نقطة داخل الماء');
    pushUndo();
    const np = { id: nextId('P'), x, z, bm: false, elev: null };
    ST.job.points.push(np);
    onJobChanged();
    p.verts.push(np.id); p.edges.push(null); p.angles.push(null);
    toast('رأس جديد: نقطة ' + np.id);
  }
  $('#polyBox').open = true;
  render();
});
H.addDrawer(draw);
H.addRefresh(() => { clean(); render(); });

$('#polyNew').onclick = () => { const ps = polys(); pushUndo(); ps.push({ verts: [], edges: [], angles: [], closed: false }); active = ps.length - 1; render(); drawMap(); toast('⬛ مضلع جديد — انقر رؤوسه على الخريطة'); };
$('#polyCloseB').onclick = () => closePoly();
$('#polyDel').onclick = () => {
  const ps = polys(), p = ACT(); if (!p) return;
  pushUndo(); ps.splice(Math.min(active, ps.length - 1), 1); active = 0;
  render(); drawMap(); toast('حُذف المضلع');
};
$('#polySel').addEventListener('change', () => { active = +$('#polySel').value || 0; render(); drawMap(); });
$('#polyTable').addEventListener('change', e => {
  const t = e.target;
  if (!t.dataset.pi) return;
  const p = polys()[+t.dataset.pi]; if (!p) return;
  const i = +t.dataset.i, kind = t.dataset.kind;
  const v = kind === 'e' ? parseFloat(t.value) : parseAngle(t.value);
  if (t.value !== '' && v == null) { t.classList.add('bad'); return; }
  t.classList.remove('bad');
  p[kind === 'e' ? 'edges' : 'angles'][i] = t.value === '' ? null : v;
  if (kind === 'a') { p.anglesTxt = p.anglesTxt || {}; p.anglesTxt[i] = t.value; }
  render();
});
$('#polyTable').addEventListener('click', e => {
  const b = e.target.closest('button[data-vdel]'); if (!b) return;
  const p = polys()[+b.dataset.pi]; if (!p) return;
  const i = +b.dataset.vdel;
  pushUndo();
  p.verts.splice(i, 1); p.edges.splice(i, 1); p.angles.splice(i, 1);
  if (p.verts.length < 3) p.closed = false;
  render(); drawMap();
});
$('#polyPop').addEventListener('click', e => {
  if (e.target.id === 'polyCancel') hidePop();
});
$('#polySave').onclick = () => {
  if (!pop) return;
  const p = pop.poly, i = pop.i, isEdge = pop.kind === 'edge';
  const v = isEdge ? parseFloat($('#polyIn').value) : parseAngle($('#polyIn').value);
  if (v == null) return toast('أدخل قيمة رقمية صحيحة (تقبل 45 أو 45 30 15)');
  pushUndo();
  if (isEdge) p.edges[i] = v; else { p.anglesTxt = p.anglesTxt || {}; p.anglesTxt[i] = $('#polyIn').value; p.angles[i] = v; }
  hidePop();
  const vs = vertsOf(p), ck = polyCheck(vs, p.edges, p.angles);
  if (isEdge) {
    const act = ck.edgeAct[i], df = ck.edgeDiff[i];
    toast(`طول الضلع ${i + 1}: أدخلت ${v.toFixed(2)} م — الفعلي ${act.toFixed(2)} م (فرق ${df >= 0 ? '+' : ''}${df.toFixed(2)})`);
  } else {
    const act = ck.angleAct[i] * 180 / Math.PI, df = (ck.angleDiff[i] || 0) * 180 / Math.PI;
    toast(`الزاوية عند الرأس ${i + 1}: أدخلت ${(v * 180 / Math.PI).toFixed(2)}° — الفعلية ${act.toFixed(2)}° (فرق ${df >= 0 ? '+' : ''}${df.toFixed(2)}°)`);
  }
  render();
};

function closePoly() {
  const p = ACT(); if (!p) return;
  if (p.closed) return toast('المضلع مغلق أصلاً');
  if (p.verts.length < 3) return toast('يحتاج 3 رؤوس على الأقل قبل الإغلاق');
  pushUndo(); p.closed = true;
  render(); drawMap();
  toast('🔒 أُغلق المضلع — انقر أي ضلع لإدخال طوله، أو أي رأس لإدخال زاويته');
}
// رقاقة على منتصف الضلع: طول الضلع بعد إدخاله، أو «الطول؟» كحقل فارغ يملؤه الطالب.
// قابلة للنقر من أي أداة (حتى التحريك) — لا حاجة للعودة لأداة ⬛ لإدخال الأطوال.
H.addChipTap((x, z) => {
  const h = chipHit(x, z);
  if (!h) return false;
  openPop('edge', h.p, h.i, x, z);
  return true;
});
function chipHit(x, z) {          // مرآة رسم الرقاقات: المضلع النشط فقط، أضلاعه المرسومة فقط
  const ps = polys(), p = ps[Math.min(active, ps.length - 1)];
  if (!p) return null;
  const vs = vertsOf(p); if (vs.length < 2) return null;
  const n = vs.length, last = p.closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const a = vs[i], b = vs[(i + 1) % n];
    const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
    if (Math.hypot(x - mx, z - mz) <= MV.hitR(22)) return { p, i };
  }
  return null;
}

function edgeHit(p, x, z) {
  const vs = vertsOf(p); if (vs.length < 2) return null;
  const r = MV.hitR(14);
  for (let i = 0; i < vs.length; i++) {
    if (!p.closed && i === vs.length - 1) break;
    const a = vs[i], b = vs[(i + 1) % vs.length];
    const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
    if (l2 < 1e-9) continue;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
    if (Math.hypot(x - a.x - t * dx, z - a.z - t * dz) <= r) return i;
  }
  return null;
}
function vertHit(p, x, z) {
  const vs = vertsOf(p), r = MV.hitR(16);
  for (let i = 0; i < vs.length; i++) if (Math.hypot(vs[i].x - x, vs[i].z - z) <= r) return i;
  return null;
}
function openPop(kind, p, i, x, z) {
  pop = { kind, poly: p, i };
  const vs = vertsOf(p);
  $('#polyTitle').textContent = kind === 'edge'
    ? `طول الضلع من ${vs[i] ? vs[i].id : '?'} إلى ${vs[(i + 1) % vs.length] ? vs[(i + 1) % vs.length].id : '?'} (م)`
    : `الزاوية الداخلية عند ${vs[i] ? vs[i].id : '?'} (°)`;
  const inp = $('#polyIn');
  inp.value = kind === 'edge' ? (p.edges[i] != null ? String(p.edges[i]) : '') : ((p.anglesTxt || {})[i] || '');
  const pp = $('#polyPop');
  pp.style.display = 'block';
  const mb = $('#mapBox').getBoundingClientRect(), r = $('#mapC').getBoundingClientRect();
  const px = r.left - mb.left + $('#mapBox').scrollLeft + MV.w2m(x, z)[0], py = r.top - mb.top + $('#mapBox').scrollTop + MV.w2m(x, z)[1];
  pp.style.left = Math.min(Math.max(px - 115, 4), Math.max(4, mb.width - 240)) + 'px';
  pp.style.top = Math.min(Math.max(py + 16, 4), Math.max(4, mb.height - 130)) + 'px';
  inp.focus();
}
function hidePop() { pop = null; $('#polyPop').style.display = 'none'; }

function clean() {   // حذف الرؤوس التي ذهبت نقاطها
  const ps = polys();
  for (const p of ps) {
    const before = p.verts.length;
    const keep = p.verts.map((id, i) => ptById(id) ? i : -1).filter(i => i >= 0);
    if (keep.length !== before) {
      p.verts = keep.map(i => p.verts[i]);
      p.edges = keep.map(i => p.edges[i]);
      p.angles = keep.map(i => p.angles[i]);
      if (p.verts.length < 3) p.closed = false;
    }
  }
  shapes().polys = ps.filter(p => p.verts.length >= 2 || !p.closed && p.verts.length > 0);
  if (active >= polys().length) active = Math.max(0, polys().length - 1);
}

function render() {
  clean();
  const ps = polys(), selBox = $('#polySel'), tbl = $('#polyTable'), stBox = $('#polyStats');
  selBox.innerHTML = ps.map((p, i) => `<option value="${i}" ${i === active ? 'selected' : ''}>مضلع ${i + 1} — ${p.verts.length} رؤوس${p.closed ? ' 🔒' : ' (مفتوح)'}</option>`).join('') || '<option value="0">لا مضلعات بعد</option>';
  const p = ACT();
  if (!p) { tbl.innerHTML = '<p class="note">أنشئ مضلعاً بالزر أو بأداة ⬛ على الخريطة.</p>'; stBox.innerHTML = ''; return; }
  const vs = vertsOf(p);
  const aTxt = i => (p['anglesTxt'] || {})[i] || (p.angles[i] != null ? (p.angles[i] * 180 / Math.PI).toFixed(2) : '');
  let html = '';
  vs.forEach((v, i) => {
    const isLast = i === vs.length - 1;
    html += `<div class="prow"><b style="min-width:30px">${v.id}</b>` +
      `<input type="number" inputmode="decimal" step="0.001" placeholder="الطول إلى ${isLast ? (p.closed ? vs[0].id : '—') : vs[i + 1].id}" data-pi="${ps.indexOf(p)}" data-i="${i}" data-kind="e" value="${p.edges[i] != null ? +p.edges[i].toFixed(3) : ''}" ${isLast && !p.closed ? 'disabled' : ''}>` +
      `<input type="text" inputmode="decimal" placeholder="الزاوية هنا °" data-pi="${ps.indexOf(p)}" data-i="${i}" data-kind="a" value="${aTxt(i)}">` +
      `<button data-vdel="${i}" data-pi="${ps.indexOf(p)}" title="حذف الرأس">✕</button></div>`;
  });
  tbl.innerHTML = html || '<p class="note">انقر رؤوس المضلع على الخريطة — تظهر هنا.</p>';
  const ck = p.closed ? polyCheck(vs, p.edges, p.angles) : null;
  const entE = p.edges.filter(e => e != null).length, entA = p.angles.filter(a => a != null).length;
  stBox.innerHTML = ck
    ? `<div>المساحة (من مواضع الرؤوس): <b>${ck.area.toFixed(1)} م²</b> (${(ck.area / 10000).toFixed(3)} هكتار) · المحيط الفعلي: <b>${ck.perimeter.toFixed(1)} م</b></div>` +
      `<div class="note">أدخلت ${entE}/${p.edges.length} طولاً و${entA}/${p.angles.length} زاوية — تظهر المقارنة عند كل خانة بعد الإدخال.</div>` +
      diffRows(p, vs, ck)
    : `<div class="note">مفتوح: ${vs.length} رؤوس · أطوال مدخلة ${entE} — أغقه (الرأس الأول أو زر 🔒) لحساب المساحة.</div>`;
}
function diffRows(p, vs, ck) {
  let out = '';
  vs.forEach((v, i) => {
    if (p.edges[i] != null) { const d = ck.edgeDiff[i]; out += `<span class="${Math.abs(d) < 0.05 ? 'ok' : Math.abs(d) < 0.5 ? 'warn' : 'bad'}">طول ${i + 1}: ${d >= 0 ? '+' : ''}${d.toFixed(2)} م</span> `; }
  });
  out += '<br>';
  vs.forEach((v, i) => {
    if (p.angles[i] != null) { const d = (ck.angleDiff[i] || 0) * 180 / Math.PI; out += `<span class="${Math.abs(d) < 0.1 ? 'ok' : Math.abs(d) < 1 ? 'warn' : 'bad'}">∠${i + 1}: ${d >= 0 ? '+' : ''}${d.toFixed(2)}°</span> `; }
  });
  return out ? `<div class="st" style="font-size:12px">${out}</div>` : '';
}

function draw(c) {
  clean();
  const ps = polys();
  ps.forEach((p, pi) => {
    const vs = vertsOf(p); if (vs.length < 2) return;
    const isActive = pi === Math.min(active, ps.length - 1);
    // الملء
    if (p.closed && vs.length >= 3) {
      c.beginPath();
      vs.forEach((v, i) => { const [x, y] = MV.w2m(v.x, v.z); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.closePath();
      c.fillStyle = isActive ? 'rgba(46,160,67,.16)' : 'rgba(46,160,67,.08)';
      c.fill();
    }
    // الأضلاع
    c.strokeStyle = isActive ? '#7ee787' : 'rgba(126,231,135,.45)';
    c.lineWidth = isActive ? 2 : 1;
    c.setLineDash(p.closed ? [] : [7, 4]);
    c.beginPath();
    vs.forEach((v, i) => { const [x, y] = MV.w2m(v.x, v.z); i ? c.lineTo(x, y) : c.moveTo(x, y); });
    if (p.closed) { const [x, y] = MV.w2m(vs[0].x, vs[0].z); c.lineTo(x, y); }
    c.stroke(); c.setLineDash([]);
    // الضلع الختامي للمفتوح: خط متقطع خفيف للرأس الأول
    if (!p.closed && vs.length >= 3) {
      const [x0, y0] = MV.w2m(vs[0].x, vs[0].z), [xn, yn] = MV.w2m(vs[vs.length - 1].x, vs[vs.length - 1].z);
      c.strokeStyle = 'rgba(126,231,135,.35)'; c.setLineDash([2, 5]);
      c.beginPath(); c.moveTo(xn, yn); c.lineTo(x0, y0); c.stroke(); c.setLineDash([]);
    }
    // رقاقات الأطوال على منتصف كل ضلع (المضلع النشط فقط) — الفارغة تظهر «الطول؟» كي يعرف الطالب ماذا يُدخل
    if (isActive) {
      const n = vs.length;
      for (let i = 0; i < (p.closed ? n : n - 1); i++) {
        const a = vs[i], b = vs[(i + 1) % n];
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        const [x, y] = MV.w2m(mx, mz);
        const txt = p.edges[i] != null ? p.edges[i].toFixed(1) : 'الطول؟';
        const entered = p.edges[i] != null;
        c.font = 'bold 12px sans-serif';
        const w = c.measureText(txt).width + 12;
        c.fillStyle = entered ? 'rgba(46,160,67,.92)' : 'rgba(10,13,18,.9)';
        c.strokeStyle = entered ? '#7ee787' : '#ffd34d'; c.lineWidth = 1.25;
        c.beginPath(); c.roundRect ? c.roundRect(x - w / 2, y - 11, w, 22, 11) : c.rect(x - w / 2, y - 11, w, 22); c.fill(); c.stroke();
        c.fillStyle = entered ? '#fff' : '#ffd34d'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(txt, x, y);
        c.textBaseline = 'alphabetic'; c.textAlign = 'start';
      }
    }
  });
}
