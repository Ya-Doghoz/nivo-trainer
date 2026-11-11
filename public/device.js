// نوع الجهاز — استُخرج من main.js (B-003)
import { lblBox, fx, cam } from './ctx.js';
import { $, $$, openTab, toast, DEG, clamp, V3 } from './util.js';
import * as I from './instrument.js';
import { doMount } from './mount.js';
import { orb, setMode } from './camera.js';
import { CFG, saveCfg, flags, ST } from './state.js';
import { applyErr } from './errors.js';
import { setTarget } from './targets.js';
import { placeInstrument } from './transfer.js';
import { ttRender } from './books-tt.js';
import { fbRender } from './books-level.js';
import { H } from './hooks.js';

let curParts = [];
function buildPartLabels() {
  lblBox.innerHTML = ''; $('#partsList').innerHTML = ''; $('#partInfo').innerHTML = '';
  curParts = I.partsFor();
  curParts.forEach((p, i) => {
    const b = document.createElement('button'); b.className = 'lbl ' + (i % 2 ? 'r' : 'l'); b.textContent = p.name; b.onclick = () => showPart(p);
    lblBox.appendChild(b); p.el = b;
    const li = document.createElement('button'); li.textContent = p.name; li.onclick = () => showPart(p); $('#partsList').appendChild(li);
  });
}
function showPart(p) {
  if (!I.st.mounted) doMount();
  if (I.st.exTarget < 0.5) { I.setExplode(true); $('#btnExplode').classList.add('on'); }
  $$('.lbl').forEach(x => x.classList.toggle('sel', x === p.el));
  $('#partInfo').innerHTML = `<h4>${p.name}</h4><p>${p.desc}</p>`;
  orb.part = p; setMode('part', 1.3);
}
export function applyInstType(t, quiet) {
  CFG.inst = t; saveCfg(); I.setType(t); applyErr(); document.body.dataset.inst = t;
  $('#cfgInst').value = t; $('#btnInst').textContent = '🔧 ' + I.TY().name;
  fx.setMode(t === 'ts' ? 2 : t === 'tach' ? 1 : 0); setTarget(t === 'ts' ? 'prism' : 'staff');
  buildPartLabels(); flags.read = flags.dist = flags.two = flags.orient = flags.face2 = false; ST.stepKey = ''; ST.lastMeas = '';
  const act = $('#tabs button.on'); if (act && act.offsetParent === null) openTab('t1');
  if (!quiet) placeInstrument(ST.job.setups[ST.job.cur] || { id: 'S1', x: 0, z: 0 }, true);
  ttRender(); fbRender();
  if (!quiet) toast('الجهاز: ' + I.TY().name);
}
H.applyInstType = applyInstType;
$('#btnInst').onclick = () => { const o = ['level', 'theo', 'tach', 'ts']; applyInstType(o[(o.indexOf(I.type) + 1) % 4]); };
// NIVO-V5 — تيودوليت رقمي + تاكيومتر يدوي ذاتي الاختزال (قوانين المقرر) + تاكيومتر آلي
const rw = $('#rdwin'), rwc = rw.getContext('2d'), ix = $('#idxv'), ixc = ix.getContext('2d');
(function () { const d = Math.min(devicePixelRatio || 1, 2); rw.width = 340 * d; rw.height = 124 * d; rwc.setTransform(d, 0, 0, d, 0, 0); ix.width = 340 * d; ix.height = 56 * d; ixc.setTransform(d, 0, 0, d, 0, 0); })();
function drawStrip(c, y, label, ang) {
  const x0 = 34, w = 296, deg = ang / DEG, d = Math.floor(deg), m = (deg - d) * 60;
  c.fillStyle = '#e8e4cf'; c.fillRect(x0, y, w, 46);
  c.strokeStyle = '#222'; c.lineWidth = 1; c.fillStyle = '#222'; c.font = '9px sans-serif'; c.textAlign = 'center';
  for (let k = 0; k <= 60; k++) {
    const x = x0 + k * w / 60, h = k % 10 === 0 ? 12 : k % 5 === 0 ? 9 : 6;
    c.beginPath(); c.moveTo(x, y + 46); c.lineTo(x, y + 46 - h); c.stroke();
    if (k % 10 === 0) c.fillText(String(k), x, y + 30);
  }
  const xl = x0 + m * w / 60;
  c.strokeStyle = '#c1121f'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(xl, y + 2); c.lineTo(xl, y + 42); c.stroke();
  c.fillStyle = '#c1121f'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.fillText(d + '°', clamp(xl, x0 + 16, x0 + w - 16), y + 15);
  c.fillStyle = '#fff'; c.font = '12px sans-serif'; c.textAlign = 'left'; c.fillText(label, 6, y + 28);
}
export function drawReadWin() {
  const rd = I.readings();
  rwc.fillStyle = '#161616'; rwc.fillRect(0, 0, 340, 124);
  drawStrip(rwc, 6, 'Hz', rd.hz); drawStrip(rwc, 68, 'V', rd.v);
}
export function drawIdx() {
  const c = ixc, b = I.indexBubble(), k = 23;
  c.clearRect(0, 0, 340, 56); c.fillStyle = '#0d2a22'; c.fillRect(30, 12, 280, 32); c.strokeStyle = '#5fd6b0'; c.lineWidth = 2; c.strokeRect(30, 12, 280, 32);
  for (let t = -6; t <= 6; t++) { c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(170 + t * k, 12); c.lineTo(170 + t * k, 20); c.stroke(); }
  c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(170 - 0.5 * k, 12); c.lineTo(170 - 0.5 * k, 44); c.moveTo(170 + 0.5 * k, 12); c.lineTo(170 + 0.5 * k, 44); c.stroke();
  c.fillStyle = 'rgba(190,255,225,.9)'; c.beginPath(); c.ellipse(clamp(170 + b * k, 56, 284), 28, 26, 12, 0, 0, 7); c.fill();
}
$$('[data-ix]').forEach(b => (b.onclick = () => { if (!I.st.mounted) return toast('ركّب الجهاز أولاً'); I.nudgeIdx(+b.dataset.ix); }));
addEventListener('nivo-custom', () => buildPartLabels());
const _lv = new V3();
export function updLabels() {
  const on = I.st.explode > 0.6 && I.st.mounted && !ST.scopeFull;
  lblBox.style.display = on ? 'block' : 'none'; if (!on) return;
  const W = innerWidth, H = innerHeight;
  curParts.forEach(p => {
    if (!p.el) return;
    p.anchor.getWorldPosition(_lv).project(cam);
    p.el.style.display = _lv.z < 1 && _lv.z > -1 ? '' : 'none';
    p.el.style.transform = `translate(${(_lv.x + 1) / 2 * W}px,${(1 - _lv.y) / 2 * H}px) translate(var(--sx),-50%)`;
  });
}
