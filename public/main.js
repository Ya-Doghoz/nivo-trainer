import * as THREE from 'three';
import { renderer, scene, holder, instPos, sendTo, placeHolderAt, faceInstrument, updateHolder, groundH, setStaffStyle, setQuality, regen, mapImage, setMarkers, mulberry32, setVegDensity, isWater, inHouse, wetness, riverPath, houseList, bridgeInfo, bridgeList, dryNear, riverInfo } from './world.js';
import * as I from './instrument.js';
import * as SM from './survey-math.js';
import { createScopeFX } from './scopefx.js';
import { prismFace, setTarget, setPrismHeight, getPrismHeight, setStaffZero } from './targets.js';
import { $, $$, clamp, V3, DEG, TAU, wrapPi, cap, numOrNull, f3, dms, showErr, toast, openTab, setTxt, setCl } from './util.js';
import { CFG, saveCfg, ST } from './state.js';

const FOV = 1.2;


// ================= الإعدادات =================

const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 3600);
const scopeCam = new THREE.PerspectiveCamera(FOV, 1, 1, 400);
const cv = $('#c'), scopeEl = $('#scope'), fx = createScopeFX(renderer);
const elSheet = $('#sheet'), elT1 = $('#t1'), elLegs = $('#legsBox'), jogT = $('#jogT'), mapBox = $('#mapBox'), lblBox = $('#labels');
const mqSide = matchMedia('(min-width:760px) and (min-aspect-ratio:5/4)');
const sideLayout = () => mqSide.matches;
const isTT = () => I.type !== 'level';
const eyeIdeal = 0.3 + Math.random() * 0.4;
const mapOpen = () => mapBox.style.display === 'block';


// ================= المهمة (Job) والحالة =================
const ptById = id => ST.job.points.find(p => p.id === id);
const setupById = id => ST.job.setups.find(s => s.id === id);
const trueRL = p => { const bm = ST.job.points.find(q => q.bm && q.elev != null); return bm ? bm.elev + groundH(p.x, p.z) - groundH(bm.x, bm.z) : null; };
const zOf = p => { const t = trueRL(p); return t === null ? 0 : t; };
const crd = (x, z) => ({ E: (ST.job.E0 ?? 1000) + x, N: (ST.job.N0 ?? 1000) - z });
const nextId = pre => { let n = 1; while (ST.job.points.some(p => p.id === pre + n)) n++; return pre + n; };
const nextSetup = () => { let n = 1; while (ST.job.setups.some(s => s.id === 'S' + n)) n++; return 'S' + n; };
const saveState = () => { try { localStorage.setItem('nivoState', JSON.stringify({ seed: ST.seed, job: ST.job, rows: ST.rows, rowsT: ST.rowsT })); } catch (e) { /* تجاهل */ } };
const loadSaved = sd => { try { const j = JSON.parse(localStorage.getItem('nivoState') || 'null'); return j && j.seed === sd && j.job && j.job.points ? j : null; } catch (e) { return null; } };

function randomJob(sd) {
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

// ================= التبويبات =================
$$('#tabs [data-t]').forEach(b => (b.onclick = () => {
  $$('#tabs [data-t]').forEach(x => x.classList.toggle('on', x === b));
  $$('#panels section').forEach(s => s.classList.toggle('on', s.id === b.dataset.t));
  elSheet.classList.remove('min');
}));
$('#sheetToggle').onclick = () => elSheet.classList.toggle('min');

// ================= التركيب والأرجل =================
const LC = ['#ff6b6b', '#51cf66', '#4dabf7'];
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

// ================= التسوية (لوحة البراغي) =================
const lv = $('#lv'), lc = lv.getContext('2d'), LS = 300;
const KN = [{ x: 59, y: 202 }, { x: 241, y: 202 }, { x: 150, y: 45 }], NAMES = ['A', 'B', 'C'];
(function () { const d = Math.min(devicePixelRatio || 1, 2); lv.width = LS * d; lv.height = LS * d; lc.setTransform(d, 0, 0, d, 0, 0); })();

function drawLevel() {
  const c = lc, T = I.getTilt(), ty = I.TY(), kind = I.type, h = I.st.heading, ax = Math.sin(h), ay = -Math.cos(h);
  c.clearRect(0, 0, LS, LS);
  c.strokeStyle = '#33425a'; c.lineWidth = 4; c.beginPath();
  KN.forEach((k, i) => (i ? c.lineTo(k.x, k.y) : c.moveTo(k.x, k.y))); c.closePath(); c.stroke();
  if (kind === 'theo' || kind === 'tach') {
    const b = (T.gx * Math.cos(h) + T.gz * Math.sin(h)) * 3437.75, half = 75, k = half / ty.vial;
    c.save(); c.translate(150, 150); c.rotate(h);
    c.fillStyle = '#0d2a22'; c.fillRect(-half, -14, 2 * half, 28); c.strokeStyle = '#5fd6b0'; c.lineWidth = 2; c.strokeRect(-half, -14, 2 * half, 28);
    for (let t = -4; t <= 4; t++) { c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(t * k, -14); c.lineTo(t * k, -8); c.stroke(); }
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-ty.ring * k, -14); c.lineTo(-ty.ring * k, 14); c.moveTo(ty.ring * k, -14); c.lineTo(ty.ring * k, 14); c.stroke();
    c.fillStyle = 'rgba(190,255,225,.9)'; c.beginPath(); c.ellipse(clamp(b * k, -half + 16, half - 16), 0, 16, 9, 0, 0, 7); c.fill();
    c.restore();
  } else {
    const k = 70 / (ty.vial / 3437.75);
    c.fillStyle = '#0d2a22'; c.beginPath(); c.arc(150, 150, 70, 0, 7); c.fill();
    c.strokeStyle = '#5fd6b0'; c.lineWidth = 2; c.stroke();
    c.setLineDash([4, 4]); c.strokeStyle = '#e6c84c'; c.beginPath(); c.arc(150, 150, 70 * ty.comp / ty.vial, 0, 7); c.stroke(); c.setLineDash([]);
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(150, 150, 70 * ty.ring / ty.vial, 0, 7); c.stroke();
    c.strokeStyle = 'rgba(255,159,67,.9)'; c.lineWidth = 3; c.beginPath();
    c.moveTo(150 - ax * 66, 150 - ay * 66); c.lineTo(150 + ax * 66, 150 + ay * 66); c.stroke();
    let bx = T.gx * k, by = T.gz * k; const L = Math.hypot(bx, by);
    if (L > 61) { bx *= 61 / L; by *= 61 / L; }
    c.fillStyle = 'rgba(190,255,225,.9)'; c.beginPath(); c.arc(150 + bx, 150 + by, 9, 0, 7); c.fill();
  }
  c.fillStyle = '#ff9f43'; c.beginPath();
  c.moveTo(150 + ax * 80, 150 + ay * 80); c.lineTo(150 + ax * 64 - ay * 7, 150 + ay * 64 + ax * 7); c.lineTo(150 + ax * 64 + ay * 7, 150 + ay * 64 - ax * 7); c.fill();
  KN.forEach((k, i) => {
    c.fillStyle = '#c9ced6'; c.beginPath(); c.arc(k.x, k.y, 30, 0, 7); c.fill();
    c.strokeStyle = '#5b6573'; c.lineWidth = 3; c.stroke();
    const a = I.st.e[i] / I.PITCH * 2 * Math.PI;
    c.strokeStyle = '#d33'; c.lineWidth = 4; c.beginPath();
    c.moveTo(k.x + Math.cos(a) * 17, k.y + Math.sin(a) * 17); c.lineTo(k.x + Math.cos(a) * 28, k.y + Math.sin(a) * 28); c.stroke();
    c.fillStyle = '#2a2f38'; c.beginPath(); c.arc(k.x, k.y, 14, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(NAMES[i], k.x, k.y + 1);
    if (I.st.e[i] <= 0 || I.st.e[i] >= I.EMAX) { c.fillStyle = '#ff7b72'; c.font = '11px sans-serif'; c.fillText('نهاية', k.x, k.y + (i === 2 ? -40 : 42)); }
  });
  c.fillStyle = '#778'; c.font = '11px sans-serif'; c.textAlign = 'center'; c.fillText('شمال ↑', 150, 12);
  if (!I.st.mounted) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, LS, LS); c.fillStyle = '#fff'; c.font = '16px sans-serif'; c.fillText('ركّب الجهاز أولاً', 150, 150); }
}

