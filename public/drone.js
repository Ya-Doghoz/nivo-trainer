// الدرون v2: منظور من الأرض + شاشة جهاز التحكم، تصادم مع المباني، بطارية وحمولة، وصوت من drone-sound.js
import * as THREE from 'three';
import { renderer, scene, instPos, groundH, isWater, riverInfo, houseCollide } from './world.js';
import * as I from './instrument.js';
import { DC, soundCfg, payloadMass, PAY, buildCfg } from './drone-config.js';

const $ = s => document.querySelector(s), DEG = Math.PI / 180, clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const N = () => window.NIVO || {};
const MAXC = 3.5;
const mass = () => payloadMass(DC.payload), maxV = () => DC.maxV * (1 - 0.12 * mass()), hov = () => 0.46 + 0.12 * mass();
const D = { on: false, armed: false, mode: 'idle', ph: 0, x: 0, y: 0, z: 0, yaw: 0, yr: 0, vx: 0, vy: 0, vz: 0, gim: -12 * DEG, cam: 'ctrl', sound: true, tags: true, t: 0, spin: 0, coll: 0, spd: 0, agl: 0, head: 0, bat: 100, low: false, home: { x: 0, y: 0, z: 0 } };
const PD = { f: 0, s: 0, c: 0, y: 0 }, KB = new Set();
const log = a => { const l = N().logbook; if (l) l.event('drone', { a }); };
const surf = (x, z) => { let h = groundH(x, z); if (isWater(x, z)) { const w = riverInfo(x, z).wl; if (w > h) h = w; } return h; };

// ---------- المدخلات ----------
const kb = (p, n) => (KB.has(p) ? 1 : 0) - (KB.has(n) ? 1 : 0);
const inp = () => ({
  f: clamp(PD.f + kb('KeyW', 'KeyS') + kb('ArrowUp', 'ArrowDown'), -1, 1), s: clamp(PD.s + kb('KeyD', 'KeyA') + kb('ArrowRight', 'ArrowLeft'), -1, 1),
  c: clamp(PD.c + kb('KeyR', 'KeyF') + kb('Space', 'ShiftLeft'), -1, 1), y: clamp(PD.y + kb('KeyE', 'KeyQ'), -1, 1)
});
const KEYS = new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'Space', 'ShiftLeft', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
addEventListener('keydown', e => {
  if (!D.on) return;
  if (e.code === 'Escape') { exitDrone(); e.stopImmediatePropagation(); return; }
  if (KEYS.has(e.code)) { KB.add(e.code); e.preventDefault(); e.stopImmediatePropagation(); }
}, true);
addEventListener('keyup', e => { if (KEYS.has(e.code)) { KB.delete(e.code); if (D.on) e.stopImmediatePropagation(); } }, true);

// ---------- النموذج ----------
const model = new THREE.Group(), rotors = [];
(function () {
  const Mt = c => new THREE.MeshLambertMaterial({ color: c }), dark = Mt(0x2b2f36);
  model.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.28), dark));
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.05), Mt(0xd9382a)); nose.position.set(0, 0.01, -0.16); model.add(nose);
  const gm = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), Mt(0x111111)); gm.position.set(0, -0.05, -0.12); model.add(gm);
  [1, -1].forEach(a => { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.02, 0.03), dark); arm.rotation.y = a * Math.PI / 4; model.add(arm); });
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const g = new THREE.Group(); g.position.set(sx * 0.22, 0.04, sz * 0.22);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.04, 8), Mt(0xdfe3e8)));
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.004, 0.022), Mt(0x777777)); g.add(bl);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.13, 18), new THREE.MeshBasicMaterial({ color: 0xbbbbbb, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; g.add(disc);
    model.add(g); rotors.push({ bl, disc, dir: sx * sz > 0 ? 1 : -1 });
  });
})();
model.scale.setScalar(2.2); model.visible = false; model.frustumCulled = false; scene.add(model);
const gcam = new THREE.PerspectiveCamera(60, 1, 0.1, 3600), fcam = new THREE.PerspectiveCamera(72, 1, 0.1, 3600); fcam.rotation.order = 'YXZ';

