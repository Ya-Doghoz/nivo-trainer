// الخريطة — استُخرج من main.js (B-003) ووُسّع في T-003: نافذة عرض متحركة + إيماءات + استعلام + تراجع + طبقات الميزات
import { $, $$, toast, cap, clamp, showErr } from './util.js';
import { sideLayout, mapBox, mapOpen, isTT } from './ctx.js';
import { newJob, newWorld, randSeed, onJobChanged, placeInstrument } from './transfer.js';
import { ST } from './state.js';
import { mapImage, riverPath, bridgeList, houseList, instPos, holder, groundH, wetness, sendTo, isWater, inHouse, placeHolderAt } from './world.js';
import { H } from './hooks.js';
import * as I from './instrument.js';
import { crd, ptById, setupById, saveState, nextId, trueRL, nextSetup } from './job.js';
import { fbRefresh } from './books-level.js';
import { ttRefresh } from './books-tt.js';
import * as MV from './map-view.js';
import { cyclePick } from './field-math.js';

export const HALF = 500, MZ = 500 / 120, mapC = $('#mapC'), mctx = mapC.getContext('2d');
let mapTool = 'pt', MS = 480;

export function sizeMap() {
  const d = Math.min(devicePixelRatio || 1, 2);
  MS = Math.floor(sideLayout() ? Math.min(innerWidth * 0.55, innerHeight * 0.78, 680) : Math.min(innerWidth * 0.94, innerHeight * 0.55, 560));
  mapC.style.width = MS + 'px'; mapC.style.height = MS + 'px'; mapC.width = MS * d; mapC.height = MS * d; mctx.setTransform(d, 0, 0, d, 0, 0);
  MV.setMS(MS, d);
}
// ---------- سجلّ التراجع/الإعادة (وضع/تحريك/حذف/تثبيت/منسوب + عمليات الميزات) ----------
const undoStack = [], redoStack = [];
let seenSeed = -1;
const undoSnap = () => ({ job: JSON.parse(JSON.stringify(ST.job)) });
const undoPushSnap = s => { undoStack.push(s); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0; updUndoUI(); saveState(); };
export function pushUndo() { undoPushSnap(undoSnap()); }
const updUndoUI = () => { const u = $('#mapUndo'), r = $('#mapRedo'); if (u) u.disabled = !undoStack.length; if (r) r.disabled = !redoStack.length; };
function doUndo() {
  if (!undoStack.length) return toast('لا شيء للتراجع عنه');
  redoStack.push(undoSnap()); applyJob(undoStack.pop()); toast('↩ تراجع');
}
function doRedo() {
  if (!redoStack.length) return toast('لا شيء للإعادة');
  undoStack.push(undoSnap()); applyJob(redoStack.pop()); toast('↪ إعادة');
}
function applyJob(s) {
  const oldSt = holder.station;
  ST.job = s.job;
  const cur = ST.job.setups[ST.job.cur] || ST.job.setups[0];
  if (cur && (cur.x !== instPos.x || cur.z !== instPos.z)) placeInstrument(cur, true);
  if (oldSt) { const np = ptById(oldSt.id); if (np && (np.x !== oldSt.x || np.z !== oldSt.z)) placeHolderAt(np); holder.station = np || null; }
  onJobChanged(); if (H.featRefresh) H.featRefresh(); updUndoUI();
}