const hv = $('#hv'), hc = hv.getContext('2d');
(function () { const d = Math.min(devicePixelRatio || 1, 2); hv.width = 180 * d; hv.height = 180 * d; hc.setTransform(d, 0, 0, d, 0, 0); })();
function drawHead() {
  const c = hc, st = I.st, k = 48 / 0.05236;
  c.clearRect(0, 0, 180, 180);
  I.LEGA.forEach((a, i) => {
    const x = 90 + Math.cos(a) * 74, y = 90 + Math.sin(a) * 74;
    c.strokeStyle = '#33425a'; c.lineWidth = 3; c.beginPath(); c.moveTo(90, 90); c.lineTo(x, y); c.stroke();
    c.fillStyle = LC[i]; c.beginPath(); c.arc(x, y, 13, 0, 7); c.fill();
    c.fillStyle = '#000'; c.font = 'bold 14px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(i + 1), x, y + 1);
  });
  c.fillStyle = '#0d2a22'; c.beginPath(); c.arc(90, 90, 48, 0, 7); c.fill();
  c.strokeStyle = '#5fd6b0'; c.lineWidth = 2; c.stroke();
  c.setLineDash([4, 4]); c.strokeStyle = '#e6c84c'; c.beginPath(); c.arc(90, 90, 48 * 1.5 / 3, 0, 7); c.stroke(); c.setLineDash([]);
  c.strokeStyle = '#fff'; c.beginPath(); c.arc(90, 90, 48 * 0.5 / 3, 0, 7); c.stroke();
  let bx = st.tx * k, by = st.tz * k; const L = Math.hypot(bx, by);
  if (L > 40) { bx *= 40 / L; by *= 40 / L; }
  c.fillStyle = 'rgba(190,255,225,.9)'; c.beginPath(); c.arc(90 + bx, 90 + by, 7, 0, 7); c.fill();
}

const drag = new Map();
const lvPos = e => { const r = lv.getBoundingClientRect(), s = LS / (r.width || LS); return { x: (e.clientX - r.left) * s, y: (e.clientY - r.top) * s }; };
lv.addEventListener('pointerdown', e => {
  if (!I.st.mounted) return;
  const p = lvPos(e); let bi = -1, bd = 1e9;
  KN.forEach((k, i) => { const d = Math.hypot(p.x - k.x, p.y - k.y); if (d < bd) { bd = d; bi = i; } });
  if (bd > 50) return;
  cap(lv, e.pointerId);
  drag.set(e.pointerId, { i: bi, a: Math.atan2(p.y - KN[bi].y, p.x - KN[bi].x) });
});
lv.addEventListener('pointermove', e => {
  const d = drag.get(e.pointerId); if (!d) return;
  const p = lvPos(e), a = Math.atan2(p.y - KN[d.i].y, p.x - KN[d.i].x);
  const da = wrapPi(a - d.a); d.a = a;
  if (!Number.isFinite(da)) return;
  if (!I.turnScrew(d.i, da / TAU * (ST.fine ? 0.1 : 1))) toast('وصل البرغي نهاية مداه — أعِد باقي البراغي لمنتصف مداها');
});
const dEnd = e => drag.delete(e.pointerId); lv.addEventListener('pointerup', dEnd); lv.addEventListener('pointercancel', dEnd);
$$('[data-sc]').forEach(b => (b.onclick = () => {
  if (!I.st.mounted) return toast('ركّب الجهاز أولاً');
  const [i, d] = b.dataset.sc.split(',');
  if (!I.turnScrew(+i, +d * (ST.fine ? 1 / 40 : 0.125))) toast('وصل البرغي نهاية مداه');
}));

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