// ---------- علامات النقاط ----------
const bea = new THREE.Group(); bea.visible = false; scene.add(bea);
let tags = [];
function buildBeacons() {
  while (bea.children.length) { const o = bea.children[0]; bea.remove(o); o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); }
  tags.forEach(t => t.el.remove()); tags = [];
  const job = N().job && N().job(); if (!job) return;
  const add = (p, col, txt) => {
    const gy = groundH(p.x, p.z);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 12, 8), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6, depthWrite: false }));
    m.position.set(p.x, gy + 6, p.z); bea.add(m);
    const el = document.createElement('div'); el.className = 'dtag'; el.textContent = txt; el.style.color = '#' + col.toString(16).padStart(6, '0');
    $('#dLabels').appendChild(el); tags.push({ el, x: p.x, y: gy + 12.8, z: p.z });
  };
  job.points.forEach(p => add(p, p.bm ? 0x2ea043 : 0xe8402a, p.id));
  job.setups.forEach(s => add(s, 0x4dabf7, s.id));
}
const _v = new THREE.Vector3();
function projTags(cam, rect) {
  tags.forEach(t => {
    _v.set(t.x, t.y, t.z).project(cam);
    const vis = D.tags && _v.z < 1 && _v.z > -1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
    t.el.style.display = vis ? 'block' : 'none';
    if (vis) t.el.style.transform = `translate(${rect.l + (_v.x + 1) / 2 * rect.w}px,${rect.t + (1 - _v.y) / 2 * rect.h}px) translate(-50%,-100%)`;
  });
}

