import { setStaffStyle, setQuality, setVegDensity } from './world.js';
import * as I from './instrument.js';
import { showErr, toast, say } from './util.js';
import { CFG, ST } from './state.js';
import { mapOpen } from './ctx.js';
import './tabs.js';
import { placeInstrument, randSeed, onJobChanged, doNewWorld } from './transfer.js';
import { HALF } from './map.js';
import './profile.js';
import './traverse.js';
import './contours.js';
import './polygons.js';
import { lanRefresh } from './errors.js';
import './tt-tools.js';
import { resize, step, render } from './loop.js';
import './settings-ui.js';


// NIVO-V8


// NIVO-V5 — تيودوليت رقمي + تاكيومتر يدوي ذاتي الاختزال (قوانين المقرر) + تاكيومتر آلي


// ---------- بدء ----------
setQuality(+CFG.q); resize();
setStaffStyle(CFG.pat, CFG.lab);
lanRefresh();
setVegDensity(+CFG.veg);
doNewWorld(CFG.fix && +CFG.seed > 0 ? +CFG.seed : randSeed());

let last = performance.now();
(function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  try { step(dt); } catch (e) { showErr('step: ' + e.message); }
  if (!mapOpen()) { try { render(); } catch (e) { showErr('render: ' + e.message); } }
  requestAnimationFrame(loop);
})(last);

// جسر للوحدات الإضافية (مساعدة قراءة الميرا)
window.NIVO = { sight: () => ST.S, cfg: () => CFG, type: () => I.type, say: (t, c) => say(t, c) };
Object.assign(window.NIVO || (window.NIVO = {}), { toast, onJobChanged, placeInstrument });
Object.assign(window.NIVO, { job: () => ST.job, half: () => HALF });
// NIVO-V9
// NIVO-V10
