// نقل الجهاز / عالم جديد — استُخرج من main.js (B-003)
import * as I from './instrument.js';
import { instPos, faceInstrument, setMarkers, regen, placeHolderAt } from './world.js';
import { CFG, flags, ST, saveCfg } from './state.js';
import { afterChange } from './mount.js';
import { setMode, snapCam } from './camera.js';
import { toast, $, showErr, setTxt } from './util.js';
import { fbRender } from './books-level.js';
import { ttRender } from './books-tt.js';
import { saveState, loadSaved, randomJob } from './job.js';
import { H } from './hooks.js';

export function placeInstrument(s, quiet) {
  I.setRig(s.x, s.z); instPos.x = s.x; instPos.z = s.z;
  I.reset(CFG.legs, CFG.state); faceInstrument(); afterChange();
  flags.orient = false; ST.lastMeas = ''; ST.stepKey = '';
  const tri = CFG.state === 'off';
  setMode(tri ? 'tripod' : 'inst', tri ? 5.2 : 1.3); snapCam();
  if (!quiet) toast('نُقل الجهاز إلى ' + s.id + ' — أعد ضبطه');
}
export function onJobChanged() {
  setMarkers(ST.job.points, ST.job.setups);
  H.renderPtBtns(); H.renderMapList(); H.drawMap(); fbRender(); ttRender(); saveState();
}
export function newWorld(sd) {
  $('#loading').style.display = 'flex';
  setTimeout(() => {
    try { doNewWorld(sd); } catch (e) { showErr('world: ' + e.message); }
    $('#loading').style.display = 'none';
  }, 40);
}
export function doNewWorld(sd) {
  ST.seed = sd; CFG.seed = String(sd); saveCfg();
  regen(sd); ST.mapImg = null;
  const sv = loadSaved(sd);
  ST.job = sv ? sv.job : randomJob(sd); ST.rows = sv ? (sv.rows || []) : []; ST.rowsT = sv ? (sv.rowsT || []) : [];
  if (ST.job.E0 == null) { ST.job.E0 = 1000; ST.job.N0 = 1000; }
  const cur = ST.job.setups[ST.job.cur] || ST.job.setups[0] || { id: 'S1', x: 0, z: 0 };
  if (!ST.job.setups.length) ST.job.setups = [cur];
  I.setRig(cur.x, cur.z); instPos.x = cur.x; instPos.z = cur.z;
  I.reset(CFG.legs, CFG.state);
  const first = ST.job.points.find(p => p.bm) || ST.job.points[0];
  if (first) placeHolderAt(first);
  $('#cfgSeed').value = sd; setTxt('#seedLbl', String(sd)); setTxt('#mapSeed', String(sd));
  H.applyInstType(CFG.inst, true);
  afterChange(); onJobChanged();
  const tri = CFG.state === 'off';
  setMode(tri ? 'tripod' : 'inst', tri ? 5.2 : 1.3); snapCam();
  toast('🌱 بذرة العالم: ' + sd);
}
export const randSeed = () => Math.floor(Math.random() * 899999) + 100000;
export function newJob() {
  ST.job = randomJob(randSeed()); ST.rows = []; ST.rowsT = [];
  placeInstrument(ST.job.setups[0], true);
  const first = ST.job.points.find(p => p.bm) || ST.job.points[0];
  if (first) placeHolderAt(first);
  onJobChanged(); toast('مهمة جديدة على نفس العالم');
}
