// المهمة (Job) والحالة — استُخرج من main.js (B-003)
import { ST } from './state.js';
import { groundH, mulberry32, isWater, houseList, inHouse, riverInfo, dryNear } from './world.js';

export const ptById = id => ST.job.points.find(p => p.id === id);
export const setupById = id => ST.job.setups.find(s => s.id === id);
export const trueRL = p => { const bm = ST.job.points.find(q => q.bm && q.elev != null); return bm ? bm.elev + groundH(p.x, p.z) - groundH(bm.x, bm.z) : null; };
export const zOf = p => { const t = trueRL(p); return t === null ? 0 : t; };
export const crd = (x, z) => ({ E: (ST.job.E0 ?? 1000) + x, N: (ST.job.N0 ?? 1000) - z });
export const nextId = pre => { let n = 1; while (ST.job.points.some(p => p.id === pre + n)) n++; return pre + n; };
export const nextSetup = () => { let n = 1; while (ST.job.setups.some(s => s.id === 'S' + n)) n++; return 'S' + n; };
export const saveState = () => { try { localStorage.setItem('nivoState', JSON.stringify({ seed: ST.seed, job: ST.job, rows: ST.rows, rowsT: ST.rowsT })); } catch (e) { /* تجاهل */ } };
export const loadSaved = sd => { try { const j = JSON.parse(localStorage.getItem('nivoState') || 'null'); return j && j.seed === sd && j.job && j.job.points ? j : null; } catch (e) { return null; } };
export function randomJob(sd) {
  const r = mulberry32(sd * 131 + 5), E0 = 1000 + Math.round(r() * 8000), N0 = 1000 + Math.round(r() * 8000);
  const wet = (a, b) => { for (let t = 0; t <= 1; t += 0.04) if (isWater(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return true; return false; };
  const hs = houseList(), minD = r() < 0.7 ? 30 : 6;   // غالباً بعيد عن النهر، وأحياناً قريب منه
  const okS = (x, z) => {
    if (isWater(x, z) || inHouse(x, z)) return false;
    const ri = riverInfo(x, z);
    return ri.d > ri.hw + minD && hs.every(h => Math.hypot(x - h.x, z - h.z) > h.w + 10);
  };
  let s0 = null;
  for (let k = 0; k < 500 && !s0; k++) {
    const a = r() * 6.283, d = Math.sqrt(r()) * 70, x = Math.round(Math.cos(a) * d), z = Math.round(Math.sin(a) * d);
    if (okS(x, z)) s0 = { x, z };
  }
  if (!s0) s0 = dryNear(0, 0);
  for (let tries = 0; tries < 80; tries++) {
    const pts = [], placed = [{ x: s0.x, z: s0.z }];
    const ok = (x, z) => Math.hypot(x - s0.x, z - s0.z) > 12 && Math.abs(x) < 135 && Math.abs(z) < 135 && !isWater(x, z) && !inHouse(x, z) && placed.every(q => Math.hypot(q.x - x, q.z - z) >= 18) && !wet(s0, { x, z });
    const mk = (id, bm, dmin, dmax) => {
      for (let k = 0; k < 40; k++) {
        const a = r() * 6.283, d = dmin + r() * (dmax - dmin), x = Math.round(s0.x + Math.cos(a) * d), z = Math.round(s0.z + Math.sin(a) * d);
        if (ok(x, z)) { placed.push({ x, z }); const p = { id, x, z, bm, elev: null }; pts.push(p); return p; }
      }
      return null;
    };
    const bm = mk('BM1', true, 25, 45); if (!bm) continue;
    const n = 3 + Math.floor(r() * 3); let good = true;
    for (let i = 1; i <= n; i++) if (!mk('P' + i, false, 20, 85)) good = false;
    if (!good) continue;
    const hi = groundH(s0.x, s0.z) + 1.6, inR = p => { const Rr = hi - groundH(p.x, p.z); return Rr > 0.4 && Rr < 3.6; };
    if (!inR(bm) || pts.filter(p => !p.bm && inR(p)).length < 2) continue;
    bm.elev = Math.round((50 + r() * 450) * 1000) / 1000;
    return { points: pts, setups: [{ id: 'S1', x: s0.x, z: s0.z }], cur: 0, E0, N0 };
  }
  const a = dryNear(s0.x + 30, s0.z - 20), b = dryNear(s0.x - 25, s0.z - 30), c = dryNear(s0.x + 40, s0.z + 35);
  return { points: [{ id: 'BM1', x: a.x, z: a.z, bm: true, elev: 100 }, { id: 'P1', x: b.x, z: b.z, bm: false, elev: null }, { id: 'P2', x: c.x, z: c.z, bm: false, elev: null }], setups: [{ id: 'S1', x: s0.x, z: s0.z }], cur: 0, E0, N0 };
}
