// النظر في الهدف — استُخرج من main.js (B-003)
import * as THREE from 'three';
import { V3, clamp } from './util.js';
import * as I from './instrument.js';
import { holder } from './world.js';
import { scopeCam } from './ctx.js';
import { prismFace, getPrismHeight } from './targets.js';

export const rc = new THREE.Raycaster(), _o = new V3(), _d = new V3(), _r = new V3(), _p = new V3(), _t = new V3();
export function sightInfo() {
  const s = { hit: false, dist: 70, ang: 9 };
  if (!I.st.mounted || holder.walking) return s;
  scopeCam.updateMatrixWorld(true);
  scopeCam.getWorldPosition(_o); scopeCam.getWorldDirection(_d);
  const g = holder.group, gy = g.position.y, ts = I.type === 'ts', face = ts ? prismFace : holder.face;
  g.updateMatrixWorld(true);
  s.dist = Math.hypot(g.position.x - _o.x, g.position.z - _o.z);
  _t.set(g.position.x - _o.x, gy + (ts ? getPrismHeight() : 1.5) - _o.y, g.position.z - _o.z).normalize();
  s.ang = Math.acos(clamp(_t.dot(_d), -1, 1));
  rc.set(_o, _d); rc.far = 400;
  const h = rc.intersectObject(face, false)[0];
  if (!h) return s;
  const lp = g.worldToLocal(_p.copy(h.point));
  s.hit = true; const rdg = pt => face.worldToLocal(_t.copy(pt)).y + 2; s.reading = ts ? h.point.y - gy : rdg(h.point); s.lat = lp.x; s.sd = h.distance; s.alpha = Math.asin(clamp(_d.y, -1, 1));
  s.edm = ts && Math.abs(lp.x) < 0.07 && Math.abs(lp.y - getPrismHeight()) < 0.07;
  if (!ts) {
    _r.set(1, 0, 0).applyQuaternion(scopeCam.quaternion);
    const sp = I.type === 'tach' ? 1 - _d.y * _d.y : 1, a = Math.atan(0.005 * sp);
    rc.set(_o, _d.clone().applyAxisAngle(_r, a)); const hu = rc.intersectObject(face, false)[0];
    rc.set(_o, _d.clone().applyAxisAngle(_r, -a)); const hl = rc.intersectObject(face, false)[0];
    if (hu && hl) { s.U = rdg(hu.point); s.L = rdg(hl.point); s.D = 100 * (s.U - s.L); }
    if (I.type === 'tach') { rc.set(_o, _d.clone().applyAxisAngle(_r, -0.001749)); const hs_ = rc.intersectObject(face, false)[0]; if (hs_) s.sr = rdg(hs_.point); }
  }
  return s;
}