// ---------- فتح/إغلاق ----------
function openMap() {
  mapBox.style.display = 'block';
  if (ST.seed !== seenSeed) { seenSeed = ST.seed; undoStack.length = 0; redoStack.length = 0; }
  sizeMap(); drawMap(); renderMapList(); updUndoUI();
}
export function closeMap() { mapBox.style.display = 'none'; }
$('#btnMap').onclick = openMap;
$('#mapClose').onclick = closeMap;
$('#btnMoveInst').onclick = () => { mapTool = 'inst'; $$('[data-mt]').forEach(b => b.classList.toggle('on', b.dataset.mt === mapTool)); openMap(); };
$$('[data-mt]').forEach(b => (b.onclick = () => { mapTool = b.dataset.mt; $$('[data-mt]').forEach(x => x.classList.toggle('on', x === b)); }));
$('#btnJobRnd').onclick = newJob;
$('#btnWorldRnd').onclick = () => newWorld(randSeed());
$('#mapUndo').onclick = doUndo;
$('#mapRedo').onclick = doRedo;
$('#mapZoomIn').onclick = () => { MV.zoomAt(MS / 2, MS / 2, 1.45); drawMap(); MV.requestImage(drawMap); };
$('#mapZoomOut').onclick = () => { MV.zoomAt(MS / 2, MS / 2, 1 / 1.45); drawMap(); MV.requestImage(drawMap); };
$('#mapHome').onclick = () => { MV.home(); drawMap(); toast('🗺 عرض كامل المنطقة'); };
mapC.addEventListener('contextmenu', e => e.preventDefault());
mapC.addEventListener('wheel', e => {
  e.preventDefault();
  const r = mapC.getBoundingClientRect();
  MV.zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.25 : 0.8);
  drawMap(); MV.requestImage(drawMap);
}, { passive: false });
addEventListener('keydown', e => {
  if (!mapOpen()) return;
  const tg = e.target && e.target.tagName;
  if (tg === 'INPUT' || tg === 'SELECT' || tg === 'TEXTAREA') return;
  if (e.key === '+' || e.key === '=') { MV.zoomAt(MS / 2, MS / 2, 1.45); drawMap(); MV.requestImage(drawMap); }
  else if (e.key === '-' || e.key === '_') { MV.zoomAt(MS / 2, MS / 2, 1 / 1.45); drawMap(); MV.requestImage(drawMap); }
  else if (e.key === '0') { MV.home(); drawMap(); }
});

// ---------- سجلّ طبقات الميزات (تُسجَّل من وحدات profile/traverse/contours/polygons) ----------
const drawers = [], taps = {}, refreshers = [], chipTaps = [];
H.drawFeats = c => drawers.forEach(f => { try { f(c); } catch (e) { showErr('drawFeats: ' + e.message); } });
H.addDrawer = f => drawers.push(f);
H.featTap = (tool, x, z) => (taps[tool] ? (taps[tool](x, z), true) : false);
H.addFeatTap = (tool, f) => { taps[tool] = f; };
H.featRefresh = () => refreshers.forEach(f => { try { f(); } catch (e) { showErr('featRefresh: ' + e.message); } });
H.addRefresh = f => refreshers.push(f);
// رقاقات الإدخال على الخريطة (مثل أطوال أضلاع المضلع): قابلة للنقر من أي أداة حتى أثناء التحريك
H.chipTap = (x, z) => { let hit = false; chipTaps.forEach(f => { try { if (f(x, z)) hit = true; } catch (e) { showErr('chipTap: ' + e.message); } }); return hit; };
H.addChipTap = f => chipTaps.push(f);

