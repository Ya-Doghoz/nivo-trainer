// سجل الحركة + إعادة التشغيل على الخريطة
import * as I from './instrument.js';
import { holder, instPos, mapImage } from './world.js';

const $ = s => document.querySelector(s), N = () => window.NIVO || {}, DEG = Math.PI / 180;
const KEY = 'nivo.log.v1', MAXS = 5000, r1 = v => Math.round(v * 10) / 10;
let sess = null, hist = [], jobRef = null, tAcc = 0, lastT = performance.now(), lastPush = -99, lp = null;
const L = { setup: null, st: null, walk: false, mount: null };
const okS = s => s && Array.isArray(s.S) && Array.isArray(s.E);

try {
  const o = JSON.parse(localStorage.getItem(KEY) || 'null');
  if (o) hist = [o.cur, ...(o.hist || [])].filter(okS).filter(s => s.S.length || s.E.length).slice(0, 4);
} catch (_) {}

function snap(job) { if (job && sess) sess.job = { points: job.points.map(p => ({ id: p.id, x: p.x, z: p.z, bm: !!p.bm })), setups: job.setups.map(s => ({ id: s.id, x: s.x, z: s.z })) }; }
function newSession() {
  const job = N().job && N().job(); jobRef = job; tAcc = 0; lastPush = -99; lp = null;
  Object.assign(L, { setup: null, st: null, walk: false, mount: null });
  sess = { v: 1, t0: Date.now(), inst: I.type, dur: 0, S: [], E: [], job: null }; snap(job);
}
function save() {
  if (!sess) return; snap(jobRef);
  try { localStorage.setItem(KEY, JSON.stringify({ cur: sess, hist: hist.slice(0, 3) })); }
  catch (_) { try { localStorage.setItem(KEY, JSON.stringify({ cur: sess, hist: [] })); } catch (__) {} }
}
function ev(k, d) { if (!sess) newSession(); if (sess.E.length > 3000) return; sess.E.push(Object.assign({ t: +tAcc.toFixed(1), k }, d || {})); }

function sample() {
  if (document.hidden) { lastT = performance.now(); return; }
  const job = N().job && N().job(); if (!job) return;
  if (!sess) newSession();
  if (job !== jobRef) { if (sess.S.length || sess.E.length) { hist.unshift(sess); hist = hist.slice(0, 4); } newSession(); }
  const now = performance.now(); tAcc += Math.min(2, (now - lastT) / 1000); lastT = now;
  const g = holder.group.position, dr = (N().drone && N().drone.pos && N().drone.pos()) || null;
  const row = [+tAcc.toFixed(1), r1(g.x), r1(g.z), r1(instPos.x), r1(instPos.z), r1((I.st.heading || 0) / DEG), dr ? r1(dr.x) : null, dr ? r1(dr.z) : null, dr ? r1(dr.y) : null];
  const ch = !lp || !!dr || (lp[6] !== null) || Math.abs(row[1] - lp[1]) + Math.abs(row[2] - lp[2]) + Math.abs(row[3] - lp[3]) + Math.abs(row[4] - lp[4]) + Math.abs(row[5] - lp[5]) > 0.05;
  if (ch || tAcc - lastPush >= 5) { sess.S.push(row); lp = row; lastPush = tAcc; if (sess.S.length > MAXS) sess.S = sess.S.filter((_, i) => i % 2 === 0); }
  sess.dur = tAcc;
  const su = job.setups[job.cur], key = su ? su.id + '@' + su.x + ',' + su.z : '';
  if (key !== L.setup) { L.setup = key; if (su) ev('setup', { id: su.id, x: su.x, z: su.z }); snap(job); }
  const st = holder.station ? holder.station.id : null;
  if (holder.walking && !L.walk) ev('walk', { to: holder.target ? holder.target.id : null });
  L.walk = !!holder.walking;
  if (st !== L.st) { if (st) ev('arrive', { id: st }); L.st = st; }
  const mo = !!I.st.mounted; if (L.mount !== null && mo !== L.mount) ev(mo ? 'mount' : 'unmount'); L.mount = mo;
}
setInterval(sample, 500);
setInterval(save, 20000);
addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('pagehide', save);

// القراءات الناجحة: نلتقط ضغط أزرار القياس ثم نتحقق من رسالة النجاح ✓
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('button');
  if (!b || !/^btn.*(Read|Rec|Meas)/i.test(b.id)) return;
  const typed = $('#inRead') ? parseFloat($('#inRead').value) : NaN;
  setTimeout(() => {
    const m = $('#readMsg'); if (!m || !/^✓/.test(m.textContent)) return;
    const S = (N().sight && N().sight()) || {};
    ev('read', { btn: b.id, inst: I.type, st: holder.station ? holder.station.id : null, v: b.id === 'btnRead' && !isNaN(typed) ? typed : null, r: S.reading != null ? +S.reading.toFixed(3) : null, d: S.dist != null ? +S.dist.toFixed(1) : null });
  }, 0);
}, true);

