// الخريطة — استُخرج من main.js (B-003)
import { $, $$, toast, cap, clamp } from './util.js';
import { sideLayout, mapBox, mapOpen, isTT } from './ctx.js';
import { newJob, newWorld, randSeed, onJobChanged, placeInstrument } from './transfer.js';
import { ST } from './state.js';
import { mapImage, riverPath, bridgeList, houseList, instPos, holder, groundH, wetness, sendTo, isWater, inHouse, placeHolderAt } from './world.js';
import { H } from './hooks.js';
import * as I from './instrument.js';
import { crd, ptById, setupById, saveState, nextId, trueRL, nextSetup } from './job.js';
import { fbRefresh } from './books-level.js';
import { ttRefresh } from './books-tt.js';

export const HALF = 500, MZ = 500 / 120, mapC = $('#mapC'), mctx = mapC.getContext('2d');
let mapTool = 'pt', MS = 480;
const w2m = (x, z) => [(x + HALF) / (2 * HALF) * MS, (z + HALF) / (2 * HALF) * MS];
export function sizeMap() {
  const d = Math.min(devicePixelRatio || 1, 2);
  MS = Math.floor(sideLayout() ? Math.min(innerWidth * 0.55, innerHeight * 0.78, 680) : Math.min(innerWidth * 0.94, innerHeight * 0.55, 560));
  mapC.style.width = MS + 'px'; mapC.style.height = MS + 'px'; mapC.width = MS * d; mapC.height = MS * d; mctx.setTransform(d, 0, 0, d, 0, 0);
}
function openMap() { mapBox.style.display = 'block'; sizeMap(); drawMap(); renderMapList(); }
export function closeMap() { mapBox.style.display = 'none'; }
$('#btnMap').onclick = openMap;
$('#mapClose').onclick = closeMap;
$('#btnMoveInst').onclick = () => { mapTool = 'inst'; $$('[data-mt]').forEach(b => b.classList.toggle('on', b.dataset.mt === mapTool)); openMap(); };
$$('[data-mt]').forEach(b => (b.onclick = () => { mapTool = b.dataset.mt; $$('[data-mt]').forEach(x => x.classList.toggle('on', x === b)); }));
$('#btnJobRnd').onclick = newJob;
$('#btnWorldRnd').onclick = () => newWorld(randSeed());
// NIVO-V8
export function drawMap() {
  if (!mapOpen()) return;
  if (!ST.mapImg) ST.mapImg = mapImage(HALF, 320);
  const c = mctx, k = MS / (2 * HALF);
  c.clearRect(0, 0, MS, MS); c.imageSmoothingEnabled = true; c.drawImage(ST.mapImg.canvas, 0, 0, MS, MS);
  c.lineWidth = 1; c.strokeStyle = 'rgba(255,255,255,.2)'; c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '10px sans-serif'; c.textAlign = 'left';
  for (let g = -Math.floor(HALF / 100) * 100; g <= HALF; g += 100) {
    const gx = w2m(g, 0)[0], gy = w2m(0, g)[1];
    c.beginPath(); c.moveTo(gx, 0); c.lineTo(gx, MS); c.moveTo(0, gy); c.lineTo(MS, gy); c.stroke();
    c.fillText(String(g), gx + 2, MS - 3); c.fillText(String(g), 2, gy - 2);
  }
  c.fillStyle = '#fff'; c.font = 'bold 12px sans-serif'; c.fillText('N ↑  كنتور ' + ST.mapImg.iv + ' م', MS - 92, 14);
  const label = (t, x, y, col) => { c.font = 'bold 12px sans-serif'; c.lineWidth = 3; c.strokeStyle = '#000'; c.strokeText(t, x + 8, y - 6); c.fillStyle = col; c.fillText(t, x + 8, y - 6); };
  // معالم: أسهم جريان النهر + الجسر + المباني
  const rp = riverPath();
  c.fillStyle = 'rgba(255,255,255,.92)'; c.strokeStyle = '#1d4f8f'; c.lineWidth = 1;
  for (let i = 6; i < rp.length - 3; i += 9) {
    const a = rp[i], b = rp[i + 3];
    if (Math.abs(a.x) > HALF || Math.abs(a.z) > HALF) continue;
    const [ax, ay] = w2m(a.x, a.z), [bx, by] = w2m(b.x, b.z), an = Math.atan2(by - ay, bx - ax);
    c.save(); c.translate(ax, ay); c.rotate(an); c.beginPath(); c.moveTo(7, 0); c.lineTo(-5, -5); c.lineTo(-5, 5); c.closePath(); c.fill(); c.stroke(); c.restore();
  }
  /* الجسور */
  for (const br of bridgeList()) { const [bx, by] = w2m(br.x, br.z); c.save(); c.translate(bx, by); c.rotate(Math.atan2(br.uz, br.ux)); c.fillStyle = 'rgba(120,85,50,.95)'; c.fillRect(-br.hl * k, -br.hw * k, br.hl * 2 * k, br.hw * 2 * k); c.restore(); }
  houseList().forEach(h => {
    if (Math.abs(h.x) > HALF + 10 || Math.abs(h.z) > HALF + 10) return;
    const [hx2, hy2] = w2m(h.x, h.z), s = Math.max(5, h.w * k);
    c.fillStyle = 'rgba(80,60,50,.9)'; c.fillRect(hx2 - s / 2, hy2 - s / 2, s, s); c.strokeStyle = '#fff'; c.lineWidth = 1; c.strokeRect(hx2 - s / 2, hy2 - s / 2, s, s);
  });
  const [ix, iy] = w2m(instPos.x, instPos.z), gp = holder.group.position, [hx, hy] = w2m(gp.x, gp.z);
  c.setLineDash([5, 4]); c.strokeStyle = 'rgba(255,150,40,.9)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(ix, iy); c.lineTo(hx, hy); c.stroke(); c.setLineDash([]);
  ST.job.setups.forEach((s, i) => {
    const [x, y] = w2m(s.x, s.z), cur = i === ST.job.cur, r = cur ? 9 : 6;
    c.fillStyle = cur ? '#4dabf7' : 'rgba(77,171,247,.6)'; c.strokeStyle = '#fff'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(x, y - r); c.lineTo(x + r, y); c.lineTo(x, y + r); c.lineTo(x - r, y); c.closePath(); c.fill(); c.stroke();
    label(s.id, x, y, '#9fd0ff');
    if (s.locked) { c.font = '12px sans-serif'; c.fillText('📌', x + 4, y + 16); }
  });
  ST.job.points.forEach(p => {
    const [x, y] = w2m(p.x, p.z);
    c.lineWidth = 1.5; c.strokeStyle = '#fff';
    if (p.bm) { c.fillStyle = '#2ea043'; c.beginPath(); c.moveTo(x, y - 8); c.lineTo(x + 8, y + 6); c.lineTo(x - 8, y + 6); c.closePath(); c.fill(); c.stroke(); }
    else { c.fillStyle = '#e8402a'; c.beginPath(); c.arc(x, y, 6, 0, 7); c.fill(); c.stroke(); }
    label(p.id, x, y, p.bm ? '#7ee787' : '#ffb3a6');
    if (p.locked) { c.font = '12px sans-serif'; c.fillText('📌', x + 4, y + 16); }
  });
  c.fillStyle = '#ff9f43'; c.strokeStyle = '#fff'; c.lineWidth = 1.5; c.beginPath(); c.arc(hx, hy, 4, 0, 7); c.fill(); c.stroke();
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
    out.push(`<div class="mrow"><span class="mi ${p.bm ? 'bm' : 'pt'}">${p.bm ? '▲' : '●'}</span><b>${p.id}</b>${p.locked ? '<span>📌</span>' : ''}<span class="mx">${p.bm ? `E ${c.E.toFixed(0)} N ${c.N.toFixed(0)}` : `${p.x}, ${p.z}`}</span>${p.bm ? `<input type="number" step="0.001" data-act="elev" data-id="${p.id}" value="${p.elev ?? ''}" placeholder="RL">` : ''}${wet ? '<span class="warn">💧 ضفة: أرض طرية</span>' : ''}<span class="${rc2.ok ? 'ok' : 'warn'}">${rc2.d.toFixed(0)} م ${rc2.ok ? '✓ ضمن المدى' : '⚠ خارج المدى'}</span><button data-act="staff" data-id="${p.id}">👷</button><button data-act="pin" data-id="${p.id}">${p.locked ? '🔓' : '📌'}</button><button data-act="del" data-id="${p.id}">🗑</button></div>`);
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
  ST.job.points = ST.job.points.filter(q => q !== p);
  if (holder.station && holder.station.id === p.id) holder.station = null;
  onJobChanged();
}
function delSetup(s) {
  if (s.locked) return toast('📌 الموضع مثبّت: ألغِ التثبيت أولاً');
  if (ST.job.setups[ST.job.cur] === s) return toast('لا يمكن حذف موضع الجهاز الحالي');
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
  else if (act === 'pin') { const t = p || s; if (t) { t.locked = !t.locked; onJobChanged(); } }
});
$('#mapList').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.act !== 'elev') return;
  const p = ptById(t.dataset.id), v = parseFloat(t.value);
  if (p && Number.isFinite(v)) { p.elev = v; fbRefresh(); ttRefresh(); saveState(); drawMap(); }
});
const m2w = e => { const r = mapC.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 2 * HALF - HALF, (e.clientY - r.top) / r.height * 2 * HALF - HALF]; };
const nearOf = (arr, x, z, rad) => { let b = null, bd = rad; arr.forEach(q => { const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; b = q; } }); return b; };
const nearAny = (x, z, rad) => {
  const a = nearOf(ST.job.points, x, z, rad), b = nearOf(ST.job.setups, x, z, rad);
  if (!a) return b; if (!b) return a;
  return Math.hypot(a.x - x, a.z - z) <= Math.hypot(b.x - x, b.z - z) ? a : b;
};
const placeOk = (x, z, isPt) => !isWater(x, z) && (isPt || !inHouse(x, z));
let mdrag = null;
mapC.addEventListener('pointerdown', e => {
  const [x, z] = m2w(e);
  if (mapTool === 'move') {
    const t = nearAny(x, z, 9 * MZ);
    if (!t) return toast('المس قرب نقطة أو موضع جهاز لتحريكه');
    if (t.locked) return toast('📌 ' + t.id + ' مثبّتة: ألغِ التثبيت أولاً');
    mdrag = { t, x0: t.x, z0: t.z }; cap(mapC, e.pointerId); return;
  }
  mapTap(x, z);
});
mapC.addEventListener('pointermove', e => {
  if (!mdrag) return;
  let [x, z] = m2w(e); x = Math.round(clamp(x, -(HALF - 4), HALF - 4)); z = Math.round(clamp(z, -(HALF - 4), HALF - 4));
  if (!placeOk(x, z, 'bm' in mdrag.t)) return;
  mdrag.t.x = x; mdrag.t.z = z; drawMap();
});
const endDrag = () => {
  if (!mdrag) return;
  const d = mdrag, t = d.t; mdrag = null;
  if (t.x === d.x0 && t.z === d.z0) return;
  if ('bm' in t) { if (holder.station && holder.station.id === t.id) placeHolderAt(t); toast('نُقلت ' + t.id + ' — أي قراءات سابقة عليها لم تعد صالحة'); }
  else if (ST.job.setups[ST.job.cur] === t) { placeInstrument(t, true); toast('نُقل الجهاز إلى ' + t.id + ' وأُعيد ضبطه'); }
  onJobChanged();
};
mapC.addEventListener('pointerup', endDrag);
mapC.addEventListener('pointercancel', endDrag);
function mapTap(x, z) {
  x = Math.round(clamp(x, -(HALF - 4), HALF - 4)); z = Math.round(clamp(z, -(HALF - 4), HALF - 4));
  if (mapTool === 'pt' || mapTool === 'bm') {
    if (isWater(x, z)) return toast('💧 لا يمكن وضع نقطة داخل الماء');
    if (nearOf(ST.job.points, x, z, 4)) return toast('قريبة جداً من نقطة أخرى');
    const bm = mapTool === 'bm', p = { id: nextId(bm ? 'BM' : 'P'), x, z, bm, elev: null };
    if (bm) { const t = trueRL({ x, z }); p.elev = t === null ? 100 : Math.round(t * 1000) / 1000; }
    ST.job.points.push(p); onJobChanged();
  } else if (mapTool === 'inst') {
    if (isWater(x, z)) return toast('💧 لا يمكن وضع الجهاز داخل الماء (ضعه على الضفة أو الجسر)');
    if (inHouse(x, z)) return toast('🏠 لا يمكن وضع الجهاز داخل مبنى');
    const s0 = nearOf(ST.job.setups, x, z, 6 * MZ);
    if (s0) gotoSetup(s0);
    else { const s = { id: nextSetup(), x, z }; ST.job.setups.push(s); gotoSetup(s); }
  } else if (mapTool === 'staff') {
    const p = nearOf(ST.job.points, x, z, 10 * MZ); if (p) sendStaff(p); else toast('المس قرب نقطة لإرسال الهدف إليها');
  } else if (mapTool === 'del') {
    const t = nearAny(x, z, 6 * MZ);
    if (!t) toast('لا توجد نقطة هنا'); else if ('bm' in t) delPoint(t); else delSetup(t);
  } else if (mapTool === 'pin') {
    const t = nearAny(x, z, 8 * MZ);
    if (!t) return toast('المس قرب نقطة أو موضع جهاز');
    t.locked = !t.locked; toast(t.locked ? '📌 ثُبّتت ' + t.id : 'أُلغي تثبيت ' + t.id); onJobChanged();
  }
}
function renderPtBtns() {
  const box = $('#ptBtns'); box.innerHTML = '';
  ST.job.points.forEach(p => { const b = document.createElement('button'); b.textContent = p.id; b.dataset.id = p.id; b.onclick = () => sendStaff(p); box.appendChild(b); });
  const sel = $('#bsSel'), old = sel.value;
  sel.innerHTML = ST.job.points.filter(p => p.bm).map(p => `<option value="${p.id}">BS: ${p.id}</option>`).join('');
  if (old) sel.value = old;
}
H.renderPtBtns = renderPtBtns;