// ---------- الرسم ----------
export function drawMap() {
  if (!mapOpen()) return;
  MV.ensureImage();
  const c = mctx, k = MV.ppm(), img = ST.mapImg;
  c.clearRect(0, 0, MS, MS);
  c.imageSmoothingEnabled = true;
  if (img) { const [ox, oy] = MV.w2m(-img.half, -img.half), s = 2 * img.half * k; c.drawImage(img.canvas, ox, oy, s, s); }
  // الشبكة التكيفية بتسميات E/N
  const step = MV.gridStep(), vis = MV.visible(), E0 = ST.job.E0 ?? 1000, N0 = ST.job.N0 ?? 1000;
  c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.2)'; c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '10px sans-serif'; c.textAlign = 'left';
  for (let g = Math.ceil(Math.max(vis.x0, -HALF) / step) * step; g <= Math.min(vis.x1, HALF); g += step) {
    const gx = MV.w2m(g, 0)[0];
    c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, MS); c.stroke();
    c.fillText('E' + Math.round(E0 + g), Math.min(gx + 2, MS - 38), MS - 3);
  }
  for (let g = Math.ceil(Math.max(vis.z0, -HALF) / step) * step; g <= Math.min(vis.z1, HALF); g += step) {
    const gy = MV.w2m(0, g)[1];
    c.beginPath(); c.moveTo(0, gy); c.lineTo(MS, gy); c.stroke();
    c.fillText('N' + Math.round(N0 - g), 2, Math.max(gy - 2, 10));
  }
  c.fillStyle = '#fff'; c.font = 'bold 12px sans-serif'; c.fillText('N ↑ كنتور ' + (img ? img.iv : '') + ' م', MS - 92, 14);
  const label = (t, x, y, col) => { c.font = 'bold 12px sans-serif'; c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText(t, x + 8, y - 6); c.fillStyle = col; c.fillText(t, x + 8, y - 6); };
  // معالم: أسهم جريان النهر + الجسر + المباني
  const rp = riverPath();
  c.fillStyle = 'rgba(255,255,255,.92)'; c.strokeStyle = '#1d4f8f'; c.lineWidth = 1;
  for (let i = 6; i < rp.length - 3; i += 9) {
    const a = rp[i], b = rp[i + 3];
    if (Math.abs(a.x) > HALF || Math.abs(a.z) > HALF) continue;
    const [ax, ay] = MV.w2m(a.x, a.z), [bx, by] = MV.w2m(b.x, b.z), an = Math.atan2(by - ay, bx - ax);
    c.save(); c.translate(ax, ay); c.rotate(an); c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -5); c.lineTo(-5, 5); c.closePath(); c.fill(); c.stroke(); c.restore();
  }
  for (const br of bridgeList()) { const [bx, by] = MV.w2m(br.x, br.z); c.save(); c.translate(bx, by); c.rotate(Math.atan2(br.uz, br.ux)); c.fillStyle = 'rgba(120,85,50,.95)'; c.fillRect(-br.hl * k, -br.hw * k, br.hl * 2 * k, br.hw * 2 * k); c.restore(); }
  houseList().forEach(h => {
    if (Math.abs(h.x) > HALF + 10 || Math.abs(h.z) > HALF + 10) return;
    const [hx2, hy2] = MV.w2m(h.x, h.z), s = Math.max(5, h.w * k);
    c.fillStyle = 'rgba(80,60,50,.9)'; c.fillRect(hx2 - s / 2, hy2 - s / 2, s, s); c.strokeStyle = '#fff'; c.lineWidth = 1; c.strokeRect(hx2 - s / 2, hy2 - s / 2, s, s);
  });
  // طبقات الميزات (مضلع/مسار/مقطع/كنتور الطالب) — قبل النقاط كي تبقى النقاط ظاهرة
  if (H.drawFeats) H.drawFeats(c);
  // الجهاز والهدف
  const [ix, iy] = MV.w2m(instPos.x, instPos.z), gp = holder.group.position, [hx, hy] = MV.w2m(gp.x, gp.z);
  c.setLineDash([5, 4]); c.strokeStyle = 'rgba(255,150,40,.9)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(ix, iy); c.lineTo(hx, hy); c.stroke(); c.setLineDash([]);
  ST.job.setups.forEach((s, i) => {
    const [x, y] = MV.w2m(s.x, s.z), cur = i === ST.job.cur, r = cur ? 9 : 6;
    c.fillStyle = cur ? '#4dabf7' : 'rgba(77,171,247,.6)'; c.strokeStyle = '#fff'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath(); c.fill(); c.stroke();
    label(s.id, x, y, '#9fd0ff');
    if (s.locked) { c.font = '12px sans-serif'; c.fillText('📌', x + 4, y + 16); }
  });
  ST.job.points.forEach(p => {
    const [x, y] = MV.w2m(p.x, p.z);
    c.lineWidth = 1.5; c.strokeStyle = '#fff';
    if (p.bm) { c.fillStyle = '#2ea043'; c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x + 8, y + 6); c.lineTo(x - 8, y + 6); c.closePath(); c.fill(); c.stroke(); }
    else { c.fillStyle = '#e8402a'; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); c.stroke(); }
    label(p.id, x, y, p.bm ? '#7ee787' : '#ffb3a6');
    if (p.locked) { c.font = '12px sans-serif'; c.fillText('📌', x + 4, y + 16); }
  });
  c.fillStyle = '#ff9f43'; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(hx, hy, 4, 0, 7); c.fill(); c.stroke();
  // هالة الالتقاط أثناء الضغط — بديل المكبرة: تمييز أقرب نقطة لإصبعك قبل الرفع
  // (عرض فقط: لا تستعمل nearAny كي لا تستهلك دور التدوير قبل النقرة الفعلية)
  if (gest && (gest.kind === 'press' || gest.kind === 'drag')) {
    const t = gest.kind === 'drag' ? gest.t : (gest.warnLocked ? gest.warnLocked : (nearList(gest.x, gest.z, MV.hitR(20))[0] || null));
    if (t) {
      const [x, y] = MV.w2m(t.x, t.z);
      c.strokeStyle = '#ffd34d'; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, 13, 0, 7); c.stroke();
      c.strokeStyle = 'rgba(255,211,77,.5)'; c.lineWidth = 1; c.beginPath(); c.arc(x, y, 20, 0, 7); c.stroke();
    }
    if (gest.kind === 'press') {
      const [x, y] = MV.w2m(gest.x, gest.z);
      c.strokeStyle = '#ffd34d'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x - 9, y); c.lineTo(x + 9, y); c.moveTo(x, y - 9); c.lineTo(x, y + 9); c.stroke();
      c.beginPath(); c.arc(x, y, 4, 0, 7); c.stroke();
    }
  }
  MV.drawScaleBar(c);
}
H.drawMap = drawMap;
export function reach(p) {
  const g0 = groundH(instPos.x, instPos.z), d = Math.hypot(p.x - instPos.x, p.z - instPos.z);
  if (isTT()) return { d, ok: d <= 90 };
  const Rr = g0 + 1.5 + I.TY().trunH + 0.04 - groundH(p.x, p.z);
  return { d, ok: Rr > 0.25 && Rr < 3.75 && d <= 80 };
}
function renderMapList() {
  if (!mapOpen()) return;
  const out = [];
  ST.job.points.forEach(p => {
    const rc2 = reach(p), c = crd(p.x, p.z), wet = wetness(p.x, p.z) > 0.35;
    out.push(`<div class="mrow"><span class="mi ${p.bm ? 'bm' : 'pt'}">${p.bm ? '▲' : '●'}</span><b>${p.id}</b>${p.locked ? '<span>📌</span>' : ''}<span class="mx">${p.bm ? `E ${c.E.toFixed(0)} N ${c.N.toFixed(0)}` : `${p.x}, ${p.z}`}</span>${p.bm ? `<input type="number" step="0.001" data-act="elev" data-id="${p.id}" value="${p.elev ?? ''}" placeholder="RL">` : (p.elev != null ? `<span class="ok">RL ${p.elev}</span>` : '')}${wet ? '<span class="warn">💧 ضفة: أرض طرية</span>' : ''}<span class="${rc2.ok ? 'ok' : 'warn'}">${rc2.d.toFixed(0)} م ${rc2.ok ? '✓ ضمن المدى' : '⚠ خارج المدى'}</span><button data-act="staff" data-id="${p.id}">👷</button><button data-act="pin" data-id="${p.id}">${p.locked ? '🔓' : '📌'}</button><button data-act="del" data-id="${p.id}">🗑</button></div>`);
  });
  ST.job.setups.forEach((s, i) => {
    const c = crd(s.x, s.z), wet = wetness(s.x, s.z) > 0.35;
    out.push(`<div class="mrow"><span class="mi st">◆</span><b>${s.id}</b>${s.locked ? '<span>📌</span>' : ''}<span class="mx">E ${c.E.toFixed(0)} N ${c.N.toFixed(0)}</span>${i === ST.job.cur ? '<span class="ok">الحالي</span>' : ''}${wet ? '<span class="warn">💧 أرض طرية</span>' : ''}<button data-act="goto" data-id="${s.id}">🔭</button><button data-act="pin" data-id="${s.id}">${s.locked ? '🔓' : '📌'}</button><button data-act="delS" data-id="${s.id}">🗑</button></div>`);
  });
  $('#mapList').innerHTML = out.join('');
}
H.renderMapList = renderMapList;
function sendStaff(p) {
  if (sendTo(p)) toast('الهدف يتحرك نحو ' + p.id);
  else if (holder.walking) toast('الهدف يتحرك بالفعل');
  else toast('الهدف عند ' + p.id + ' بالفعل');
  drawMap();
}
function delPoint(p) {
  if (p.locked) return toast('📌 النقطة مثبّتة: ألغِ التثبيت أولاً');
  pushUndo();
  ST.job.points = ST.job.points.filter(q => q !== p);
  if (holder.station && holder.station.id === p.id) holder.station = null;
  onJobChanged(); if (H.featRefresh) H.featRefresh();
}
function delSetup(s) {
  if (s.locked) return toast('📌 الموضع مثبّت: ألغِ التثبيت أولاً');
  if (ST.job.setups[ST.job.cur] === s) return toast('لا يمكن حذف موضع الجهاز الحالي');
  pushUndo();
  const cur = ST.job.setups[ST.job.cur]; ST.job.setups = ST.job.setups.filter(q => q !== s); ST.job.cur = ST.job.setups.indexOf(cur);
  onJobChanged();
}
function gotoSetup(s) { ST.job.cur = ST.job.setups.indexOf(s); placeInstrument(s); onJobChanged(); }
$('#mapList').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const id = b.dataset.id, act = b.dataset.act, p = ptById(id), s = setupById(id);
  if (act === 'staff' && p) sendStaff(p);
  else if (act === 'del' && p) delPoint(p);
  else if (act === 'goto' && s) gotoSetup(s);
  else if (act === 'delS' && s) delSetup(s);
  else if (act === 'pin') { const t = p || s; if (t) { pushUndo(); t.locked = !t.locked; onJobChanged(); } }
});
$('#mapList').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.act !== 'elev') return;
  const p = ptById(t.dataset.id), v = parseFloat(t.value);
  if (p && Number.isFinite(v)) { pushUndo(); p.elev = v; fbRefresh(); ttRefresh(); saveState(); drawMap(); if (H.featRefresh) H.featRefresh(); }
});