// ---------- اللوحة ----------
const R = { on: false, play: false, t: 0, sp: 4, s: null, cur: false, bg: null, half: 120, last: 0, shown: -1 };
function css() {
  const s = document.createElement('style');
  s.textContent = `
#logUI{position:fixed;inset:0;z-index:90;background:#0b1118;color:#fff;display:none;overflow:auto;padding:10px;font:14px system-ui,sans-serif;direction:rtl}
#logUI.on{display:block}
#logUI button,#logUI select{background:#1b2735;color:#fff;border:1px solid #33465c;border-radius:9px;padding:7px 11px;font-size:14px}
#logUI button.on{background:#1f6feb}
#lgHead{display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap}
#lgSum{margin:6px 0;font-size:13px;opacity:.9;line-height:1.6}
#lgC{width:min(94vw,56vh);height:min(94vw,56vh);display:block;margin:6px auto;border-radius:10px;background:#101820}
#lgCtl{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap}
#lgR{width:100%;margin:8px 0}
#lgEv{max-height:30vh;overflow:auto;border:1px solid #223;border-radius:8px}
#lgEv div{padding:5px 9px;border-bottom:1px solid #1a2430;font-size:13px;cursor:pointer;opacity:.45}
#lgEv div.past{opacity:1}
#lgBot{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.lgtag{color:#9fd0ff;font-family:monospace;margin-left:6px}`;
  document.head.appendChild(s);
}
const fmt = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const lab = e => ({
  setup: `🔭 الجهاز عند ${e.id} (${e.x}, ${e.z})`, walk: `🚶 الميرا تتجه إلى ${e.to || '؟'}`, arrive: `📍 الميرا عند ${e.id}`,
  mount: '🔧 رُكّب الجهاز', unmount: '🔧 فُكّ الجهاز',
  read: `✓ قراءة عند ${e.st || '؟'}${e.v != null ? ' — كتبتَ ' + e.v : ''}${e.r != null ? ' (الحقيقية ' + e.r + ' م)' : ''}${e.d != null ? ' بُعد ' + e.d + ' م' : ''}`,
  drone: e.a === 'takeoff' ? '🚁 إقلاع الدرون' : e.a === 'land' ? '🚁 هبوط الدرون' : '🚁 عودة تلقائية'
}[e.k] || e.k);

