// التوجيه (دوران أفقي لا نهائي + رأسي) — استُخرج من main.js (B-003)
import * as I from './instrument.js';
import { TAU, $, toast, cap, DEG, $$, openTab } from './util.js';
import { holder, instPos } from './world.js';
import { updClampUI } from './mount.js';
import { isTT, scopeCam, mapOpen, scopeEl, FOV } from './ctx.js';
import { getPrismHeight } from './targets.js';
import { reach, closeMap } from './map.js';
import { ST } from './state.js';
import { H } from './hooks.js';

export function setHeading(r) { if (Number.isFinite(r)) I.st.heading = ((r % TAU) + TAU) % TAU; }
export function setVz(r) { if (Number.isFinite(r)) I.st.vz = ((r % TAU) + TAU) % TAU; }
export const bearingToStaff = () => { const p = holder.group.position; return Math.atan2(p.x - instPos.x, -(p.z - instPos.z)); };
$('#btnClamp').onclick = () => { if (!I.st.mounted) return toast('ركّب الجهاز أولاً'); I.st.clamp = !I.st.clamp; updClampUI(); };
$('#btnClampV').onclick = () => { if (!I.st.mounted) return toast('ركّب الجهاز أولاً'); I.st.clampV = !I.st.clampV; updClampUI(); };
const jog = $('#jog');
let jd = null;
jog.addEventListener('pointerdown', e => { if (!I.st.mounted) return toast('ركّب الجهاز أولاً'); jd = { x: e.clientX }; cap(jog, e.pointerId); });
jog.addEventListener('pointermove', e => {
  if (!jd) return;
  const dx = e.clientX - jd.x; jd.x = e.clientX;
  if (I.st.clamp) { if (Math.abs(dx) > 4) toast('حرّر المثبّت أولاً (أو استعمل الحركة البطيئة)'); return; }
  setHeading(I.st.heading - dx * 0.5 * DEG);
});
const jEnd = () => (jd = null);
jog.addEventListener('pointerup', jEnd);
jog.addEventListener('pointercancel', jEnd);
$$('[data-rot]').forEach(b => (b.onclick = () => {
  if (!I.st.mounted) return toast('ركّب الجهاز أولاً');
  if (I.st.clamp) return toast('حرّر المثبّت أولاً');
  setHeading(I.st.heading + (+b.dataset.rot) * DEG);
}));
$$('[data-vr]').forEach(b => (b.onclick = () => {
  if (!I.st.mounted) return toast('ركّب الجهاز أولاً');
  if (I.st.clampV) return toast('حرّر المثبّت الرأسي أولاً');
  setVz(I.st.vz - (+b.dataset.vr) * DEG);
}));
$('#btnAim').onclick = () => {
  if (!I.st.mounted) return toast('ركّب الجهاز أولاً');
  if (I.st.clamp || (isTT() && I.st.clampV)) return toast('حرّر المثبّت' + (isTT() ? 'ين' : '') + ' أولاً');
  if (holder.walking) return toast('انتظر حتى يصل الهدف');
  if (isTT()) {
    const g = holder.group.position, dx = g.x - instPos.x, dz = g.z - instPos.z, hd = Math.hypot(dx, dz);
    const ty = g.y + (I.type === 'ts' ? getPrismHeight() : 1.5) - scopeCam.position.y;
    const phi = Math.PI / 2 - Math.atan2(ty, hd) + (Math.random() - 0.5) * 0.009, th = Math.atan2(dx, -dz) + (Math.random() - 0.5) * 0.009;
    if (I.st.vz > Math.PI) { setHeading(th + Math.PI); setVz(TAU - phi); } else { setHeading(th); setVz(phi); }
  } else setHeading(bearingToStaff() + (Math.random() - 0.5) * 0.012);
  const rc2 = holder.station ? reach(holder.station) : null;
  toast(rc2 && !rc2.ok ? 'تنبيه: هذه النقطة خارج المدى من هذا الموضع — انقل الجهاز' : 'تم التوجيه التقريبي. اربط المثبّت ثم أتقن بالحركة البطيئة');
};
[['slL', -1], ['slR', 1]].forEach(([id, dir]) => {
  const b = $('#' + id); b.oncontextmenu = e => e.preventDefault();
  b.addEventListener('pointerdown', e => {
    if (!I.st.mounted) return toast('ركّب الجهاز أولاً');
    if (!I.st.clamp) return toast('اربط المثبّت أولاً لتفعيل الحركة البطيئة');
    cap(b, e.pointerId);
    setHeading(I.st.heading + dir * 0.01 * DEG); ST.slow = dir; ST.slowT = 0;
  });
  const stop = () => { ST.slow = 0; };
  b.addEventListener('pointerup', stop); b.addEventListener('pointercancel', stop); b.addEventListener('lostpointercapture', stop);
});
[['slU', -1], ['slD', 1]].forEach(([id, dir]) => {
  const b = $('#' + id); b.oncontextmenu = e => e.preventDefault();
  b.addEventListener('pointerdown', e => {
    if (!I.st.mounted) return toast('ركّب الجهاز أولاً');
    if (!I.st.clampV) return toast('اربط المثبّت الرأسي أولاً');
    cap(b, e.pointerId);
    setVz(I.st.vz + dir * 0.01 * DEG); ST.slowV = dir; ST.slowVT = 0;
  });
  const stop = () => { ST.slowV = 0; };
  b.addEventListener('pointerup', stop); b.addEventListener('pointercancel', stop); b.addEventListener('lostpointercapture', stop);
});
let keyDir = 0;
addEventListener('keydown', e => {
  if (e.key === 'Escape') { if (mapOpen()) closeMap(); else if (ST.scopeFull) toggleFull(false); return; }
  if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  if (e.repeat || !I.st.mounted) return;
  if (!I.st.clamp) return toast('اربط المثبّت لاستعمال الحركة البطيئة');
  keyDir = e.key === 'ArrowRight' ? 1 : -1; ST.slow = keyDir; ST.slowT = 0; setHeading(I.st.heading + keyDir * 0.01 * DEG);
});
addEventListener('keyup', e => { if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && keyDir) { keyDir = 0; ST.slow = 0; } });
$('#foc').oninput = e => (ST.focV = +e.target.value);
$('#eye').oninput = e => (ST.eyeV = +e.target.value);
function toggleFull(on) {
  ST.scopeFull = on; scopeEl.classList.toggle('full', on);
  $('#btnExit').style.display = on ? 'block' : 'none';
  if (on) openTab('t2');
}
H.toggleFull = toggleFull;
$('#btnFull').onclick = () => { if (!I.st.mounted) return toast('ركّب الجهاز أولاً'); toggleFull(true); };
$('#btnExit').onclick = () => toggleFull(false);
let sd = null;
scopeEl.addEventListener('pointerdown', e => { if (!ST.scopeFull) { toggleFull(true); return; } sd = { x: e.clientX, y: e.clientY }; cap(scopeEl, e.pointerId); });
scopeEl.addEventListener('pointermove', e => {
  if (!sd) return;
  const dx = e.clientX - sd.x, dy = e.clientY - sd.y, w = scopeEl.getBoundingClientRect().width || 300; sd.x = e.clientX; sd.y = e.clientY;
  if (I.st.clamp) { if (Math.abs(dx) > 6) toast('المثبّت مربوط: استعمل الحركة البطيئة'); }
  else setHeading(I.st.heading - dx / w * FOV * DEG);
  if (isTT()) { if (I.st.clampV) { if (Math.abs(dy) > 6) toast('المثبّت الرأسي مربوط'); } else setVz(I.st.vz - dy / w * FOV * DEG); }
});
const sdEnd = () => (sd = null);
scopeEl.addEventListener('pointerup', sdEnd);
scopeEl.addEventListener('pointercancel', sdEnd);
