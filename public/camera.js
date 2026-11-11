// الكاميرا الخارجية — استُخرج من main.js (B-003)
import { V3, clamp, $$, cap } from './util.js';
import { holder } from './world.js';
import * as I from './instrument.js';
import { ST } from './state.js';
import { cam, cv } from './ctx.js';
import { H } from './hooks.js';

export const orb = { az: 0.7, el: 0.28, dist: 5.2, tDist: 5.2, t: new V3(0, 1, 0), tt: new V3(0, 1, 0), mode: 'tripod', part: null };
const DIST = () => {
  const g = holder.group.position, rp = I.rigPos;
  return { all: clamp(1.4 * Math.hypot(rp.x - g.x, rp.z - g.z), 25, 160), tripod: 5.2, inst: I.st.exTarget ? 2.8 : 1.3, staff: 8 };
};
export function setMode(m, d) {
  orb.mode = m; if (d) orb.tDist = d;
  $$('[data-cam]').forEach(b => b.classList.toggle('on', b.dataset.cam === m));
  if (ST.scopeFull) H.toggleFull(false);
}
$$('[data-cam]').forEach(b => (b.onclick = () => setMode(b.dataset.cam, DIST()[b.dataset.cam])));
function camTargets() {
  const rp = I.rigPos, g = holder.group.position;
  if (orb.mode === 'all') orb.tt.set((rp.x + g.x) / 2, 1.5 + (rp.y + g.y) / 2, (rp.z + g.z) / 2);
  else if (orb.mode === 'tripod') orb.tt.set(rp.x, rp.y + I.st.Hc * 0.5 + 0.1, rp.z);
  else if (orb.mode === 'inst') orb.tt.set(rp.x, rp.y + I.st.Hc + 0.1 + I.st.explode * 0.45, rp.z);
  else if (orb.mode === 'staff') orb.tt.set(g.x, g.y + 1.8, g.z);
  else if (orb.mode === 'part' && orb.part) orb.part.anchor.getWorldPosition(orb.tt);
}
export function snapCam() { camTargets(); orb.t.copy(orb.tt); orb.dist = orb.tDist; }
export function updCam(dt) {
  camTargets();
  const k = 1 - Math.pow(0.003, dt);
  orb.t.lerp(orb.tt, k); orb.dist += (orb.tDist - orb.dist) * k;
  const d = orb.dist, ce = Math.cos(orb.el);
  cam.position.set(orb.t.x + d * ce * Math.sin(orb.az), orb.t.y + d * Math.sin(orb.el), orb.t.z + d * ce * Math.cos(orb.az));
  cam.lookAt(orb.t);
}
const ptrs = new Map();
let pinch0 = 0;
cv.addEventListener('pointerdown', e => {
  cap(cv, e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); }
});
cv.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1) { orb.az -= dx * 0.006; orb.el = clamp(orb.el + dy * 0.006, 0.02, 1.5); }
  else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinch0 && d > 1) orb.tDist = clamp(orb.tDist * pinch0 / d, 0.4, 200);
    pinch0 = d;
  }
});
const pUp = e => { ptrs.delete(e.pointerId); pinch0 = 0; };
cv.addEventListener('pointerup', pUp);
cv.addEventListener('pointercancel', pUp);
cv.addEventListener('wheel', e => { orb.tDist = clamp(orb.tDist * (1 + Math.sign(e.deltaY) * 0.1), 0.4, 200); e.preventDefault(); }, { passive: false });