function at(s, t) {
  const A = s.S; if (!A.length) return null;
  const mk = (a, b, k) => {
    const sx = (i, lim) => { const d = Math.hypot(b[i] - a[i], b[i + 1] - a[i + 1]); return d < lim ? [a[i] + (b[i] - a[i]) * k, a[i + 1] + (b[i + 1] - a[i + 1]) * k] : [a[i], a[i + 1]]; };
    const [hx, hz] = sx(1, 6), [ix, iz] = sx(3, 3);
    const dh = ((b[5] - a[5] + 540) % 360) - 180;
    const dr = a[6] !== null && b[6] !== null ? [a[6] + (b[6] - a[6]) * k, a[7] + (b[7] - a[7]) * k, a[8] + (b[8] - a[8]) * k] : (a[6] !== null ? [a[6], a[7], a[8]] : null);
    return { hx, hz, ix, iz, hd: a[5] + dh * k, dr };
  };
  if (t <= A[0][0]) return mk(A[0], A[0], 0);
  const last = A[A.length - 1]; if (t >= last[0]) return mk(last, last, 0);
  let lo = 0, hi = A.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A[m][0] <= t) lo = m; else hi = m; }
  return mk(A[lo], A[hi], (t - A[lo][0]) / Math.max(1e-6, A[hi][0] - A[lo][0]));
}
function draw() {
  const c = $('#lgC'), x = c.getContext('2d'), S = c.width, s = R.s; if (!s) return;
  const H = R.half, k = S / (2 * H), w = (px, pz) => [(px + H) * k, (pz + H) * k];
  x.clearRect(0, 0, S, S);
  if (R.bg && R.cur) x.drawImage(R.bg, 0, 0, S, S); else { x.fillStyle = '#16202b'; x.fillRect(0, 0, S, S); }
  x.strokeStyle = 'rgba(255,255,255,.14)'; x.lineWidth = 1;
  for (let g = -Math.floor(H / 20) * 20; g <= H; g += 20) { const [a, b] = w(g, g); x.beginPath(); x.moveTo(a, 0); x.lineTo(a, S); x.moveTo(0, b); x.lineTo(S, b); x.stroke(); }
  const path = (i, j, col, lw) => {
    x.strokeStyle = col; x.lineWidth = lw; x.beginPath(); let pen = false, pv = null;
    for (const r of s.S) {
      if (r[0] > R.t) break; if (r[i] === null) { pen = false; continue; }
      const [a, b] = w(r[i], r[j]);
      if (!pen || (pv && Math.hypot(r[i] - pv[0], r[j] - pv[1]) > (i === 3 ? 3 : 6))) x.moveTo(a, b); else x.lineTo(a, b);
      pen = true; pv = [r[i], r[j]];
    }
    x.stroke();
  };
  path(3, 4, 'rgba(77,171,247,.9)', 2); path(1, 2, 'rgba(255,159,67,.9)', 1.5); path(6, 7, 'rgba(34,211,238,.9)', 1.5);
  const job = s.job, reads = {};
  s.E.forEach(e => { if (e.k === 'read' && e.t <= R.t && e.st) reads[e.st] = (reads[e.st] || 0) + 1; });
  if (job) {
    job.points.forEach(p => {
      const [a, b] = w(p.x, p.z); x.fillStyle = p.bm ? '#2ea043' : '#e8402a'; x.strokeStyle = '#fff'; x.lineWidth = 1.2;
      x.beginPath(); x.arc(a, b, 5, 0, 7); x.fill(); x.stroke();
      x.font = 'bold 11px sans-serif'; x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 3; x.strokeText(p.id + (reads[p.id] ? ' ✓' + reads[p.id] : ''), a + 7, b - 6); x.fillText(p.id + (reads[p.id] ? ' ✓' + reads[p.id] : ''), a + 7, b - 6);
    });
    job.setups.forEach(q => { const [a, b] = w(q.x, q.z); x.strokeStyle = 'rgba(77,171,247,.8)'; x.lineWidth = 1.5; x.strokeRect(a - 4, b - 4, 8, 8); });
  }
  const p = at(s, R.t); if (!p) return;
  let [a, b] = w(p.ix, p.iz);
  x.strokeStyle = '#4dabf7'; x.lineWidth = 2; x.beginPath(); x.moveTo(a, b); x.lineTo(a + Math.sin(p.hd * DEG) * 14 * k * 2, b - Math.cos(p.hd * DEG) * 14 * k * 2); x.stroke();
  x.fillStyle = '#4dabf7'; x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(a, b - 8); x.lineTo(a + 8, b); x.lineTo(a, b + 8); x.lineTo(a - 8, b); x.closePath(); x.fill(); x.stroke();
  [a, b] = w(p.hx, p.hz); x.fillStyle = '#ff9f43'; x.beginPath(); x.arc(a, b, 5, 0, 7); x.fill(); x.stroke();
  if (p.dr) { [a, b] = w(p.dr[0], p.dr[1]); x.fillStyle = '#22d3ee'; x.beginPath(); x.moveTo(a, b - 7); x.lineTo(a + 6, b + 6); x.lineTo(a - 6, b + 6); x.closePath(); x.fill(); x.stroke(); }
}
function summary(s) {
  let walk = 0, fly = 0, prev = null;
  s.S.forEach(r => { if (prev) { const d = Math.hypot(r[1] - prev[1], r[2] - prev[2]); if (d < 6) walk += d; if (r[6] !== null && prev[6] !== null && r[0] - prev[0] < 2) fly += r[0] - prev[0]; } prev = r; });
  const c = k => s.E.filter(e => e.k === k).length;
  return `⏱ ${fmt(s.dur || 0)} · 🚶 الميرا ${walk.toFixed(0)} م · 🔭 مواضع الجهاز ${c('setup')} · ✓ قراءات ${c('read')} · 🚁 إقلاعات ${s.E.filter(e => e.k === 'drone' && e.a === 'takeoff').length} (${fmt(fly)})`;
}
function renderEvents() {
  const s = R.s; $('#lgEv').innerHTML = s.E.map((e, i) => `<div data-i="${i}"><span class="lgtag">${fmt(e.t)}</span>${lab(e)}</div>`).join('') || '<div class="past">لا أحداث بعد</div>';
  R.shown = -1;
}
function pick(i) {
  const all = [sess, ...hist].filter(Boolean); R.s = all[i] || sess; R.cur = R.s === sess; R.t = 0; R.play = false; $('#lgPlay').textContent = '▶';
  R.half = (N().half && N().half()) || 120; R.bg = null;
  if (R.cur) { try { R.bg = mapImage(R.half, 240).canvas; } catch (_) {} }
  $('#lgSum').textContent = summary(R.s); renderEvents();
}
function loop(now) {
  if (!R.on) return;
  const dt = Math.min(0.1, (now - R.last) / 1000); R.last = now;
  const dur = Math.max(1, R.s.dur || 1);
  if (R.play) { R.t += dt * R.sp; if (R.t >= dur) { R.t = dur; R.play = false; $('#lgPlay').textContent = '▶'; } }
  $('#lgR').value = Math.round(R.t / dur * 1000); $('#lgT').textContent = fmt(R.t) + ' / ' + fmt(dur);
  const n = R.s.E.filter(e => e.t <= R.t).length;
  if (n !== R.shown) { R.shown = n; [...$('#lgEv').children].forEach((el, i) => el.classList.toggle('past', i < n)); }
  draw(); requestAnimationFrame(loop);
}
function csv(rows) { return rows.map(r => r.map(v => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n'); }
function dl(name, text) {
  const b = new Blob(['\ufeff' + text], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
  a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
function panel() {
  if ($('#logUI')) return;
  css();
  const d = document.createElement('div'); d.id = 'logUI';
  d.innerHTML = `<div id="lgHead"><b>🎞 سجل الحركة</b><select id="lgSel"></select><button id="lgX">✕ إغلاق</button></div>
<div id="lgSum"></div><canvas id="lgC" width="420" height="420"></canvas>
<div id="lgCtl"><button id="lgPlay">▶</button><button data-s="1">×1</button><button data-s="4" class="on">×4</button><button data-s="16">×16</button><button data-s="64">×64</button><span id="lgT"></span></div>
<input type="range" id="lgR" min="0" max="1000" value="0"><div id="lgEv"></div>
<div id="lgBot"><button id="lgCsvE">⬇ أحداث CSV</button><button id="lgCsvT">⬇ مسار CSV</button><button id="lgClr">🗑 مسح السجل</button></div>`;
  document.body.appendChild(d);
  $('#lgX').onclick = () => { R.on = false; d.classList.remove('on'); };
  $('#lgPlay').onclick = () => { if (R.t >= (R.s.dur || 0) - 0.01) R.t = 0; R.play = !R.play; $('#lgPlay').textContent = R.play ? '⏸' : '▶'; };
  d.querySelectorAll('#lgCtl [data-s]').forEach(b => { b.onclick = () => { R.sp = +b.dataset.s; d.querySelectorAll('#lgCtl [data-s]').forEach(q => q.classList.toggle('on', q === b)); }; });
  $('#lgR').oninput = e => { R.t = e.target.value / 1000 * (R.s.dur || 1); };
  $('#lgEv').onclick = e => { const el = e.target.closest('[data-i]'); if (el) R.t = Math.max(0, R.s.E[+el.dataset.i].t - 1); };
  $('#lgSel').onchange = e => pick(+e.target.value);
  $('#lgCsvE').onclick = () => dl('nivo-events.csv', csv([['t_sec', 'event', 'id', 'x', 'z', 'point', 'typed', 'true_reading', 'dist', 'info']].concat(R.s.E.map(e => [e.t, e.k, e.id || e.to || '', e.x ?? '', e.z ?? '', e.st || '', e.v ?? '', e.r ?? '', e.d ?? '', lab(e)]))));
  $('#lgCsvT').onclick = () => dl('nivo-track.csv', csv([['t_sec', 'staff_x', 'staff_z', 'inst_x', 'inst_z', 'heading_deg', 'drone_x', 'drone_z', 'drone_y']].concat(R.s.S)));
  $('#lgClr').onclick = () => {
    if (!confirm('مسح كل سجل الحركة؟')) return;
    hist = []; try { localStorage.removeItem(KEY); } catch (_) {} newSession(); open();
  };
}
function open() {
  panel(); save();
  const all = [sess, ...hist].filter(Boolean);
  $('#lgSel').innerHTML = all.map((s, i) => `<option value="${i}">${i ? new Date(s.t0).toLocaleString('ar') : 'الجلسة الحالية'} — ${s.E.length} حدث</option>`).join('');
  $('#logUI').classList.add('on'); pick(0); R.on = true; R.last = performance.now(); requestAnimationFrame(loop);
}
(function () {
  const b = document.createElement('button'); b.id = 'btnLog'; b.className = 'zap'; b.textContent = '🎞 سجل'; b.onclick = open;
  ($('#top') || document.body).appendChild(b);
})();
Object.assign(window.NIVO || (window.NIVO = {}), { logbook: { event: ev, open } });