// ================= النظر في الهدف =================
const rc = new THREE.Raycaster(), _o = new V3(), _d = new V3(), _r = new V3(), _p = new V3(), _t = new V3();
function sightInfo() {
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

// ================= الخطوات =================
const flags = { height: false, headLevel: false, legsLock: false, mounted: false, level: false, rough: false, aim: false, eye: false, focus: false, read: false, dist: false, two: false, orient: false, face2: false };
const S_COMMON = [
  ['height', 'اضبط ارتفاع الحامل بمستوى الصدر (1.30 – 1.60 م)', 'حرّر بزال الأرجل (🔓) ثم حرّك مزلاج «ارتفاع الحامل» حتى يصبح رأس الحامل بمستوى الصدر.'],
  ['headLevel', 'سوِّ رأس الحامل تقريباً بأطوال الأرجل (ميلان ≤ 0.5°)', 'انظر كمانة الرأس: الفقاعة تتجه نحو الساق الأعلى؛ قصّرها أو طوّل المقابلة بمقدار مليمترات (1 مم ≈ 0.5°).'],
  ['legsLock', 'اربط بزال الأرجل الثلاثة', 'اضغط الأقفال 🔓 لتصبح 🔒 بعد الضبط، كي لا تنزلق الأرجل.'],
  ['mounted', 'ركّب الجهاز على الحامل وثبّته بالمسمار المركزي', 'اضغط «ركّب الجهاز» (أو «تركيب فوري»).']
];
const STEPS_L = [...S_COMMON,
  ['level', 'سوِّ الجهاز بالبراغي الثلاثة حتى تدخل الفقاعة الدائرة البيضاء الصغيرة', 'اجعل السهم البرتقالي أفقياً (المنظار موازٍ للخط بين A وB). أدِر A وB بعكس بعضهما: تتحرك الفقاعة باتجاه الإبهام الأيسر. ثم دوّر الجهاز 90° وحرّك C وحده.'],
  ['rough', 'حرّر المثبّت ووجّه المنظار نحو الميرا بالمنظار الأولي', 'في تبويب المسح: المثبّت محرَّر، ثم «توجيه بالمنظار الأولي» أو اسحب شريط الدوران الأفقي.'],
  ['aim', 'اربط المثبّت وأتقن التوجيه بالحركة البطيئة لتنصّف الشعيرة الرأسية الميرا', 'اربط المثبّت ثم اضغط ↺ ↻ ضغطات قصيرة حتى تقع الشعيرة الرأسية على منتصف الميرا.'],
  ['eye', 'اضبط العدسة العينية حتى تصبح الشعيرات حادّة', 'حرّك مزلاج «العدسة العينية» حتى تصير الشعيرات سوداء ورفيعة.'],
  ['focus', 'بئّر الصورة حتى يصبح تدريج الميرا واضحاً', 'حرّك مزلاج «التبئير» حتى تتضح الأرقام والأشرطة (جرّب المنظار بكامل الشاشة).'],
  ['read', 'اقرأ الميرا وأضف القراءة للدفتر (BS على الـBM أولاً)', 'اختر النوع (BS للنقطة المعلومة)، اكتب قراءتك بالمتر ثم «➕ للدفتر». كل شريط = 1 سم، وقدّر الملّيمتر.'],
  ['dist', 'اقرأ الشعيرتين العليا والسفلى واحسب المسافة', 'المسافة = 100 × (قراءة العليا − قراءة السفلى). اكتبها في خانة المسافة قبل «➕ للدفتر».'],
  ['two', 'سجّل قراءات على نقطتين مختلفتين على الأقل واحسب المنسوب', 'بعد BS على الـBM أرسل الميرا إلى نقطة أخرى (أو انقل الجهاز) وأضف IS/FS، ثم افتح 📒 الدفتر وراجع RL والخطأ.']
];
const STEPS_T = [...S_COMMON,
  ['level', 'سوِّ الجهاز بالكمانة الأنبوبية حتى ≤ 30″ في كل الاتجاهات', 'وجّه الكمانة موازية لبرغيَّين (السهم البرتقالي عمودي على الكمانة)، أدِر البرغيَّين بعكس بعضهما حتى تتمركز. ثم دوّر الجهاز 90° وحرّك البرغي الثالث. فعّل «الضبط الدقيق» وتأكد بعد تدوير 180°.'],
  ['rough', 'وجّه المنظار نحو الميرا بالمنظار الأولي', 'حرّر المثبّتين ثم اضغط «توجيه بالمنظار الأولي» أو استعمل الدوران الأفقي والرأسي.'],
  ['aim', 'اربط المثبّتين الأفقي والرأسي وانصّف الميرا بالحركة البطيئة', 'اربط المثبّتين ثم ↺ ↻ للأفقي و▲ ▼ للرأسي بضغطات قصيرة حتى تقع الشعيرة الرأسية على الميرا.'],
  ['eye', 'اضبط العدسة العينية حتى تصبح الشعيرات حادّة', 'حرّك مزلاج «العدسة العينية».'],
  ['focus', 'بئّر الصورة حتى يتضح تدريج الميرا', 'حرّك مزلاج «التبئير».'],
  ['read', 'قِس ارتفاع الجهاز i ثم اقرأ U/M/L وسجّل (Hz وV تُسجَّل تلقائياً)', 'اضغط «📏 قياس ارتفاع الجهاز»، ثم اقرأ الميرا عند الشعيرة العليا والوسطى والسفلى واكتبها ثم «➕ تسجيل».'],
  ['face2', 'اقلب المنظار (الوجه II) وأعد القياس على نفس النقطة', 'حرّر المثبّتين، «🔄 قلب المنظار»، أعد التوجيه والتسجيل. قراءة V في الوجه II = 360° − Z.'],
  ['two', 'سجّل نقطتين مختلفتين وقارن الزاوية الأفقية بينهما', 'استعمل «0SET» على المرجع ثم وجّه إلى النقطة الثانية. يعرض تبويب 📐 الزاوية والخطأ.']
];
const STEPS_S = [...S_COMMON,
  ['level', 'سوِّ الجهاز على الشاشة (ميلان ≤ 1′، والمعوّض يعمل ضمن ±3′)', 'أدِر البراغي كما في النيفو، وفعّل «الضبط الدقيق». الدائرة البيضاء = 1′ والمتقطعة = ±3′.'],
  ['orient', 'اضبط الاتجاه: وجّه إلى BS معلوم واضغط «🧭 ضبط الاتجاه»', 'أرسل المنشور إلى BM، وجّه الشعيرة إلى منتصف المنشور (اربط المثبّتين) ثم «🧭 ضبط الاتجاه» ليصبح Hz = السمت.'],
  ['rough', 'وجّه المنظار نحو المنشور', 'حرّر المثبّتين ثم «توجيه بالمنظار الأولي».'],
  ['aim', 'اربط المثبّتين وانصّف المنشور بدقة', 'الشعيرتان على منتصف المنشور (الدائرة الداكنة) حتى تعمل EDM.'],
  ['eye', 'اضبط العدسة العينية حتى تصبح الشعيرات حادّة', 'حرّك مزلاج «العدسة العينية».'],
  ['focus', 'بئّر الصورة', 'حرّك مزلاج «التبئير».'],
  ['read', 'قِس ارتفاع الجهاز i واضبط hr ثم «📏 قياس وحفظ»', 'اضغط «📏 قياس ارتفاع الجهاز»، واكتب ارتفاع العاكس hr (يتغير طول القطب)، ثم «📏 قياس وحفظ».'],
  ['two', 'قِس نقطتين مختلفتين وراجع الإحداثيات والخطأ', 'أرسل المنشور إلى نقطة أخرى، وجّه وقِس. افتح 📐 قياس لترى N وE وZ والخطأ بالمليمتر.']
];
const STEPS_C = [...S_COMMON,
  ['level', 'سوِّ الجهاز بالكمانة الأنبوبية حتى ≤ 30″ في كل الاتجاهات', 'وجّه الكمانة موازية لبرغيَّين، أدِر البرغيَّين بعكس بعضهما، ثم دوّر الجهاز 90° وحرّك الثالث. فعّل «الضبط الدقيق».'],
  ['rough', 'وجّه المنظار نحو الميرا بالمنظار الأولي', 'حرّر المثبّتين ثم «توجيه بالمنظار الأولي» أو الدوران الأفقي والرأسي.'],
  ['aim', 'اربط المثبّتين وانصّف الميرا بالحركة البطيئة', 'اربط المثبّتين ثم ↺ ↻ و▲ ▼ بضغطات قصيرة حتى تقع الشعيرة الرأسية على الميرا.'],
  ['eye', 'اضبط العدسة العينية حتى تصبح الشعيرات حادّة', 'حرّك مزلاج «العدسة العينية».'],
  ['focus', 'بئّر الصورة حتى يتضح تدريج الميرا', 'حرّك مزلاج «التبئير».'],
  ['read', 'مركِز كمانة V ثم اقرأ Hz وV وق ع وق و وق س وS وK وسجّل', 'D = (ق ع − ق س)×100 = (ق ع − ق و)×200 (الاختزال آلي). ΔH = (ق ع − ق و)×K + J − S: J ارتفاع الجهاز وS قراءة شعيرة التصويب (القصيرة تحت المنتصف). K النظري يظهر تحت الخانات.'],
  ['face2', 'اقلب المنظار (الوجه II) وأعد القياس على نفس النقطة', 'حرّر المثبّتين، «🔄 قلب المنظار»، مركِز كمانة V من جديد وأعد القراءة. i = (V1 + V2 − 360°)/2.'],
  ['two', 'سجّل نقطتين مختلفتين وقارن الزاوية الأفقية بينهما', 'استعمل «0SET» على المرجع ثم وجّه إلى النقطة الثانية. يعرض تبويب 📐 الزاوية والخطأ.']
];
const curSteps = () => ({ level: STEPS_L, theo: STEPS_T, tach: STEPS_C, ts: STEPS_S })[I.type];
function renderSteps() {
  const st = curSteps(), k = I.type + st.map(s => (flags[s[0]] ? 1 : 0)).join('');
  if (k === ST.stepKey) return; ST.stepKey = k;
  $('#steps').innerHTML = st.map((s, i) => `<div class="st ${flags[s[0]] ? 'done' : ''}">${flags[s[0]] ? '✅' : '⬜'} ${i + 1}. ${s[1]}</div>`).join('');
}
$('#btnHint').onclick = () => { const s = curSteps().find(q => !flags[q[0]]); $('#hint').textContent = s ? '💡 ' + s[2] : '🎉 أكملت كل الخطوات!'; };

// ================= دفتر مناسيب النيفو =================
const fbRoot = $('#fb');
const newRow = pt => ({ pt, bs: null, is: null, fs: null, uhi: null, url: null, rem: '', tr: {}, d: {} });

function fbCompute() {
  let HI = null; const rlMap = {}, out = [];
  ST.rows.forEach(r => {
    const p = ptById(r.pt), known = p && p.bm && p.elev != null ? p.elev : null;
    const sight = r.fs != null ? r.fs : r.is != null ? r.is : null;
    const o = { rl: null, hi: null, calc: null, miscl: null, tru: p ? trueRL(p) : null, err: null };
    if (HI !== null && sight !== null) o.calc = HI - sight;
    if (known !== null) { o.rl = known; if (o.calc !== null) o.miscl = (o.calc - known) * 1000; }
    else if (o.calc !== null) o.rl = o.calc;
    else if (r.pt && rlMap[r.pt] !== undefined) o.rl = rlMap[r.pt];
    if (o.rl !== null && r.pt) rlMap[r.pt] = o.rl;
    if (r.bs != null && o.rl !== null) HI = o.rl + r.bs;
    o.hi = HI;
    if (known !== null) o.err = o.miscl; else if (o.rl !== null && o.tru !== null && o.calc !== null) o.err = (o.rl - o.tru) * 1000;
    out.push(o);
  });
  return out;
}

function fbSummary(comp) {
  let F = -1, L = -1;
  ST.rows.forEach((r, i) => {
    const p = ptById(r.pt);
    if (F < 0 && r.bs != null && comp[i].rl !== null && p && p.bm) F = i;
    if (r.fs != null && comp[i].calc !== null) L = i;
  });
  const lines = [];
  if (F < 0 || L < F) { lines.push('أضف BS على نقطة BM ثم FS على نقطة لاحقة لتظهر فحوص الحساب والإغلاق.'); return lines; }
  let sb = 0, sf = 0, dist = 0;
  for (let i = 0; i <= L; i++) {
    const r = ST.rows[i];
    if (r.bs != null && i !== L) sb += r.bs;
    if (r.fs != null) sf += r.fs;
    if (r.d) { if (i !== L && r.d.bs) dist += r.d.bs; if (r.d.fs) dist += r.d.fs; }
  }
  const dr = comp[L].calc - comp[F].rl, chk = (sb - sf) - dr;
  lines.push(`ΣBS = ${sb.toFixed(3)} | ΣFS = ${sf.toFixed(3)} | ΣBS−ΣFS = ${(sb - sf).toFixed(3)} | ΔRL = ${dr.toFixed(3)}`);
  lines.push(Math.abs(chk) < 0.0006 ? '✓ فحص الحساب سليم' : `✗ فحص الحساب غير مطابق (فرق ${(chk * 1000).toFixed(1)} مم) — راجع الجمع والطرح`);
  if (comp[L].miscl !== null) {
    const allow = dist > 0 ? 12 * Math.sqrt(dist / 1000) : null, m = comp[L].miscl;
    lines.push(`خطأ الإغلاق = ${m >= 0 ? '+' : ''}${m.toFixed(1)} مم` + (allow !== null ? ` | المسموح 12√K = ${allow.toFixed(1)} مم (K = ${(dist / 1000).toFixed(3)} كم) → ${Math.abs(m) <= allow ? '✓ مقبول' : '✗ مرفوض'}` : ''));
  }
  return lines;
}

function fbRender() {
  const comp = fbCompute(), showErr_ = !CFG.exam;
  const opts = pt => ['<option value=""></option>'].concat(ST.job.points.map(p => `<option value="${p.id}"${p.id === pt ? ' selected' : ''}>${p.id}</option>`)).concat(pt && !ptById(pt) ? [`<option value="${pt}" selected>${pt}</option>`] : []).join('');
  let h = `<thead><tr><th>#</th><th>النقطة</th><th>BS</th><th>IS</th><th>FS</th><th>HI</th><th>RL</th><th>ملاحظات</th>${showErr_ ? '<th>±مم</th>' : ''}</tr></thead><tbody>`;
  ST.rows.forEach((r, i) => {
    const num = f => `<input class="fn" type="number" step="0.001" inputmode="decimal" data-r="${i}" data-f="${f}" value="${r[f] ?? ''}">`;
    const hiCell = CFG.manual ? `<td><input type="number" step="0.001" inputmode="decimal" data-r="${i}" data-f="uhi" value="${r.uhi ?? ''}"></td>` : `<td class="calc" data-c="hi${i}"></td>`;
    const rlCell = CFG.manual ? `<td><input type="number" step="0.001" inputmode="decimal" data-r="${i}" data-f="url" value="${r.url ?? ''}"></td>` : `<td class="calc" data-c="rl${i}"></td>`;
    h += `<tr><td>${i + 1}</td><td><select data-r="${i}" data-f="pt">${opts(r.pt)}</select></td><td>${num('bs')}</td><td>${num('is')}</td><td>${num('fs')}</td>${hiCell}${rlCell}<td><input type="text" data-r="${i}" data-f="rem" value="${(r.rem || '').replace(/"/g, '&quot;')}"></td>${showErr_ ? `<td class="calc" data-c="er${i}"></td>` : ''}</tr>`;
  });
  fbRoot.innerHTML = h + '</tbody>';
  fbRefresh();
}

function fbRefresh() {
  const comp = fbCompute();
  ST.rows.forEach((r, i) => {
    const o = comp[i];
    ['bs', 'is', 'fs'].forEach(f => {
      const el = fbRoot.querySelector(`[data-r="${i}"][data-f="${f}"]`); if (!el) return;
      let cls = 'fn';
      const tr = r.tr && r.tr[f];
      if (!CFG.exam && tr != null && r[f] != null) { const d = Math.abs(r[f] - tr) * 1000; cls += d <= 3 ? ' ok' : d <= 10 ? ' warn' : ' bad'; }
      el.className = cls;
    });
    if (CFG.manual) {
      [['uhi', o.hi], ['url', o.rl]].forEach(([f, ref]) => {
        const el = fbRoot.querySelector(`[data-r="${i}"][data-f="${f}"]`); if (!el) return;
        el.className = r[f] == null ? '' : ref !== null && Math.abs(r[f] - ref) <= 0.0015 ? 'ok' : 'bad';
      });
    } else {
      const a = fbRoot.querySelector(`[data-c="hi${i}"]`), b = fbRoot.querySelector(`[data-c="rl${i}"]`);
      if (a) a.textContent = f3(o.hi); if (b) b.textContent = f3(o.rl);
    }
    const er = fbRoot.querySelector(`[data-c="er${i}"]`);
    if (er) { er.textContent = o.err === null ? '' : (o.err >= 0 ? '+' : '') + o.err.toFixed(0); er.style.color = o.err === null ? '' : Math.abs(o.err) <= 10 ? '#7ee787' : '#ff7b72'; }
  });
  $('#fbSum').textContent = ST.rows.length ? fbSummary(comp).join('\n') : 'الدفتر فارغ. أضف قراءة من تبويب المسح (➕ للدفتر) أو أضف صفاً يدوياً.';
}

['input', 'change'].forEach(ev => fbRoot.addEventListener(ev, e => {
  const t = e.target, i = +t.dataset.r, f = t.dataset.f;
  if (isNaN(i) || !f || !ST.rows[i]) return;
  const r = ST.rows[i];
  if (f === 'pt') r.pt = t.value; else if (f === 'rem') r.rem = t.value; else r[f] = numOrNull(t.value);
  fbRefresh(); saveState();
}));
$('#btnAddRow').onclick = () => { ST.rows.push(newRow(holder.station ? holder.station.id : '')); fbRender(); saveState(); };
$('#btnDelRow').onclick = () => { ST.rows.pop(); fbRender(); saveState(); };
$('#btnClearFb').onclick = () => { if (!ST.rows.length || confirm('مسح كل صفوف الدفتر؟')) { ST.rows = []; fbRender(); saveState(); $('#evalBox').textContent = ''; } };

$('#btnEval').onclick = () => {
  const comp = fbCompute(), finals = {}, lines = [];
  ST.rows.forEach((r, i) => { const p = ptById(r.pt), o = comp[i]; if (p && !p.bm && o.rl !== null && o.calc !== null && o.err !== null) finals[p.id] = { rl: o.rl, err: o.err }; });
  ST.job.points.filter(p => !p.bm).forEach(p => {
    const f = finals[p.id];
    lines.push(f ? `${p.id}: RL = ${f.rl.toFixed(3)} م | الخطأ ${f.err >= 0 ? '+' : ''}${f.err.toFixed(0)} مم ${Math.abs(f.err) <= 10 ? '✓' : '✗'}` : `${p.id}: لم تُقَس بعد`);
  });
  lines.push(''); fbSummary(comp).forEach(l => lines.push(l));
  const errs = Object.values(finals).map(f => f.err);
  if (errs.length) lines.push(`عدد النقاط المقاسة ${errs.length}/${ST.job.points.filter(p => !p.bm).length} | أكبر خطأ ${Math.max(...errs.map(Math.abs)).toFixed(0)} مم`);
  $('#evalBox').textContent = lines.join('\n');
};

$('#btnCsv').onclick = async () => {
  const comp = fbCompute(), lines = ['Point,BS,IS,FS,HI,RL,Remarks'];
  ST.rows.forEach((r, i) => lines.push([r.pt, f3(r.bs), f3(r.is), f3(r.fs), f3(comp[i].hi), f3(comp[i].rl), '"' + (r.rem || '').replace(/"/g, '""') + '"'].join(',')));
  const t = lines.join('\n');
  try { await navigator.clipboard.writeText(t); toast('نُسخ الجدول (CSV)'); }
  catch (e) { const b = $('#csvBox'); b.style.display = 'block'; b.value = t; b.select(); toast('انسخ النص من الخانة'); }
};

const KN_NAME = { bs: 'BS (خلفية)', is: 'IS (متوسطة)', fs: 'FS (أمامية)' };
function say(t, c) { const m = $('#readMsg'); m.textContent = t; m.className = 'stat ' + (c || ''); }
$('#btnRead').onclick = () => {
  const kind = $('#rdType').value, v = parseFloat($('#inRead').value);
  if (isNaN(v)) return say('اكتب القراءة بالمتر، مثل 1.423', 'warn');
  if (!I.st.mounted || holder.walking || !ST.S.hit || !holder.station) return say('الشعيرة الأفقية ليست على الميرا. وجّه المنظار أولاً.', 'warn');
  if (I.getTilt().arc > I.TY().comp) return say('الجهاز غير مسوّى (خارج مدى المعوّض) — القراءة غير معتمدة. سوِّه أولاً.', 'bad');
  const p = holder.station;
  let r = ST.rows[ST.rows.length - 1];
  const reuse = r && r.pt === p.id && (kind === 'bs' || (kind === 'fs' ? r.is == null : r.fs == null));
  if (!reuse) { r = newRow(p.id); ST.rows.push(r); }
  r[kind] = v; r.tr[kind] = ST.S.reading; r.d[kind] = ST.S.dist;
  const ad = Math.abs(v - ST.S.reading) * 1000;
  let msg = `✓ أُضيفت ${KN_NAME[kind]} عند ${p.id}`, cls = 'ok';
  if (!CFG.exam) { msg += ad <= 3 ? ` — دقيقة (فارق ${ad.toFixed(1)} مم)` : ad <= 10 ? ` — قريبة (فارق ${ad.toFixed(0)} مم)` : ` — بعيدة! فارق ${ad.toFixed(0)} مم`; cls = ad <= 3 ? 'ok' : ad <= 10 ? 'warn' : 'bad'; }
  const dv = parseFloat($('#inDist').value);
  if (!isNaN(dv) && ST.S.D) { if (Math.abs(dv - ST.S.D) <= 0.8) { flags.dist = true; msg += ` | المسافة صحيحة (${ST.S.D.toFixed(1)} م)`; } else msg += ` | المسافة الصحيحة ≈ ${ST.S.D.toFixed(1)} م`; }
  flags.read = true;
  flags.two = new Set(ST.rows.filter(q => q.bs != null || q.is != null || q.fs != null).map(q => q.pt)).size >= 2;
  ST.stepKey = ''; $('#inRead').value = '';
  say(msg, cls); fbRender(); saveState();
};

// ================= دفتر التيودوليت والتاكيومتر =================
// NIVO-V5 — تيودوليت رقمي + تاكيومتر يدوي ذاتي الاختزال (قوانين المقرر) + تاكيومتر آلي
const SEC = DEG / 3600;
const ttRoot = $('#tt');
const isStad = () => I.type === 'theo' || I.type === 'tach';
const kindRows = () => ST.rowsT.map((r, i) => [r, i]).filter(([r]) => r.k === I.type);

function ttCalc(r) {
  const su = setupById(r.su), p = ptById(r.pt), o = {};
  if (!su || !p) return o;
  const zen = SM.zenith(r.v, r.face), Zs = zOf(su);
  o.Dt = Math.hypot(p.x - su.x, p.z - su.z); o.Zt = zOf(p);
  if (r.k === 'tach' || r.k === 'theo') {
    if (r.u != null && r.l != null) {
      Object.assign(o, r.k === 'tach' ? SM.stadiaReduced(r, Zs) : SM.stadiaClassic(r, zen, Zs));
      o.eD = (o.D - o.Dt) * 100; if (o.Z != null) o.eZ = (o.Z - o.Zt) * 1000;
    }
  } else if (r.sd != null) {
    const c0 = crd(su.x, su.z), ct = crd(p.x, p.z);
    Object.assign(o, SM.totalStation(r, c0, Zs));
    o.eN = (o.N - ct.N) * 1000; o.eE = (o.E - ct.E) * 1000; o.eZ = (o.Z - o.Zt) * 1000;
  }
  return o;
}

function ttRender() {
  const kind = I.type, exam = CFG.exam;
  const opts = pt => ['<option value=""></option>'].concat(ST.job.points.map(p => `<option value="${p.id}"${p.id === pt ? ' selected' : ''}>${p.id}</option>`)).concat(pt && !ptById(pt) ? [`<option value="${pt}" selected>${pt}</option>`] : []).join('');
  const cols = kind === 'tach' ? ['#', 'النقطة', 'Hz', 'V', 'وجه', 'ق ع', 'ق و', 'ق س', 'K', 'S', 'D م', 'ΔH م', 'Z م'].concat(exam ? [] : ['±D سم', '±Z مم'])
    : kind === 'theo' ? ['#', 'النقطة', 'Hz', 'V', 'وجه', 'U', 'M', 'L', 'D م', 'Z م'].concat(exam ? [] : ['±D سم', '±Z مم'])
    : ['#', 'النقطة', 'Hz', 'V', 'وجه', 'SD', 'hr', 'HD', 'VD', 'N', 'E', 'Z'].concat(exam ? [] : ['±N مم', '±E مم', '±Z مم']);
  let h = '<thead><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
  kindRows().forEach(([r, i]) => {
    const inp = (f, v) => `<input type="number" step="0.001" inputmode="decimal" data-r="${i}" data-f="${f}" value="${v ?? ''}">`;
    const c = k => `<td class="calc" data-c="${k}${i}"></td>`;
    h += `<tr><td>${i + 1}</td><td><select data-r="${i}" data-f="pt">${opts(r.pt)}</select></td><td class="calc">${dms(r.hz)}</td><td class="calc">${dms(r.v)}</td><td>${r.face === 1 ? 'I' : 'II'}</td>`;
    if (kind === 'tach') h += `<td>${inp('u', r.u)}</td><td>${inp('m', r.m)}</td><td>${inp('l', r.l)}</td><td>${inp('kc', r.kc)}</td><td>${inp('s', r.s)}</td>${c('D')}${c('dH')}${c('Z')}` + (exam ? '' : c('eD') + c('eZ'));
    else if (kind === 'theo') h += `<td>${inp('u', r.u)}</td><td>${inp('m', r.m)}</td><td>${inp('l', r.l)}</td>${c('D')}${c('Z')}` + (exam ? '' : c('eD') + c('eZ'));
    else h += `<td class="calc">${(r.sd ?? 0).toFixed(3)}</td><td>${inp('hr', r.hr)}</td>${c('HD')}${c('VD')}${c('N')}${c('E')}${c('Z')}` + (exam ? '' : c('eN') + c('eE') + c('eZ'));
    h += '</tr>';
  });
  ttRoot.innerHTML = h + '</tbody>';
  ttRefresh();
}

function ttRefresh() {
  const set = (k, i, v, d, color) => {
    const el = ttRoot.querySelector(`[data-c="${k}${i}"]`); if (!el) return;
    el.textContent = v == null || Number.isNaN(v) ? '' : v.toFixed(d); if (color !== undefined) el.style.color = color;
  };
  const col = (e, lim) => (e == null ? '' : Math.abs(e) <= lim ? '#7ee787' : '#ff7b72');
  kindRows().forEach(([r, i]) => {
    const o = ttCalc(r);
    if (isStad()) {
      set('D', i, o.D, 2); set('Z', i, o.Z, 3); set('eD', i, o.eD, 1, col(o.eD, 10)); set('eZ', i, o.eZ, 0, col(o.eZ, 15));
      if (r.k === 'tach') set('dH', i, o.dH, 3);
    } else { set('HD', i, o.HD, 3); set('VD', i, o.VD, 3); set('N', i, o.N, 3); set('E', i, o.E, 3); set('Z', i, o.Z, 3); set('eN', i, o.eN, 0, col(o.eN, 15)); set('eE', i, o.eE, 0, col(o.eE, 15)); set('eZ', i, o.eZ, 0, col(o.eZ, 15)); }
  });
  $('#ttSum').textContent = ttSummary(false).join('\n');
}

function ttSummary(reveal) {
  const rr = ST.rowsT.filter(r => r.k === I.type), lines = [], show = reveal || !CFG.exam;
  if (!rr.length) return ['لا توجد قياسات بعد. ' + (I.type === 'ts' ? 'وجّه الشعيرة إلى المنشور واضغط 📏 قياس وحفظ.' : 'اقرأ ق ع/ق و/ق س (U/M/L) واضغط ➕ تسجيل.')];
  lines.push('عدد القياسات: ' + rr.length);
  if (isStad() && rr.length >= 2) {
    const a = rr[rr.length - 2], b = rr[rr.length - 1], su = setupById(a.su), pa = ptById(a.pt), pb = ptById(b.pt);
    if (a.su === b.su && su && pa && pb && a.pt !== b.pt && a.face === b.face) {
      const ang = (((b.hz - a.hz) % TAU) + TAU) % TAU, bt = p => Math.atan2(p.x - su.x, -(p.z - su.z)), trAng = (((bt(pb) - bt(pa)) % TAU) + TAU) % TAU;
      lines.push(`الزاوية الأفقية ${a.pt}→${b.pt} = ${dms(ang, 1)}` + (show ? ` | الحقيقية ${dms(trAng, 1)} | الخطأ ${(wrapPi(ang - trAng) / SEC).toFixed(0)}″` : ''));
    }
  }
  const by = {};
  rr.forEach(r => { const k = r.su + '|' + r.pt; (by[k] = by[k] || {})[r.face] = r; });
  Object.values(by).forEach(g => {
    if (!g[1] || !g[2]) return;
    const a = g[1], b = g[2], ie = (a.v + b.v - TAU) / 2, hzd = wrapPi(b.hz - a.hz - Math.PI);
    const zz = Math.min(Math.max(a.v, 0.2), Math.PI - 0.2), c2 = hzd * Math.sin(zz) / 2, mh = a.hz + wrapPi(b.hz - Math.PI - a.hz) / 2;
    let s = `${a.pt} (الوجهان): Hz متوسط = ${dms(mh, 1)} | i المقدّر = ${(wrapPi(ie) / SEC).toFixed(0)}″ | |c| المقدّر = ${(Math.abs(c2) / SEC).toFixed(0)}″`;
    if (show && I.ERR.on) s += ` | الحقيقي: i = ${I.errArc('i').toFixed(0)}″، |c| = ${Math.abs(I.errArc('c')).toFixed(0)}″` + (I.type === 'tach' ? ' (i يشمل برغي الفهرس)' : '');
    lines.push(s);
  });
  if (show) {
    const es = [];
    rr.forEach(r => { const o = ttCalc(r); if (isStad()) { if (o.eZ != null) es.push(Math.abs(o.eZ)); } else if (o.eN != null) es.push(Math.max(Math.abs(o.eN), Math.abs(o.eE), Math.abs(o.eZ))); });
    if (es.length) lines.push(`أكبر خطأ في المنسوب/الإحداثيات = ${Math.max(...es).toFixed(0)} مم`);
  }
  return lines;
}

['input', 'change'].forEach(ev => ttRoot.addEventListener(ev, e => {
  const t = e.target, i = +t.dataset.r, f = t.dataset.f;
  if (isNaN(i) || !f || !ST.rowsT[i]) return;
  if (f === 'pt') ST.rowsT[i].pt = t.value; else ST.rowsT[i][f] = numOrNull(t.value);
  ttRefresh(); saveState();
}));
$('#btnTtDel').onclick = () => { const idx = ST.rowsT.map(r => r.k).lastIndexOf(I.type); if (idx >= 0) ST.rowsT.splice(idx, 1); ttRender(); saveState(); };
$('#btnTtClear').onclick = () => { if (confirm('مسح كل قياسات هذا الجهاز؟')) { ST.rowsT = ST.rowsT.filter(r => r.k !== I.type); ttRender(); saveState(); } };
$('#btnTtEval').onclick = () => { $('#ttSum').textContent = ttSummary(true).join('\n'); };
$('#btnTtCsv').onclick = async () => {
  const kind = I.type, lines = [kind === 'tach' ? 'Point,Hz,V,Face,U,M,L,K,S,D,dH,Z' : kind === 'theo' ? 'Point,Hz,V,Face,U,M,L,D,Z' : 'Point,Hz,V,Face,SD,hr,HD,VD,N,E,Z'];
  kindRows().forEach(([r]) => {
    const o = ttCalc(r), base = [r.pt, dms(r.hz, 1), dms(r.v, 1), r.face === 1 ? 'I' : 'II'];
    const rest = kind === 'tach' ? [f3(r.u), f3(r.m), f3(r.l), f3(r.kc), f3(r.s), f3(o.D), f3(o.dH), f3(o.Z)] : kind === 'theo' ? [f3(r.u), f3(r.m), f3(r.l), f3(o.D), f3(o.Z)] : [f3(r.sd), f3(r.hr), f3(o.HD), f3(o.VD), f3(o.N), f3(o.E), f3(o.Z)];
    lines.push(base.concat(rest).join(','));
  });
  const t = lines.join('\n');
  try { await navigator.clipboard.writeText(t); toast('نُسخ الجدول (CSV)'); }
  catch (e) { const b = $('#ttCsvBox'); b.style.display = 'block'; b.value = t; b.select(); toast('انسخ النص من الخانة'); }
};

function afterTTRecord(r, msg, cls) {
  flags.read = true;
  if (r.face === 2) flags.face2 = true;
  flags.two = new Set(ST.rowsT.filter(q => q.k === I.type).map(q => q.pt)).size >= 2;
  ST.stepKey = ''; say(msg, cls); ttRender(); saveState();
}
const curSetupId = () => (ST.job.setups[ST.job.cur] || {}).id;

// ---- تيودوليت رقمي: Hz وV تُسجَّل تلقائياً ----
$('#btnThRec').onclick = () => {
  const u = numOrNull($('#inU').value), m = numOrNull($('#inM').value), l = numOrNull($('#inL').value), i = numOrNull($('#inHI').value);
  if (!I.st.mounted || !holder.station || holder.walking || !ST.S.hit) return say('الشعيرة ليست على الميرا. وجّه المنظار أولاً.', 'warn');
  if (u === null || l === null || u <= l) return say('اكتب قراءة الشعيرة العليا U (الأكبر) والسفلى L', 'warn');
  if (i === null) return say('قِس ارتفاع الجهاز i أولاً (📏)', 'warn');
  const rd = I.readings();
  const r = { k: 'theo', pt: holder.station.id, su: curSetupId(), hz: rd.hz, v: rd.v, face: rd.face, u, m, l, i, tr: { u: ST.S.U, m: ST.S.reading, l: ST.S.L } };
  ST.rowsT.push(r);
  let msg = `✓ سُجّل: Hz ${dms(rd.hz)} V ${dms(rd.v)} (وجه ${rd.face === 1 ? 'I' : 'II'})`, cls = 'ok';
  if (!CFG.exam && ST.S.U != null) { const e = Math.max(Math.abs(u - ST.S.U), Math.abs(l - ST.S.L)) * 1000; msg += ` | فارق قراءة الشعيرات ${e.toFixed(0)} مم`; cls = e <= 5 ? 'ok' : e <= 15 ? 'warn' : 'bad'; }
  if (I.getTilt().arc > 3) { msg += ' | ⚠ الجهاز غير مسوّى جيداً'; if (cls === 'ok') cls = 'warn'; }
  $('#inU').value = $('#inM').value = $('#inL').value = '';
  afterTTRecord(r, msg, cls);
};

// ---- تاكيومتر يدوي ذاتي الاختزال: تقرأ أنت Hz وV وق ع وق و وق س وتحسب K ----
function updK() {
  const rd = I.readings(), zen = SM.zenith(rd.v, rd.face);
  setTxt('#kHint', `K النظري = 200·tanα = ${SM.kTheory(zen).toFixed(3)}  (α = ${(SM.elev(zen) / DEG).toFixed(3)}°).  ΔH = (ق ع − ق و)·K + J − S`);
}
$('#btnTcRec').onclick = () => {
  const u = numOrNull($('#inU').value), m = numOrNull($('#inM').value), l = numOrNull($('#inL').value), i = numOrNull($('#inHI').value);
  const kc = numOrNull($('#inK').value), s = numOrNull($('#inS').value);
  const hD = numOrNull($('#inHzD').value), hM = numOrNull($('#inHzM').value), vD = numOrNull($('#inVD').value), vM = numOrNull($('#inVM').value);
  if (!I.st.mounted || !holder.station || holder.walking || !ST.S.hit) return say('الشعيرة ليست على الميرا. وجّه المنظار أولاً.', 'warn');
  if (hD === null || vD === null) return say('اكتب قراءتي Hz وV (درجات ودقائق) من نافذة القراءة', 'warn');
  if (u === null || l === null || u <= l) return say('اكتب ق ع (الأكبر) وق س (الأصغر)', 'warn');
  if (kc === null) return say('اكتب قيمة K (انظر K النظري تحت الخانات)', 'warn');
  if (s === null) return say('اكتب S: قراءة شعيرة التصويب (القصيرة تحت المنتصف)', 'warn');
  if (i === null) return say('قِس ارتفاع الجهاز J أولاً (📏)', 'warn');
  const hz = (((hD + (hM || 0) / 60) % 360 + 360) % 360) * DEG, v = (((vD + (vM || 0) / 60) % 360 + 360) % 360) * DEG, rd = I.readings();
  const r = { k: 'tach', pt: holder.station.id, su: curSetupId(), hz, v, face: rd.face, u, m, l, s, kc, i, tr: { u: ST.S.U, m: ST.S.reading, l: ST.S.L, s: ST.S.sr, hz: rd.hz, v: rd.v } };
  ST.rowsT.push(r);
  const o = ttCalc(r);
  let msg = `✓ سُجّل: D = ${o.D.toFixed(2)} م` + (o.dH != null ? ` | ΔH = ${o.dH >= 0 ? '+' : ''}${o.dH.toFixed(3)} م` : ''), cls = 'ok';
  const mm = m != null ? m : (u + l) / 2;
  if (Math.abs(o.D - (u - mm) * 200) > 0.15) { msg += ' | ⚠ ق و ليست منتصف ق ع وق س (D من المعادلتين تختلف)'; cls = 'warn'; }
  if (!CFG.exam) {
    const eh = Math.abs(wrapPi(hz - rd.hz)) / SEC, ev2 = Math.abs(wrapPi(v - rd.v)) / SEC, es = ST.S.U != null ? Math.max(Math.abs(u - ST.S.U), Math.abs(l - ST.S.L), m != null ? Math.abs(m - ST.S.reading) : 0, ST.S.sr != null ? Math.abs(s - ST.S.sr) : 0) * 1000 : 0;
    msg += ` | فارق قراءتك: Hz ${eh.toFixed(0)}″ و V ${ev2.toFixed(0)}″ والشعيرات ${es.toFixed(0)} مم`;
    if (cls === 'ok') cls = Math.max(eh, ev2) <= 90 && es <= 5 ? 'ok' : Math.max(eh, ev2) <= 240 && es <= 15 ? 'warn' : 'bad';
  }
  if (Math.abs(I.indexBubble()) > 0.5) { msg += ' | ⚠ كمانة الدائرة الرأسية غير مركزية'; if (cls === 'ok') cls = 'warn'; }
  if (I.getTilt().arc > 3) { msg += ' | ⚠ الجهاز غير مسوّى جيداً'; if (cls === 'ok') cls = 'warn'; }
  $('#inU').value = $('#inM').value = $('#inL').value = $('#inK').value = $('#inS').value = '';
  afterTTRecord(r, msg, cls);
};

// ---- تاكيومتر آلي: EDM ----
$('#btnMeasTS').onclick = () => {
  if (!I.st.mounted || holder.walking || !holder.station) return say('أرسل المنشور وانتظر وصوله', 'warn');
  if (!ST.S.hit || !ST.S.edm) return say('الشعيرة ليست على منتصف المنشور — وجّه بدقة (EDM لا يعيد إشارة).', 'warn');
  const i = numOrNull($('#inHI').value), hr = numOrNull($('#inHr').value);
  if (i === null) return say('قِس ارتفاع الجهاز i أولاً (📏)', 'warn');
  if (hr === null) return say('اكتب ارتفاع العاكس hr', 'warn');
  const rd = I.readings(), ee = I.edmErr();
  const sdv = Math.round((ST.S.sd * (1 + ee.ppm * 1e-6) + ee.zero + (Math.random() - 0.5) * 2 * (0.002 + 2e-6 * ST.S.sd)) * 1000) / 1000;
  const r = { k: 'ts', pt: holder.station.id, su: curSetupId(), hz: rd.hz, v: rd.v, face: rd.face, sd: sdv, hr, i, comp: rd.comp };
  ST.rowsT.push(r);
  const o = ttCalc(r);
  ST.lastMeas = `SD ${sdv.toFixed(3)}  HD ${o.HD.toFixed(3)}  VD ${o.VD >= 0 ? '+' : ''}${o.VD.toFixed(3)}`;
  let msg = `✓ ${r.pt}: ${ST.lastMeas}`, cls = 'ok';
  if (!flags.orient) { msg += ' | ⚠ الاتجاه غير مضبوط: الإحداثيات مدوّرة'; cls = 'warn'; }
  if (!rd.comp) { msg += ' | ⚠ الميل خارج مدى المعوّض'; cls = 'bad'; }
  afterTTRecord(r, msg, cls);
};
$('#btnOrient').onclick = () => {
  if (!I.st.mounted) return say('ركّب الجهاز أولاً', 'warn');
  const bs = ptById($('#bsSel').value), s0 = ST.job.setups[ST.job.cur];
  if (!bs || !s0) return say('اختر نقطة BS معلومة (BM)', 'warn');
  if (!holder.station || holder.station.id !== bs.id) return say('أرسل المنشور إلى ' + bs.id + ' أولاً', 'warn');
  if (!ST.S.hit || !ST.S.edm) return say('وجّه الشعيرة إلى منتصف المنشور أولاً', 'warn');
  const az = Math.atan2(bs.x - s0.x, -(bs.z - s0.z)), face2 = I.st.vz > Math.PI;
  I.st.hz0 = I.st.heading - (az + (face2 ? Math.PI : 0)); flags.orient = true; ST.stepKey = '';
  say(`✓ ضُبط الاتجاه: Hz = ${dms(az, 1)} (سمت ${s0.id}→${bs.id})`, 'ok');
};

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