// ---------- الواجهة ----------
function css() {
  const s = document.createElement('style');
  s.textContent = `
body.droneOn > *:not(#c):not(#droneUI):not(#logUI){visibility:hidden!important}
#droneUI{position:fixed;inset:0;z-index:80;pointer-events:none;direction:ltr;font-family:system-ui,sans-serif;color:#fff;display:none}
body.droneOn #droneUI{display:block}
#droneUI button{pointer-events:auto;background:rgba(15,22,32,.78);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:10px;padding:7px 9px;font-size:13px}
#droneUI button.on{background:#1f6feb}
#dTop{position:absolute;top:6px;left:6px;right:6px;display:flex;gap:5px;justify-content:center;overflow-x:auto}
#dScr{position:absolute;top:50px;left:50%;transform:translateX(-50%);width:min(94vw,calc(46vh * 16 / 9),400px);aspect-ratio:16/9;border:4px solid #151a21;border-radius:14px;box-shadow:0 0 0 2px #4a5666,0 8px 20px #000b;pointer-events:none;overflow:hidden;display:none}
body.dCtrl #dScr{display:block}
#dScr:after{content:'+';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:22px;opacity:.55}
#dTag{position:absolute;top:4px;left:6px;font:11px monospace;background:rgba(0,0,0,.45);padding:1px 5px;border-radius:5px}
#dHud{position:absolute;bottom:4px;left:4px;right:4px;font:11px/1.4 monospace;background:rgba(10,16,24,.55);border-radius:6px;padding:3px 6px;white-space:pre;direction:rtl;text-align:right}
body:not(.dCtrl) #dHud{position:absolute;top:50px;bottom:auto;left:6px;right:auto;font-size:12px;max-width:60vw}
#dMini{position:absolute;bottom:30px;left:50%;transform:translateX(-50%);width:88px;height:88px;border-radius:50%}
#dGim{position:absolute;right:8px;top:55%;transform:translateY(-50%);display:flex;flex-direction:column;gap:6px;align-items:center}
.dpad{position:absolute;bottom:20px;width:128px;height:128px;border-radius:50%;background:rgba(255,255,255,.10);border:2px solid rgba(255,255,255,.35);pointer-events:auto;touch-action:none}
#dpL{left:10px}#dpR{right:10px}
.dknob{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(255,255,255,.45);pointer-events:none}
.dcap{position:absolute;bottom:152px;font-size:11px;opacity:.8;pointer-events:none;direction:rtl}
#dMsg{position:absolute;bottom:185px;left:50%;transform:translateX(-50%);background:rgba(10,16,24,.85);padding:6px 12px;border-radius:8px;font-size:13px;display:none;max-width:90vw;text-align:center;direction:rtl}
#dLabels{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.dtag{position:absolute;left:0;top:0;font:bold 11px sans-serif;text-shadow:0 0 3px #000,0 0 3px #000;white-space:nowrap;will-change:transform}
#dCfg{position:absolute;inset:44px 6px 6px 6px;background:rgba(11,17,24,.96);border-radius:12px;padding:10px;overflow:auto;pointer-events:auto;display:none;direction:rtl}
#dCfg .row{display:flex;gap:8px;align-items:center;margin:6px 0}#dCfg label{flex:1;font-size:13px}
#dCfg select,#dCfg input[type=number]{background:#1b2735;color:#fff;border:1px solid #33465c;border-radius:8px;padding:5px}
#dCfg .note{font-size:12px;opacity:.85;margin:8px 0 2px}#dCfg button{pointer-events:auto}`;
  document.head.appendChild(s);
}
let mt = 0;
function msg(t, ms = 3200) { const m = $('#dMsg'); if (!m) return; m.textContent = t; m.style.display = 'block'; clearTimeout(mt); mt = setTimeout(() => { m.style.display = 'none'; }, ms); }
function pad(el, cb) {
  const knob = el.firstElementChild; let id = null, cx = 0, cy = 0, R = 1;
  const set = (dx, dy) => { const L = Math.hypot(dx, dy), k = L > R ? R / L : 1; dx *= k; dy *= k; knob.style.transform = `translate(${dx}px,${dy}px)`; cb(Math.abs(dx) < R * 0.08 ? 0 : dx / R, Math.abs(dy) < R * 0.08 ? 0 : -dy / R); };
  el.addEventListener('pointerdown', e => { id = e.pointerId; el.setPointerCapture(id); const r = el.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width / 2 - 10; set(e.clientX - cx, e.clientY - cy); e.preventDefault(); });
  el.addEventListener('pointermove', e => { if (e.pointerId === id) set(e.clientX - cx, e.clientY - cy); });
  const up = e => { if (e.pointerId !== id) return; id = null; knob.style.transform = ''; cb(0, 0); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
const VIEWS = ['ctrl', 'fpv', 'ground'], VLAB = { ctrl: '🎮 تحكم', fpv: '📷 FPV', ground: '👁 أرضي' };
function setView(v) {
  D.cam = v; document.body.classList.toggle('dCtrl', v === 'ctrl' && D.on);
  const b = $('#dCam'); if (b) b.textContent = VLAB[v];
  const hud = $('#dHud'), host = v === 'ctrl' ? $('#dScr') : $('#droneUI'); if (hud && host && hud.parentNode !== host) host.appendChild(hud);
  groundSound();
}
function ui() {
  if ($('#droneUI')) return;
  css();
  const d = document.createElement('div'); d.id = 'droneUI';
  d.innerHTML = `<div id="dTop"><button id="dExit">✕</button><button id="dTake">⏏ إقلاع</button><button id="dHome">🏠</button><button id="dCam">🎮 تحكم</button><button id="dLbl" class="on">🏷</button><button id="dSnd" class="on">🔊</button><button id="dBat">🔋 بدّل</button><button id="dSet">⚙️</button></div>
<div id="dScr"><div id="dTag"></div><div id="dHud"></div></div><canvas id="dMini" width="112" height="112"></canvas>
<div id="dGim"><button id="dGU">▲</button><b id="dGv" style="font-size:12px">-12°</b><button id="dGD">▼</button></div>
<div class="dcap" style="left:14px">ارتفاع ↕ · دوران ↔</div><div class="dcap" style="right:40px">حركة</div>
<div class="dpad" id="dpL"><div class="dknob"></div></div><div class="dpad" id="dpR"><div class="dknob"></div></div>
<div id="dLabels"></div><div id="dMsg"></div><div id="dCfg"></div>`;
  document.body.appendChild(d);
  pad($('#dpL'), (x, y) => { PD.y = x; PD.c = y; }); pad($('#dpR'), (x, y) => { PD.s = x; PD.f = y; });
  $('#dExit').onclick = exitDrone; $('#dTake').onclick = toggleFlight; $('#dHome').onclick = goHome;
  $('#dCam').onclick = () => setView(VIEWS[(VIEWS.indexOf(D.cam) + 1) % 3]);
  $('#dLbl').onclick = () => { D.tags = !D.tags; $('#dLbl').classList.toggle('on', D.tags); bea.visible = D.on && D.tags; };
  $('#dSnd').onclick = () => setSound(!D.sound);
  $('#dBat').onclick = () => { if (D.armed) return msg('هبّط الدرون أولاً'); D.bat = 100; D.low = false; msg('🔋 رُكّبت بطارية مشحونة'); };
  $('#dSet').onclick = () => { const p = $('#dCfg'); const on = p.style.display !== 'block'; p.style.display = on ? 'block' : 'none'; if (on) buildCfg(p); };
  const gv = dv => { D.gim = clamp(D.gim + dv * DEG, -90 * DEG, 25 * DEG); $('#dGv').textContent = Math.round(D.gim / DEG) + '°'; };
  $('#dGU').onclick = () => gv(10); $('#dGD').onclick = () => gv(-10);
}

// ---------- الصوت ----------
let snd = null, starting = false;
const loadScript = src => new Promise((res, rej) => {
  if (window.DroneSoundEngine) return res();
  const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('الملف غير موجود: ' + src)); document.head.appendChild(s);
});
async function startSound() {
  if (snd || starting || !D.sound) return;
  starting = true;
  try {
    await loadScript('/drone-sound.js');
    if (!window.DroneSoundEngine) throw new Error('المحرك لم يُحمَّل');
    const e = new window.DroneSoundEngine(Object.assign({ workletUrl: '/drone-worklet.js' }, soundCfg()));
    await e.start();
    e.setCfg(soundCfg()); e.setCombo(DC.payload);
    if (!D.on) { e.dispose(); return; }
    snd = e; groundSound();
    msg(e.mode === 'worklet' ? '🔊 المحرك الصوتي يعمل' : '🔊 صوت احتياطي بسيط — الـ worklet لم يعمل: ' + (e.err || '؟'), 4000);
  } catch (err) { msg('🔇 لا صوت: ' + (err.message || err), 5000); }
  finally { starting = false; }
}
function groundSound() {
  if (!snd) return;
  const ri = riverInfo(instPos.x, instPos.z);
  snd.setGround(isWater(instPos.x, instPos.z) || ri.d < ri.hw + 12 ? 'water' : 'grass');
}
function setSound(on) {
  D.sound = on; const b = $('#dSnd'); if (b) { b.classList.toggle('on', on); b.textContent = on ? '🔊' : '🔇'; }
  if (on && !snd && D.on) startSound();
  else if (snd && snd.master) { try { snd.master.gain.setTargetAtTime(on ? DC.masterVolume : 0, snd.ctx.currentTime, 0.05); } catch (_) {} }
}
window.addEventListener('nivo-drone-cfg', () => {
  if (!snd) return;
  const c = soundCfg(); if (!D.sound) delete c.masterVolume;
  snd.setCfg(c); snd.setCombo(DC.payload);
});
function soundUpdate(dt, u) {
  if (!snd || !D.sound) return;
  const fpv = D.cam === 'fpv';
  let pos = { x: 0, y: 0, z: -4 }, vel = { x: 0, y: 0, z: 0 };
  if (!fpv) {
    const gx = instPos.x, gz = instPos.z, gy = groundH(gx, gz) + 1.6, dx = D.x - gx, dy = D.y - gy, dz = D.z - gz;
    const az = Math.atan2(dx, -dz);
    D.head += Math.atan2(Math.sin(az - D.head), Math.cos(az - D.head)) * (1 - Math.exp(-dt / 1.2));
    const c = Math.cos(D.head), s = Math.sin(D.head), rx = c, rz = s, fx = s, fz = -c;
    pos = { x: dx * rx + dz * rz, y: dy, z: -(dx * fx + dz * fz) };
    vel = { x: D.vx * rx + D.vz * rz, y: D.vy, z: -(D.vx * fx + D.vz * fz) };
  }
  snd.update({
    armed: D.armed, collective: D.coll, pitch: u.f, roll: u.s, yawRate: clamp(D.yr / 1.6, -1, 1),
    advance: clamp(D.spd / maxV(), 0, 1), descent: clamp(-D.vy / 3, 0, 1), onboard: fpv ? 1 : 0, pos, vel,
    wind: { x: 1.2 * Math.sin(D.t * 0.05), z: -1 + 0.6 * Math.sin(D.t * 0.031) }, tipSpeed: 60 + 25 * D.coll, micHeight: 1.6
  }, dt);
}

// ---------- الطيران ----------
function syncBtns() {
  const b = $('#dTake'); if (b) b.textContent = !D.armed ? '⏏ إقلاع' : D.mode === 'land' ? '↻ إلغاء' : '⬇ هبوط';
  const q = $('#dBat'); if (q) q.style.display = D.armed ? 'none' : 'inline-block';
}
function toggleFlight() {
  if (!D.armed) {
    if (DC.battery && D.bat < 15) return msg('🔋 البطارية ضعيفة — اضغط «🔋 بدّل» أولاً');
    D.armed = true; D.mode = 'takeoff'; startSound(); log('takeoff'); msg('إقلاع…');
  } else if (D.mode === 'land') { D.mode = 'fly'; msg('أُلغي الهبوط'); }
  else { D.mode = 'land'; log('land'); msg('هبوط تلقائي…'); }
  syncBtns();
}
function goHome() {
  if (!D.armed) return msg('أقلع أولاً');
  D.mode = 'rth'; D.ph = 0; log('rth'); msg('عودة تلقائية إلى موضع الإقلاع'); syncBtns();
}
function landed(why) {
  D.armed = false; D.mode = 'idle'; D.vx = D.vy = D.vz = 0; msg(why); syncBtns(); if (snd) snd.trigger('land');
}
let lastLim = -9, lastHit = -9;
function update(dt) {
  D.t += dt;
  const u = inp(), MV = maxV(), g0 = surf(D.x, D.z) + 0.12;
  let tf = 0, ts = 0, tc = 0, ty = 0;
  if (D.armed) {
    if (D.mode === 'fly') { tf = u.f * MV; ts = u.s * MV; tc = u.c * MAXC; ty = u.y * 1.6; }
    else if (D.mode === 'takeoff') { tc = 1.8; if (D.y - g0 > 3) D.mode = 'fly'; }
    else if (D.mode === 'land') { tc = -(D.y - g0 > 3 ? 1.6 : 0.6); tf = u.f * 3; ts = u.s * 3; ty = u.y * 1.6; }
    else if (D.mode === 'rth') {
      if (Math.abs(u.f) + Math.abs(u.s) + Math.abs(u.c) + Math.abs(u.y) > 0.3) { D.mode = 'fly'; msg('أُلغيت العودة'); }
      else {
        const dx = D.home.x - D.x, dz = D.home.z - D.z, dist = Math.hypot(dx, dz), want = Math.atan2(dx, -dz), top = D.home.y + DC.rthH;
        if (D.ph === 0) { tc = clamp((top - D.y) * 0.8, -2, MAXC); if (D.y >= top - 1) D.ph = 1; }
        if (D.ph === 1) {
          const e = Math.atan2(Math.sin(want - D.yaw), Math.cos(want - D.yaw));
          ty = clamp(e * 1.5, -1.6, 1.6); tf = Math.abs(e) < 0.5 ? clamp(dist * 0.4, 0, MV) : 0; tc = clamp((top - D.y) * 0.5, -2, 2);
          if (dist < 1.5) D.ph = 2;
        }
        if (D.ph === 2) { D.mode = 'land'; msg('وصل — هبوط'); syncBtns(); }
      }
    }
  }
  const f = { x: Math.sin(D.yaw), z: -Math.cos(D.yaw) }, r = { x: Math.cos(D.yaw), z: Math.sin(D.yaw) };
  const k = 1 - Math.exp(-dt / 0.45), kc = 1 - Math.exp(-dt / 0.3), ky = 1 - Math.exp(-dt / 0.2);
  D.vx += (f.x * tf + r.x * ts - D.vx) * k; D.vz += (f.z * tf + r.z * ts - D.vz) * k; D.vy += (tc - D.vy) * kc; D.yr += (ty - D.yr) * ky;
  D.yaw += D.yr * dt; D.x += D.vx * dt; D.y += D.vy * dt; D.z += D.vz * dt;
  const hx = D.x - D.home.x, hz = D.z - D.home.z, hd = Math.hypot(hx, hz);
  if (hd > DC.maxR) { D.x = D.home.x + hx / hd * DC.maxR; D.z = D.home.z + hz / hd * DC.maxR; D.vx *= 0.5; D.vz *= 0.5; if (D.t - lastLim > 4) { lastLim = D.t; msg('⚠ حدّ المدى ' + DC.maxR + ' م'); } }
  if (D.y > D.home.y + DC.maxH) { D.y = D.home.y + DC.maxH; if (D.vy > 0) D.vy = 0; }
  const hc = houseCollide(D.x, D.y, D.z, 0.9);                       // لا يخترق المباني
  if (hc) {
    D.x = hc.x; D.y = hc.y; D.z = hc.z;
    const dn = D.vx * hc.nx + D.vy * hc.ny + D.vz * hc.nz;
    if (dn < 0) { D.vx -= dn * hc.nx; D.vy -= dn * hc.ny; D.vz -= dn * hc.nz; }
    if (D.armed && D.mode === 'land' && hc.ny > 0.5) landed('✓ حطّ الدرون على سطح مبنى');
    else if (D.t - lastHit > 3) { lastHit = D.t; msg('🏠 مبنى أمامك — لا يمكن اختراقه'); }
  }
  const sf = surf(D.x, D.z), g1 = sf + 0.12;
  if (D.y < g1) { D.y = g1; if (D.vy < 0) D.vy = 0; }
  D.agl = D.y - sf;
  const grounded = D.y - g1 < 0.05;
  if (D.mode === 'land' && grounded && D.armed) landed('✓ هبط الدرون');
  D.spd = Math.hypot(D.vx, D.vz);
  if (D.armed && DC.battery) {                                          // بطارية: تتأثر بالحمولة والسرعة والصعود
    const endur = 24 * 60 * (1 - 0.2 * mass());
    D.bat = Math.max(0, D.bat - dt * 100 / endur * (0.8 + 0.6 * D.spd / MV + 0.5 * Math.max(0, D.vy) / MAXC));
    if (D.bat < 20 && !D.low) { D.low = true; msg('🔋 بطارية ضعيفة — عودة تلقائية'); if (D.mode === 'fly' || D.mode === 'takeoff') goHome(); }
    if (D.bat <= 5 && D.mode !== 'land') { D.mode = 'land'; msg('🔋 البطارية منتهية — هبوط اضطراري'); syncBtns(); }
  }
  D.coll = !D.armed ? 0 : (grounded && tc <= 0.05 ? 0.14 : clamp(hov() + D.vy / MAXC * 0.22 + D.spd / MV * 0.07 + (grounded ? 0.1 : 0), 0.14, 1));
  const rf = D.armed ? clamp(D.coll * 1.4, 0.25, 1) : 0; D.spin += dt * rf * 90;
  rotors.forEach(q => { q.bl.rotation.y = D.spin * q.dir; q.disc.material.opacity = rf * 0.28; });
  const vf = D.vx * f.x + D.vz * f.z, vs = D.vx * r.x + D.vz * r.z;
  model.position.set(D.x, D.y + 0.1, D.z); model.rotation.set(-0.3 * vf / MV, -D.yaw, -0.3 * vs / MV, 'YXZ');
  soundUpdate(dt, u);
}
function mini() {
  const c = $('#dMini'); if (!c) return;
  const x = c.getContext('2d'), S = 112, R = 50, k = R / 250;
  x.clearRect(0, 0, S, S); x.fillStyle = 'rgba(8,14,20,.72)'; x.beginPath(); x.arc(S / 2, S / 2, S / 2 - 1, 0, 7); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.22)'; x.lineWidth = 1; [R / 3, R * 2 / 3, R].forEach(q => { x.beginPath(); x.arc(S / 2, S / 2, q, 0, 7); x.stroke(); });
  const pt = (wx, wz) => { let dx = (wx - D.x) * k, dz = (wz - D.z) * k; const L = Math.hypot(dx, dz), e = L > R; if (e) { dx *= R / L; dz *= R / L; } return [S / 2 + dx, S / 2 + dz, e]; };
  const job = N().job && N().job();
  if (job) {
    job.points.forEach(p => { const [a, b, e] = pt(p.x, p.z); x.globalAlpha = e ? 0.45 : 1; x.fillStyle = p.bm ? '#2ea043' : '#e8402a'; x.beginPath(); x.arc(a, b, 3, 0, 7); x.fill(); });
    job.setups.forEach(s => { const [a, b, e] = pt(s.x, s.z); x.globalAlpha = e ? 0.45 : 1; x.fillStyle = '#4dabf7'; x.fillRect(a - 3, b - 3, 6, 6); });
    x.globalAlpha = 1;
  }
  const [hx, hy] = pt(D.home.x, D.home.z); x.strokeStyle = '#fff'; x.strokeRect(hx - 4, hy - 4, 8, 8);
  x.save(); x.translate(S / 2, S / 2); x.rotate(D.yaw); x.fillStyle = '#ffd43b'; x.beginPath(); x.moveTo(0, -7); x.lineTo(5, 6); x.lineTo(-5, 6); x.closePath(); x.fill(); x.restore();
  x.fillStyle = '#fff'; x.font = '10px sans-serif'; x.fillText('N', S / 2 - 3, 11);
}
const MODE = { idle: 'على الأرض', takeoff: 'إقلاع', fly: 'طيران', land: 'هبوط', rth: 'عودة تلقائية' };
let hudT = 0, _lt = 0;
export function droneRender() {
  const now = performance.now(), dt = Math.min(0.05, _lt ? (now - _lt) / 1000 : 0.016); _lt = now;
  update(dt);
  const W = innerWidth, H = innerHeight;
  fcam.position.set(D.x, D.y + 0.15, D.z); fcam.rotation.set(D.gim, -D.yaw, 0, 'YXZ');
  renderer.setRenderTarget(null); renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H);
  let tagCam = fcam, rect = { l: 0, t: 0, w: W, h: H };
  if (D.cam === 'fpv') {
    fcam.aspect = W / H; fcam.updateProjectionMatrix(); model.visible = false; renderer.render(scene, fcam);
  } else {
    const gx = instPos.x, gz = instPos.z, gy = groundH(gx, gz) + 1.7;
    gcam.position.set(gx, gy, gz); gcam.lookAt(D.x, D.y, D.z); gcam.aspect = W / H;
    gcam.fov = clamp(2 * Math.atan(6 / Math.max(1, Math.hypot(D.x - gx, D.y - gy, D.z - gz))) / DEG, 6, 60); gcam.updateProjectionMatrix();
    model.visible = true; renderer.render(scene, gcam); tagCam = gcam;
    if (D.cam === 'ctrl') {                                              // شاشة جهاز التحكم: بث كاميرا الدرون
      const e = $('#dScr'), r = e ? e.getBoundingClientRect() : null;
      if (r && r.width > 20) {
        renderer.setScissorTest(true); renderer.setScissor(r.left, H - r.bottom, r.width, r.height); renderer.setViewport(r.left, H - r.bottom, r.width, r.height);
        fcam.aspect = r.width / r.height; fcam.updateProjectionMatrix(); model.visible = false; renderer.render(scene, fcam);
        renderer.setScissorTest(false); renderer.setViewport(0, 0, W, H); tagCam = fcam; rect = { l: r.left, t: r.top, w: r.width, h: r.height };
      }
    }
  }
  projTags(tagCam, rect); mini();
  hudT += dt;
  if (hudT > 0.1) {
    hudT = 0;
    const hd = ((D.yaw / DEG) % 360 + 360) % 360, dh = Math.hypot(D.x - instPos.x, D.z - instPos.z);
    const el = $('#dHud'), tg = $('#dTag');
    if (el) el.textContent = `${MODE[D.mode] || ''}${snd ? (snd.mode === 'worklet' ? ' 🔊' : ' 🔊~') : ''} · 🔋 ${D.bat.toFixed(0)}%\nارتفاع ${D.agl.toFixed(1)} م · سرعة ${(D.spd * 3.6).toFixed(0)} كم/س\nبُعد ${dh.toFixed(0)} م · اتجاه ${hd.toFixed(0)}° · كاميرا ${Math.round(D.gim / DEG)}°`;
    if (tg) tg.textContent = '● FPV' + (DC.payload !== 'none' ? ' · ' + (PAY[DC.payload] || PAY.none).label : '');
  }
}
export function openDrone() {
  if (D.on) return;
  ui();
  const mb = $('#mapBox'); if (mb) mb.style.display = 'none';
  const ih = I.st.heading || 0; let x = instPos.x + Math.sin(ih) * 2.5, z = instPos.z - Math.cos(ih) * 2.5;
  if (isWater(x, z) || houseCollide(x, groundH(x, z) + 0.5, z, 1.5)) { x = instPos.x; z = instPos.z; }
  Object.assign(D, { on: true, armed: false, mode: 'idle', ph: 0, x, z, yaw: ih, yr: 0, vx: 0, vy: 0, vz: 0, gim: -12 * DEG, coll: 0, head: ih });
  D.y = surf(x, z) + 0.12; D.home = { x, y: D.y, z };
  buildBeacons(); document.body.classList.add('droneOn'); bea.visible = D.tags;
  $('#dGv').textContent = '-12°'; setView(DC.view || 'ctrl'); syncBtns();
  msg('اضغط ⏏ إقلاع · اليمين = حركة، اليسار = ارتفاع/دوران (أو WASD / QE / RF) · ⚙️ إعدادات الصوت والحمولة', 6000);
}
export function exitDrone() {
  if (!D.on) return;
  if (D.armed) log('land');
  D.on = false; D.armed = false; D.mode = 'idle'; KB.clear(); PD.f = PD.s = PD.c = PD.y = 0;
  model.visible = false; bea.visible = false; document.body.classList.remove('droneOn', 'dCtrl');
  tags.forEach(t => { t.el.style.display = 'none'; });
  const p = $('#dCfg'); if (p) p.style.display = 'none';
  if (snd) { try { snd.dispose(); } catch (_) {} snd = null; }
}
(function () {
  const b = document.createElement('button'); b.id = 'btnDrone'; b.className = 'zap'; b.textContent = '🚁 درون'; b.onclick = openDrone;
  ($('#top') || document.body).appendChild(b);
})();
Object.assign(window.NIVO || (window.NIVO = {}), { droneActive: () => D.on, droneRender, openDrone, exitDrone, drone: { pos: () => (D.on && D.armed ? { x: D.x, y: D.y, z: D.z } : null), state: () => D } });
