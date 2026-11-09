import { renderer, scene, holder, instPos, sendTo, placeHolderAt, faceInstrument, updateHolder, groundH, setStaffStyle, setQuality, regen, mapImage, setMarkers, setVegDensity, isWater, inHouse, wetness, riverPath, houseList, bridgeList } from './world.js';
import * as I from './instrument.js';
import { setTarget, setPrismHeight, getPrismHeight, setStaffZero } from './targets.js';
import { $, $$, clamp, V3, DEG, TAU, wrapPi, cap, numOrNull, dms, showErr, toast, openTab, setTxt, setCl, say } from './util.js';
import { CFG, saveCfg, ST, flags } from './state.js';
import { renderSteps } from './steps.js';
import { saveState, loadSaved, randomJob, crd, ptById, setupById, nextId, trueRL, nextSetup } from './job.js';
import { fbRender, fbRefresh } from './books-level.js';
import { ttRender, ttRefresh, updK } from './books-tt.js';
import { cam, cv, elSheet, scopeEl, lblBox, fx, sideLayout, mapBox, mapOpen, isTT, scopeCam, FOV, eyeIdeal, jogT, elT1, elLegs } from './ctx.js';
import { sightInfo, _t } from './sight.js';
import { LC, drawLevel, drawHead } from './leveling.js';
import './tabs.js';