// ---------- الإيماءات: نقرة عند الرفع، سحب = تحريك خريطة، إصبعان = قرص + تحريك، عجلة/زر يمنى ----------
const nearOf = (arr, x, z, rad) => { let b = null, bd = rad; arr.forEach(q => { const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; b = q; } }); return b; };
const nearList = (x, z, rad) => [...ST.job.points, ...ST.job.setups]
  .map(q => ({ q, d: Math.hypot(q.x - x, q.z - z) })).filter(o => o.d <= rad).sort((a, b) => a.d - b.d).map(o => o.q);
let lastPick = null;          // آخر نقطة اختيرت — لتمرير الاختيار للنقطة المتقاربة التالية بلمسة ثانية
const nearAny = (x, z, rad) => { const t = cyclePick(nearList(x, z, rad), lastPick); if (t) lastPick = t.id; return t; };
const placeOk = (x, z, isPt) => !isWater(x, z) && (isPt || !inHouse(x, z));
const pxOf = e => { const r = mapC.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
const ptrs = new Map();
let gest = null;
const TAP_PX = 8;
const FEAT_TOOLS = { prof: 1, poly: 1, trav: 1, cont: 1 };   // أدوات لها منطق نقر خاص عبر H.featTap

mapC.addEventListener('pointerdown', e => {
  ptrs.set(e.pointerId, pxOf(e));
  if (ptrs.size === 2) {                      // بدء القرص: ألغِ ما كان جارياً
    if (gest && gest.kind === 'drag') endDrag(true);
    const [p1, p2] = [...ptrs.values()];
    gest = { kind: 'pinch', dLast: Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) || 1, midLast: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2] };
    MV.gestureActive(true);
    return;
  }
  if (ptrs.size > 2) return;
  cap(mapC, e.pointerId);
  const [px, py] = ptrs.get(e.pointerId), [x, z] = MV.m2w(px, py);
  if (e.button === 2 || e.button === 1) { gest = { kind: 'pan', noTap: true }; return; }  // زر الفأرة الأيمن/الأوسط: تحريك دائماً
  if (mapTool === 'move') {
    if (H.chipTap && H.chipTap(x, z)) { gest = null; drawMap(); return; }  // رقاقة الطول؟ أولاً: هدف مرئي للطالب
    const t = nearAny(x, z, MV.hitR(22));
    if (t && t.locked) { gest = { kind: 'press', px, py, px0: px, py0: py, x, z, warnLocked: t }; }
    else if (t) { gest = { kind: 'drag', t, x0: t.x, z0: t.z, snap: undoSnap() }; }
    else gest = { kind: 'pan', px0: px, py0: py, px, py };   // نقرة بلا سحب تُنفَّذ كنقرة عند الرفع (رقاقات الأضلاع)
  } else { gest = { kind: 'press', px, py, px0: px, py0: py, x, z }; }
  drawMap();
});
mapC.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return;
  const prev = ptrs.get(e.pointerId), cur = pxOf(e);
  ptrs.set(e.pointerId, cur);
  if (!gest) return;
  if (gest.kind === 'pinch' && ptrs.size >= 2) {
    const [p1, p2] = [...ptrs.values()];
    const d = Math.hypot(p1[0] - p2[0], p1[1] - p2[1]) || 1, mid = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    const w = MV.m2w(gest.midLast[0], gest.midLast[1]);
    MV.zoomWorld(w[0], w[1], d / gest.dLast, mid[0], mid[1]);
    gest.dLast = d; gest.midLast = mid;
    drawMap(); return;
  }
  if (gest.kind === 'pan') { gest.px = cur[0]; gest.py = cur[1]; MV.panBy(cur[0] - prev[0], cur[1] - prev[1]); drawMap(); return; }
  if (gest.kind === 'drag') {
    const [x, z] = MV.m2w(cur[0], cur[1]);
    const xr = Math.round(clamp(x, -(HALF - 4), HALF - 4)), zr = Math.round(clamp(z, -(HALF - 4), HALF - 4));
    if (placeOk(xr, zr, 'bm' in gest.t)) { gest.t.x = xr; gest.t.z = zr; drawMap(); }
    return;
  }
  if (gest.kind === 'press') {
    gest.px = cur[0]; gest.py = cur[1];
    const mv = Math.hypot(cur[0] - gest.px0, cur[1] - gest.py0);
    if (mv > TAP_PX && !gest.warnLocked) { gest.kind = 'pan'; MV.panBy(cur[0] - prev[0], cur[1] - prev[1]); drawMap(); return; }
    const w = MV.m2w(cur[0], cur[1]); gest.x = w[0]; gest.z = w[1];
    drawMap();
  }
});
function endDrag(cancelled) {
  if (!gest || gest.kind !== 'drag') return;
  const d = gest, t = d.t;
  const moved = t.x !== d.x0 || t.z !== d.z0;
  if (moved && !cancelled) {
    undoPushSnap(d.snap);
    if ('bm' in t) { if (holder.station && holder.station.id === t.id) placeHolderAt(t); toast('نُقلت ' + t.id + ' — أي قراءات سابقة عليها لم تعد صالحة'); }
    else if (ST.job.setups[ST.job.cur] === t) { placeInstrument(t, true); toast('نُقل الجهاز إلى ' + t.id + ' وأُعيد ضبطه'); }
    onJobChanged();
  } else if (moved && cancelled) { t.x = d.x0; t.z = d.z0; onJobChanged(); toast('أُلغي التحريك'); }
}
const finishPtr = (e, cancelled) => {
  ptrs.delete(e.pointerId);
  if (!gest) return;
  if (gest.kind === 'pinch') {
    if (ptrs.size === 1) gest = { kind: 'pan' };
    else if (ptrs.size === 0) { gest = null; MV.gestureActive(false); MV.requestImage(drawMap); }
    return;
  }
  if (gest.kind === 'pan') {
    if (ptrs.size === 0) {
      const tapLike = !gest.noTap && gest.px0 != null && Math.hypot((gest.px ?? gest.px0) - gest.px0, (gest.py ?? gest.py0) - gest.py0) <= TAP_PX;
      const w = MV.m2w(gest.px ?? gest.px0, gest.py ?? gest.py0);
      gest = null; MV.gestureActive(false);
      if (tapLike) tapDispatch(w[0], w[1]);   // رفعت الإصبع بلا سحب: نقرة عادية (تفتح رقاقة الطول مثلاً)
      else MV.requestImage(drawMap);
    }
    return;
  }
  if (gest.kind === 'drag') { endDrag(cancelled); gest = null; drawMap(); return; }
  if (gest.kind === 'press') {
    if (!cancelled) {
      if (gest.warnLocked) toast('📌 ' + gest.warnLocked.id + ' مثبّتة: ألغِ التثبيت أولاً');
      else tapDispatch(gest.x, gest.z);
    }
    gest = null; drawMap();
  }
};
mapC.addEventListener('pointerup', e => finishPtr(e, false));
mapC.addEventListener('pointercancel', e => finishPtr(e, true));

