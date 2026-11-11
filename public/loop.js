// الإطار — استُخرج من main.js (B-003)
import { $, setTxt, setCl, dms, $$, DEG, wrapPi, clamp } from './util.js';
import * as I from './instrument.js';
import { isTT, mapOpen, eyeIdeal, scopeCam, fx, jogT, sideLayout, elSheet, elT1, elLegs, cam, scopeEl } from './ctx.js';
import { flags, ST } from './state.js';
import { holder, updateHolder, scene, renderer } from './world.js';
import { updLegLabels } from './mount.js';
import { drawMap, sizeMap } from './map.js';
import { bearingToStaff, setHeading, setVz } from './pointing.js';
import { renderSteps } from './steps.js';
import { updCam } from './camera.js';
import { sightInfo, _t } from './sight.js';
import { updK } from './books-tt.js';
import { drawLevel, drawHead } from './leveling.js';
import { drawReadWin, drawIdx, updLabels } from './device.js';

// NIVO-V5 — تيودوليت رقمي + تاكيومتر يدوي ذاتي الاختزال (قوانين المقرر) + تاكيومتر آلي
const elT2 = $('#t2');
let uiT = 0, lastHd = -1;
function updUI() {
  const T = I.getTilt(), m = I.st.mounted, ty = I.TY(), kind = I.type;
  let t, c;
  if (!m) { t = 'ركّب الجهاز أولاً'; c = 'warn'; }
  else if (kind === 'level') {
    if (T.arc <= ty.ring) { t = `✓ الفقاعة في المركز — ميلان ${T.arc.toFixed(1)}′`; c = 'ok'; }
    else if (T.arc <= ty.comp) { t = `ضمن مدى المعوّض لكن غير متمركز — ${T.arc.toFixed(1)}′`; c = 'warn'; }
    else { t = `⚠ ميلان ${T.arc.toFixed(0)}′ — خارج مدى المعوّض (±${ty.comp}′): قراءاتك ستكون خاطئة`; c = 'bad'; }
  } else if (kind === 'theo' || kind === 'tach') {
    const b = T.gx * Math.cos(I.st.heading) + T.gz * Math.sin(I.st.heading), bsec = b * 3437.75 * 60;
    if (T.arc <= ty.ring) { t = `✓ مُسوّى — الفقاعة تقرأ ${bsec >= 0 ? '+' : ''}${bsec.toFixed(0)}″ (≤ 30″). دوّر 90° وتأكد`; c = 'ok'; }
    else { t = `الفقاعة تقرأ ${b >= 0 ? '+' : ''}${(b * 3437.75).toFixed(1)}′ على محورها — دوّر الجهاز 90° وتحقق من الاتجاه الآخر`; c = 'warn'; }
  } else {
    const cr = (T.gx * Math.cos(I.st.heading) + T.gz * Math.sin(I.st.heading)) * 3437.75, al = (T.gx * Math.sin(I.st.heading) - T.gz * Math.cos(I.st.heading)) * 3437.75;
    const tail = `X ${cr >= 0 ? '+' : ''}${cr.toFixed(1)}′  Y ${al >= 0 ? '+' : ''}${al.toFixed(1)}′`;
    if (T.arc <= ty.ring) { t = `✓ مُسوّى — ${tail}`; c = 'ok'; }
    else if (T.arc <= ty.comp) { t = `ضمن مدى المعوّض ±3′ لكن غير متمركز — ${tail}`; c = 'warn'; }
    else { t = `⚠ الميل خارج ±3′: المعوّض معطّل — ${tail}`; c = 'bad'; }
  }
  setTxt('#lvStat', t); setCl('#lvStat', 'stat ' + c);
  const ht = I.headTiltDeg();
  setTxt('#headStat', `ميلان رأس الحامل: ${ht.toFixed(2)}°`); setCl('#headStat', 'stat ' + (ht <= 0.5 ? 'ok' : ht <= 2 ? 'warn' : 'bad'));
  if (isTT()) {
    const rd = I.readings();
    if (kind === 'tach') {
      const ib = I.indexBubble(), okb = Math.abs(ib) <= 0.5;
      setTxt('#hud', m ? (okb ? 'كمانة V ✓' : '⚠ كمانة V') : ''); $('#hud').style.color = okb ? '#7ee787' : '#f2cc60';
      setTxt('#idxStat', okb ? '✓ مركزية' : 'غير مركزية — حرّك برغي الفهرس');
    } else {
      let s = `Hz ${dms(rd.hz)}\nV  ${dms(rd.v)}   وجه ${rd.face === 1 ? 'I' : 'II'}`;
      if (kind === 'ts') s += `\n${rd.comp ? 'معوّض ✓' : '⚠ الميل خارج ±3′ — المعوّض معطّل'}${flags.orient ? '' : '   |   الاتجاه غير مضبوط'}${ST.lastMeas ? '\n' + ST.lastMeas : ''}`;
      setTxt('#lcd', s);
      setTxt('#hud', m ? `Hz ${dms(rd.hz)}\nV ${dms(rd.v)}${kind === 'ts' ? (rd.comp ? ' ✓' : ' ⚠') : ''}` : '');
      $('#hud').style.color = kind === 'ts' && !rd.comp ? '#ff7b72' : '#7ee787';
    }
  } else {
    setTxt('#hud', !m ? '' : T.arc <= ty.comp ? 'المعوّض ✓' : '⚠ المعوّض خارج المدى');
    $('#hud').style.color = T.arc <= ty.comp ? '#7ee787' : '#ff7b72';
  }
  $$('#ptBtns button').forEach(b => b.classList.toggle('on', !holder.walking && !!holder.station && holder.station.id === b.dataset.id));
  updLegLabels();
  if (mapOpen()) drawMap();
  const F = flags, ts = kind === 'ts';
  F.height = I.st.H >= 1.3 && I.st.H <= 1.6;
  F.headLevel = ht <= 0.5;
  F.legsLock = I.st.legLock.every(Boolean);
  F.mounted = m;
  F.level = m && T.arc <= ty.ring;
  F.rough = m && !holder.walking && (isTT() ? ST.S.ang < 0.6 * DEG : Math.abs(wrapPi(I.st.heading - bearingToStaff())) < 0.55 * DEG);
  F.aim = m && !!ST.S.hit && Math.abs(ST.S.lat) < (ts ? 0.05 : 0.04) && I.st.clamp && (!isTT() || I.st.clampV) && (!ts || !!ST.S.edm);
  F.eye = Math.abs(ST.eyeV - eyeIdeal) < 0.05;
  F.focus = m && !!ST.S.hit && Math.abs(Math.log(3 * Math.pow(200 / 3, ST.focV) / ST.S.dist)) <= 0.12;
  renderSteps();
}
export function step(dt) {
  I.update(dt); updateHolder(dt);
  if (ST.slow) { ST.slowT += dt; if (ST.slowT > 0.25) setHeading(I.st.heading + ST.slow * DEG * Math.min(0.7, 0.12 + (ST.slowT - 0.25) * 0.4) * dt); }
  if (ST.slowV) { ST.slowVT += dt; if (ST.slowVT > 0.25) setVz(I.st.vz + ST.slowV * DEG * Math.min(0.7, 0.12 + (ST.slowVT - 0.25) * 0.4) * dt); }
  updCam(dt);
  I.scopePose(scopeCam);
  scene.updateMatrixWorld();
  ST.S = sightInfo();
  scopeCam.getWorldDirection(_t); fx.setSpread(I.type === 'tach' ? 1 - _t.y * _t.y : 1); if (I.type === 'tach') updK();
  const d = ST.S.hit ? ST.S.dist : 70, fd = 3 * Math.pow(200 / 3, ST.focV);
  ST.blurFrac = clamp(Math.max(0, Math.abs(Math.log(fd / d)) - 0.1) * 18, 0, 16) / 370;
  ST.softFrac = Math.max(0, Math.abs(ST.eyeV - eyeIdeal) - 0.04) * 20 / 370 * 2;
  const hd = I.st.heading / DEG;
  if (hd !== lastHd) { lastHd = hd; setTxt('#hdgVal', hd.toFixed(1) + '°'); jogT.style.backgroundPositionX = (-hd * 2) + 'px'; }
  uiT += dt; if (uiT > 0.1) { uiT = 0; updUI(); }
  const sheetMin = !sideLayout() && elSheet.classList.contains('min');
  if (elT1.classList.contains('on') && !sheetMin) { drawLevel(); if (elLegs.open) drawHead(); }
  if (I.type === 'tach' && elT2.classList.contains('on') && !sheetMin) { drawReadWin(); drawIdx(); }
}
export function render() {
  if (window.NIVO && window.NIVO.droneActive && window.NIVO.droneActive()) { window.NIVO.droneRender(); return; }
  const W = innerWidth, H = innerHeight;
  renderer.setScissorTest(false);
  renderer.setRenderTarget(null);
  renderer.setViewport(0, 0, W, H);
  if (ST.scopeFull) { renderer.setClearColor(0x000000, 1); renderer.clear(); }
  else {
    const r = elSheet.getBoundingClientRect();
    let ox = 0, oy = -22;
    if (sideLayout()) ox = Math.max(0, W - r.left) / 2;
    else oy = (Math.max(0, H - r.top) - 44) / 2;
    cam.aspect = W / H; cam.setViewOffset(W, H, ox, oy, W, H);
    renderer.render(scene, cam);
  }
  if (I.st.mounted) {
    const r = scopeEl.getBoundingClientRect();
    if (r.width > 4) {
      scopeCam.aspect = 1; scopeCam.updateProjectionMatrix();
      fx.draw(scene, scopeCam, { x: r.left, y: H - r.bottom, w: r.width, h: r.height }, ST.blurFrac, ST.softFrac);
    }
  }
  updLabels();
}
export function resize() { renderer.setSize(innerWidth, innerHeight, false); if (mapOpen()) { sizeMap(); drawMap(); } }
addEventListener('resize', resize);
resize();