// ================= الكاميرا الخارجية =================
const orb = { az: 0.7, el: 0.28, dist: 5.2, tDist: 5.2, t: new V3(0, 1, 0), tt: new V3(0, 1, 0), mode: 'tripod', part: null };
const DIST = () => {
  const g = holder.group.position, rp = I.rigPos;
  return { all: clamp(1.4 * Math.hypot(rp.x - g.x, rp.z - g.z), 25, 160), tripod: 5.2, inst: I.st.exTarget ? 2.8 : 1.3, staff: 8 };
};
function setMode(m, d) {
  orb.mode = m; if (d) orb.tDist = d;
  $$('[data-cam]').forEach(b => b.classList.toggle('on', b.dataset.cam === m));
  if (ST.scopeFull) toggleFull(false);
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
function snapCam() { camTargets(); orb.t.copy(orb.tt); orb.dist = orb.tDist; }
function updCam(dt) {
  camTargets();
  const k = 1 - Math.pow(0.003, dt);
  orb.t.lerp(orb.tt, k); orb.dist += (orb.tDist - orb.dist) * k;
  const d = orb.dist, ce = Math.cos(orb.el);
  cam.position.set(orb.t.x + d * ce * Math.sin(orb.az), orb.t.y + d * Math.sin(orb.el), orb.t.z + d * ce * Math.cos(orb.az));
  cam.lookAt(orb.t);
}

const ptrs = new Map(); let pinch0 = 0;
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
cv.addEventListener('pointerup', pUp); cv.addEventListener('pointercancel', pUp);
cv.addEventListener('wheel', e => { orb.tDist = clamp(orb.tDist * (1 + Math.sign(e.deltaY) * 0.1), 0.4, 200); e.preventDefault(); }, { passive: false });


// ================= التركيب والأرجل =================
$$('.lk').forEach(b => (b.style.borderColor = LC[+b.dataset.lk]));
function updLegLabels() {
  $$('.lk').forEach(b => { const i = +b.dataset.lk, l = I.st.legLock[i]; b.textContent = (l ? '🔒 ' : '🔓 ') + (i + 1); b.classList.toggle('on', l); });
  $$('.lgv').forEach(b => (b.textContent = (I.st.leg[+b.dataset.lv] * 1000).toFixed(1) + ' مم'));
}
function syncLegUI() {
  $('#hSl').value = I.st.H; $('#hVal').textContent = I.st.H.toFixed(2) + ' م';
  $$('.lg').forEach(s => (s.value = I.st.leg[+s.dataset.lg] * 1000));
  updLegLabels();
}
function updClampUI() {
  $('#btnClamp').textContent = I.st.clamp ? '🔒 المثبّت: مربوط' : '🔓 المثبّت: محرَّر'; $('#btnClamp').classList.toggle('on', I.st.clamp);
  $('#btnClampV').textContent = I.st.clampV ? '🔒 رأسي' : '🔓 رأسي'; $('#btnClampV').classList.toggle('on', I.st.clampV);
  I.setClamp(I.st.clamp);
}
function afterChange() {
  syncLegUI(); updClampUI();
  scopeEl.style.display = I.st.mounted ? 'block' : 'none';
  $('#btnMountOnly').style.display = I.st.mounted ? 'none' : '';
}
function doMount() { if (I.st.mounted) return; I.mount(); afterChange(); toast('تم تركيب الجهاز. اضبط الأرجل ثم سوِّ البراغي'); }
$('#btnMountOnly').onclick = doMount;
$('#btnMount').onclick = () => { I.quickMount(); afterChange(); toast('تركيب فوري: الحامل بالارتفاع المناسب مربوط والجهاز مثبّت'); };
$('#btnLevelNow').onclick = () => { I.quickLevel(); afterChange(); toast('موازنة فورية ✓'); };

$$('.lk').forEach(b => (b.onclick = () => { const i = +b.dataset.lk; I.setLegLock(i, !I.st.legLock[i]); updLegLabels(); }));
$$('.lg').forEach(s => (s.oninput = () => {
  const i = +s.dataset.lg;
  if (I.st.legLock[i]) { toast('حرّر بزال الساق ' + (i + 1) + ' أولاً'); s.value = I.st.leg[i] * 1000; return; }
  I.setLeg(i, +s.value / 1000); updLegLabels();
}));
$('#hSl').oninput = e => {
  if (I.st.legLock.some(Boolean)) { toast('حرّر بزال الأرجل الثلاثة أولاً'); e.target.value = I.st.H; return; }
  I.setHeight(+e.target.value); $('#hVal').textContent = I.st.H.toFixed(2) + ' م';
};
$('#btnLegsLock').onclick = () => { const all = I.st.legLock.every(Boolean); [0, 1, 2].forEach(i => I.setLegLock(i, !all)); updLegLabels(); };
$('#btnLegsLevel').onclick = () => { I.levelLegsNow(); syncLegUI(); toast('تمت موازنة الأرجل'); };
$('#btnFine').onclick = () => { ST.fine = !ST.fine; $('#btnFine').textContent = '🎯 ضبط دقيق: ' + (ST.fine ? 'تشغيل' : 'إيقاف'); $('#btnFine').classList.toggle('on', ST.fine); };

$('#btnExplode').onclick = () => {
  if (!I.st.mounted) doMount();
  const on = I.st.exTarget < 0.5;
  I.setExplode(on); $('#btnExplode').classList.toggle('on', on);
  setMode('inst', on ? 2.8 : 1.3);
  if (on) openTab('t4');
};

// ================= نوع الجهاز =================
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
function applyInstType(t, quiet) {
  CFG.inst = t; saveCfg(); I.setType(t); applyErr(); document.body.dataset.inst = t;
  $('#cfgInst').value = t; $('#btnInst').textContent = '🔧 ' + I.TY().name;
  fx.setMode(t === 'ts' ? 2 : t === 'tach' ? 1 : 0); setTarget(t === 'ts' ? 'prism' : 'staff');
  buildPartLabels(); flags.read = flags.dist = flags.two = flags.orient = flags.face2 = false; ST.stepKey = ''; ST.lastMeas = '';
  const act = $('#tabs button.on'); if (act && act.offsetParent === null) openTab('t1');
  if (!quiet) placeInstrument(ST.job.setups[ST.job.cur] || { id: 'S1', x: 0, z: 0 }, true);
  ttRender(); fbRender();
  if (!quiet) toast('الجهاز: ' + I.TY().name);
}
$('#btnInst').onclick = () => { const o = ['level', 'theo', 'tach', 'ts']; applyInstType(o[(o.indexOf(I.type) + 1) % 4]); };

// ================= نقل الجهاز / عالم جديد =================
function placeInstrument(s, quiet) {
  I.setRig(s.x, s.z); instPos.x = s.x; instPos.z = s.z;
  I.reset(CFG.legs, CFG.state); faceInstrument(); afterChange();
  flags.orient = false; ST.lastMeas = ''; ST.stepKey = '';
  const tri = CFG.state === 'off';
  setMode(tri ? 'tripod' : 'inst', tri ? 5.2 : 1.3); snapCam();
  if (!quiet) toast('نُقل الجهاز إلى ' + s.id + ' — أعد ضبطه');
}

function onJobChanged() {
  setMarkers(ST.job.points, ST.job.setups);
  renderPtBtns(); renderMapList(); drawMap(); fbRender(); ttRender(); saveState();
}

function newWorld(sd) {
  $('#loading').style.display = 'flex';
  setTimeout(() => {
    try { doNewWorld(sd); } catch (e) { showErr('world: ' + e.message); }
    $('#loading').style.display = 'none';
  }, 40);
}
function doNewWorld(sd) {
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
  applyInstType(CFG.inst, true);
  afterChange(); onJobChanged();
  const tri = CFG.state === 'off';
  setMode(tri ? 'tripod' : 'inst', tri ? 5.2 : 1.3); snapCam();
  toast('🌱 بذرة العالم: ' + sd);
}
const randSeed = () => Math.floor(Math.random() * 899999) + 100000;

function newJob() {
  ST.job = randomJob(randSeed()); ST.rows = []; ST.rowsT = [];
  placeInstrument(ST.job.setups[0], true);
  const first = ST.job.points.find(p => p.bm) || ST.job.points[0];
  if (first) placeHolderAt(first);
  onJobChanged(); toast('مهمة جديدة على نفس العالم');
}

// ================= الخريطة =================
const HALF = 500, MZ = 500 / 120, mapC = $('#mapC'), mctx = mapC.getContext('2d');
let mapTool = 'pt', MS = 480;
const w2m = (x, z) => [(x + HALF) / (2 * HALF) * MS, (z + HALF) / (2 * HALF) * MS];
function sizeMap() {
  const d = Math.min(devicePixelRatio || 1, 2);
  MS = Math.floor(sideLayout() ? Math.min(innerWidth * 0.55, innerHeight * 0.78, 680) : Math.min(innerWidth * 0.94, innerHeight * 0.55, 560));
  mapC.style.width = MS + 'px'; mapC.style.height = MS + 'px'; mapC.width = MS * d; mapC.height = MS * d; mctx.setTransform(d, 0, 0, d, 0, 0);
}
function openMap() { mapBox.style.display = 'block'; sizeMap(); drawMap(); renderMapList(); }
function closeMap() { mapBox.style.display = 'none'; }
$('#btnMap').onclick = openMap; $('#mapClose').onclick = closeMap;
$('#btnMoveInst').onclick = () => { mapTool = 'inst'; $$('[data-mt]').forEach(b => b.classList.toggle('on', b.dataset.mt === mapTool)); openMap(); };
$$('[data-mt]').forEach(b => (b.onclick = () => { mapTool = b.dataset.mt; $$('[data-mt]').forEach(x => x.classList.toggle('on', x === b)); }));
$('#btnJobRnd').onclick = newJob;
$('#btnWorldRnd').onclick = () => newWorld(randSeed());

// ================= الخريطة: المعالم وتحريك النقاط وتثبيتها =================
// NIVO-V8
function drawMap() {
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
function reach(p) {
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

// ---- سحب النقاط (أداة التحريك) ----
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
mapC.addEventListener('pointerup', endDrag); mapC.addEventListener('pointercancel', endDrag);

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

// ================= الإعدادات (واجهة) =================
$('#cfgInst').value = CFG.inst; $('#cfgLegs').value = CFG.legs; $('#cfgState').value = CFG.state;
$('#cfgPat').value = CFG.pat; $('#cfgLab').value = CFG.lab; $('#cfgQ').value = CFG.q; $('#cfgUI').value = CFG.ui;
$('#cfgFix').checked = !!CFG.fix; $('#cfgManual').checked = !!CFG.manual; $('#cfgExam').checked = !!CFG.exam;
$('#cfgInst').onchange = e => applyInstType(e.target.value);
$('#cfgLegs').onchange = e => { CFG.legs = e.target.value; saveCfg(); };
$('#cfgState').onchange = e => { CFG.state = e.target.value; saveCfg(); };
$('#cfgPat').onchange = e => { CFG.pat = e.target.value; saveCfg(); setStaffStyle(CFG.pat, CFG.lab); };
$('#cfgLab').onchange = e => { CFG.lab = e.target.value; saveCfg(); setStaffStyle(CFG.pat, CFG.lab); };
$('#cfgQ').onchange = e => { CFG.q = e.target.value; saveCfg(); setQuality(+CFG.q); resize(); };
$('#cfgUI').onchange = e => { CFG.ui = e.target.value; saveCfg(); document.documentElement.style.setProperty('--k', CFG.ui); };
$('#cfgFix').onchange = e => { CFG.fix = e.target.checked; saveCfg(); };
$('#cfgManual').onchange = e => { CFG.manual = e.target.checked; saveCfg(); fbRender(); };
$('#cfgExam').onchange = e => { CFG.exam = e.target.checked; saveCfg(); fbRender(); ttRender(); };
$('#btnSeedApply').onclick = () => { const v = Math.floor(+$('#cfgSeed').value); if (!(v > 0)) return toast('اكتب رقماً صحيحاً أكبر من 0'); newWorld(v); };
$('#btnSeedRnd').onclick = () => newWorld(randSeed());
$('#btnRestart').onclick = () => { placeInstrument(ST.job.setups[ST.job.cur] || { x: 0, z: 0, id: 'S1' }, true); toast('تمت إعادة ضبط الجهاز'); };
$('#btnLegsLevel2').onclick = $('#btnLegsLevel').onclick;
$('#btnScrewsNow').onclick = () => { if (!I.st.mounted) doMount(); I.levelScrewsNow(); toast('تمت موازنة البراغي'); };

// ---- أخطاء الجهاز ----
$('#cfgErr').checked = !!CFG.err; $('#cfgErrK').value = String(CFG.errK);
const applyErr = () => { I.setErrors(CFG.err, +CFG.errK, ST.seed); setStaffZero(I.staffZero()); };
$('#cfgErr').onchange = e => { CFG.err = e.target.checked; saveCfg(); applyErr(); ttRefresh(); toast(CFG.err ? 'أخطاء الجهاز: تشغيل' : 'أخطاء الجهاز: إيقاف'); };
$('#cfgErrK').onchange = e => { CFG.errK = +e.target.value; saveCfg(); applyErr(); toast('حجم الأخطاء ×' + CFG.errK); };
$('#btnErrShow').onclick = () => { $('#errInfo').textContent = I.errReport().join('\n'); };

$('#cfgVeg').value = String(CFG.veg);
$('#cfgVeg').onchange = e => { CFG.veg = +e.target.value; saveCfg(); setVegDensity(CFG.veg); newWorld(ST.seed); toast('كثافة الأشجار: ' + e.target.selectedOptions[0].text); };

async function lanRefresh(tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const j = await (await fetch('/api/lan', { cache: 'no-store' })).json(); showLan(j); return; }
    catch (e) { await new Promise(r => setTimeout(r, 500)); }
  }
}
function showLan(j) {
  const b = $('#btnLan');
  b.textContent = j.on ? '🟢 مفعّلة — اضغط للإيقاف' : '⚪ معطّلة — اضغط للتفعيل';
  b.classList.toggle('on', j.on); b.disabled = !j.canToggle;
  let t = '';
  if (j.on) t = (j.urls.length ? j.urls.join('\n') : `اكتب عنوان IP جهازك (من إعدادات الواي فاي) ثم :${j.port}`) + '\n⚠ أي جهاز على نفس الشبكة يقدر يفتحها. فعّلها على شبكة تثق بها.';
  else if (!j.canToggle) t = 'التبديل متاح فقط من الجهاز الذي يشغّل السيرفر.';
  $('#lanInfo').textContent = t;
}
$('#btnLan').onclick = async () => {
  const on = !$('#btnLan').classList.contains('on');
  try { await fetch('/api/lan?on=' + (on ? 1 : 0), { cache: 'no-store' }); } catch (e) { /* قد ينقطع الاتصال لحظياً */ }
  setTimeout(() => lanRefresh(6), 700);
};


// ================= التوجيه (دوران أفقي لا نهائي + رأسي) =================
function setHeading(r) { if (Number.isFinite(r)) I.st.heading = ((r % TAU) + TAU) % TAU; }
function setVz(r) { if (Number.isFinite(r)) I.st.vz = ((r % TAU) + TAU) % TAU; }
const bearingToStaff = () => { const p = holder.group.position; return Math.atan2(p.x - instPos.x, -(p.z - instPos.z)); };
$('#btnClamp').onclick = () => { if (!I.st.mounted) return toast('ركّب الجهاز أولاً'); I.st.clamp = !I.st.clamp; updClampUI(); };
$('#btnClampV').onclick = () => { if (!I.st.mounted) return toast('ركّب الجهاز أولاً'); I.st.clampV = !I.st.clampV; updClampUI(); };

const jog = $('#jog'); let jd = null;
jog.addEventListener('pointerdown', e => { if (!I.st.mounted) return toast('ركّب الجهاز أولاً'); jd = { x: e.clientX }; cap(jog, e.pointerId); });
jog.addEventListener('pointermove', e => {
  if (!jd) return;
  const dx = e.clientX - jd.x; jd.x = e.clientX;
  if (I.st.clamp) { if (Math.abs(dx) > 4) toast('حرّر المثبّت أولاً (أو استعمل الحركة البطيئة)'); return; }
  setHeading(I.st.heading - dx * 0.5 * DEG);
});
const jEnd = () => (jd = null); jog.addEventListener('pointerup', jEnd); jog.addEventListener('pointercancel', jEnd);
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
const sdEnd = () => (sd = null); scopeEl.addEventListener('pointerup', sdEnd); scopeEl.addEventListener('pointercancel', sdEnd);

// ---- أدوات التيودوليت والتاكيومتر ----
$('#btn0Set').onclick = () => { if (!I.st.mounted) return toast('ركّب الجهاز أولاً'); I.st.hz0 = I.st.heading; toast('Hz = 0°00′00″'); };
$('#btnPlunge').onclick = () => {
  if (!I.st.mounted) return toast('ركّب الجهاز أولاً');
  if (I.st.clamp || I.st.clampV) return toast('حرّر المثبّتين (الأفقي والرأسي) أولاً');
  setHeading(I.st.heading + Math.PI); setVz(TAU - I.st.vz);
  toast('قُلب المنظار: الوجه ' + (I.st.vz < Math.PI ? 'I' : 'II'));
};
$('#btnHI').onclick = () => {
  if (!I.st.mounted) return toast('ركّب الجهاز أولاً');
  const hi = scopeCam.position.y - I.rigPos.y;
  $('#inHI').value = (Math.round((hi + (Math.random() - 0.5) * 0.004) * 1000) / 1000).toFixed(3);
  toast('ارتفاع الجهاز المقاس i = ' + $('#inHI').value + ' م (بالشريط)');
};
$('#inHr').oninput = e => { const v = numOrNull(e.target.value); if (v !== null) setPrismHeight(v); };


// NIVO-V5 — تيودوليت رقمي + تاكيومتر يدوي ذاتي الاختزال (قوانين المقرر) + تاكيومتر آلي


// ---- نافذة قراءة الدوائر (ميكروسكوب بمقياس دقائق) وكمانة الفهرس ----
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
function drawReadWin() {
  const rd = I.readings();
  rwc.fillStyle = '#161616'; rwc.fillRect(0, 0, 340, 124);
  drawStrip(rwc, 6, 'Hz', rd.hz); drawStrip(rwc, 68, 'V', rd.v);
}
function drawIdx() {
  const c = ixc, b = I.indexBubble(), k = 23;
  c.clearRect(0, 0, 340, 56); c.fillStyle = '#0d2a22'; c.fillRect(30, 12, 280, 32); c.strokeStyle = '#5fd6b0'; c.lineWidth = 2; c.strokeRect(30, 12, 280, 32);
  for (let t = -6; t <= 6; t++) { c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(170 + t * k, 12); c.lineTo(170 + t * k, 20); c.stroke(); }
  c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(170 - 0.5 * k, 12); c.lineTo(170 - 0.5 * k, 44); c.moveTo(170 + 0.5 * k, 12); c.lineTo(170 + 0.5 * k, 44); c.stroke();
  c.fillStyle = 'rgba(190,255,225,.9)'; c.beginPath(); c.ellipse(clamp(170 + b * k, 56, 284), 28, 26, 12, 0, 0, 7); c.fill();
}
$$('[data-ix]').forEach(b => (b.onclick = () => { if (!I.st.mounted) return toast('ركّب الجهاز أولاً'); I.nudgeIdx(+b.dataset.ix); }));
addEventListener('nivo-custom', () => buildPartLabels());

// ================= التسميات في العرض التفكيكي =================
const _lv = new V3();
function updLabels() {
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

// ================= الإطار =================
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

function step(dt) {
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

function render() {
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

function resize() { renderer.setSize(innerWidth, innerHeight, false); if (mapOpen()) { sizeMap(); drawMap(); } }
addEventListener('resize', resize); resize();

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