function tapDispatch(x, z) {
  x = Math.round(clamp(x, -(HALF - 4), HALF - 4)); z = Math.round(clamp(z, -(HALF - 4), HALF - 4));
  // رقاقة إدخال على الخريطة (طول ضلع…): تُفتح من الأدوات العادية (✋ تحريك، 📍، 🔍…) — أدوات الميزات
  // (⬛/🧭/📉/⛰) لها منطق نقرها الخاص (إغلاق/رأس/ضلع…) ولا يجوز أن تحجبه الرقاقة.
  if (!FEAT_TOOLS[mapTool] && H.chipTap && H.chipTap(x, z)) return;
  if (mapTool === 'pt' || mapTool === 'bm') {
    if (isWater(x, z)) return toast('💧 لا يمكن وضع نقطة داخل الماء');
    if (nearOf(ST.job.points, x, z, Math.min(12, Math.max(3, 9 / MV.ppm())))) return toast('قريبة جداً من نقطة أخرى — كبّر الخريطة للمواضع المتقاربة');
    pushUndo();
    const bm = mapTool === 'bm', p = { id: nextId(bm ? 'BM' : 'P'), x, z, bm, elev: null };
    if (bm) { const t = trueRL({ x, z }); p.elev = t === null ? 100 : Math.round(t * 1000) / 1000; }
    ST.job.points.push(p); onJobChanged();
  } else if (mapTool === 'inst') {
    if (isWater(x, z)) return toast('💧 لا يمكن وضع الجهاز داخل الماء (ضعه على الضفة أو الجسر)');
    if (inHouse(x, z)) return toast('🏠 لا يمكن وضع الجهاز داخل مبنى');
    const s0 = nearOf(ST.job.setups, x, z, Math.min(30, Math.max(5, 14 / MV.ppm())));
    if (s0) gotoSetup(s0);
    else { pushUndo(); const s = { id: nextSetup(), x, z }; ST.job.setups.push(s); gotoSetup(s); }
  } else if (mapTool === 'staff') {
    const p = nearOf(ST.job.points, x, z, Math.min(45, Math.max(6, 24 / MV.ppm()))); if (p) sendStaff(p); else toast('المس قرب نقطة لإرسال الهدف إليها');
  } else if (mapTool === 'del') {
    const t = nearAny(x, z, Math.min(40, Math.max(4, 14 / MV.ppm())));
    if (!t) toast('لا توجد نقطة هنا — كبّر إن كانت متقاربة'); else if ('bm' in t) delPoint(t); else delSetup(t);
  } else if (mapTool === 'pin') {
    const t = nearAny(x, z, Math.min(45, Math.max(4, 16 / MV.ppm())));
    if (!t) return toast('المس قرب نقطة أو موضع جهاز');
    pushUndo(); t.locked = !t.locked; toast(t.locked ? '📌 ثُبّتت ' + t.id : 'أُلغي تثبيت ' + t.id); onJobChanged();
  } else if (mapTool === 'qry') {
    doQuery(x, z);
  } else if (mapTool === 'prof' || mapTool === 'poly' || mapTool === 'trav' || mapTool === 'cont') {
    if (!H.featTap(mapTool, x, z)) toast('هذه الأداة غير مهيّأة');
  }
}

// ---------- أداة الاستعلام: عرض بيانات نقطة مسجلة + تسجيل منسوبها بخانة فارغة (لا تضيف نقاطاً) ----------
let qryT = null;
function doQuery(x, z) {
  const rad = Math.min(50, Math.max(5, 18 / MV.ppm()));
  const t = nearAny(x, z, rad);
  if (t) showQry(t);
  else toast('🔍 لا نقطة هنا — الاستعلام يعرض بيانات النقاط المسجلة (لإضافة جديدة استخدم 📍)');
}
function showQry(t) {
  qryT = t;
  const isPt = 'bm' in t, c = crd(t.x, t.z), rc2 = isPt ? reach(t) : null;
  $('#qryTitle').textContent = 'بيانات: ' + t.id + (isPt ? (t.bm ? ' (نقطة معلومة BM)' : ' (نقطة مسح)') : ' (محطة جهاز)');
  let html = `<div class="row"><span class="mx">E ${c.E.toFixed(2)} · N ${c.N.toFixed(2)}</span></div>`;
  if (isPt) html += `<div class="row"><span>المنسوب المسوّح:</span><b class="${t.elev != null ? 'ok' : 'warn'}">${t.elev != null ? t.elev.toFixed(3) + ' م' : 'غير مسوّى بعد'}</b></div>`;
  if (rc2) html += `<div class="row"><span class="${rc2.ok ? 'ok' : 'warn'}">بُعد الجهاز ${rc2.d.toFixed(0)} م ${rc2.ok ? '✓ ضمن المدى' : '⚠ خارج المدى'}</span></div>`;
  if (t.locked) html += '<div class="row"><span class="warn">📌 مثبّتة (ألغِ التثبيت للتحريك/الحذف)</span></div>';
  $('#qryBody').innerHTML = html;
  const box = $('#qryRL').closest('.qrl');
  if (box) box.style.display = isPt ? '' : 'none';
  $('#qryRL').value = isPt && t.elev != null ? String(t.elev) : '';
  $('#qryCard').style.display = 'block';
}
$('#qryClose').onclick = () => { $('#qryCard').style.display = 'none'; };
$('#qrySave').onclick = () => {
  if (!qryT || !('bm' in qryT)) return;
  const v = parseFloat($('#qryRL').value);
  if (!Number.isFinite(v)) return toast('أدخل منسوباً رقمياً صحيحاً');
  pushUndo(); qryT.elev = Math.round(v * 1000) / 1000;
  onJobChanged(); if (H.featRefresh) H.featRefresh();
  toast('✓ حُفظ منسوب ' + qryT.id + ' = ' + qryT.elev + ' م');
  showQry(qryT);
};

function renderPtBtns() {
  const box = $('#ptBtns'); box.innerHTML = '';
  ST.job.points.forEach(p => { const b = document.createElement('button'); b.textContent = p.id; b.dataset.id = p.id; b.onclick = () => sendStaff(p); box.appendChild(b); });
  const sel = $('#bsSel'), old = sel.value;
  sel.innerHTML = ST.job.points.filter(p => p.bm).map(p => `<option value="${p.id}">BS: ${p.id}</option>`).join('');
  if (old) sel.value = old;
}
H.renderPtBtns = renderPtBtns;
