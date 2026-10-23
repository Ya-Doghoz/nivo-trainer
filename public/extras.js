// ميلان الميرا + التأرجح + هبوط الحامل والميرا على الأرض الطرية قرب الماء
import * as I from './instrument.js';
import { setStaffTilt } from './targets.js';
import { wetness, groundH, holder } from './world.js';

const $ = s => document.querySelector(s), DEG = Math.PI / 180;
const T = { lean: 0, roll: 0, cur: 0, rock: 0, t: 0, min: 1e9 };
const N = () => window.NIVO || {};
const bub = $('#stBub'), bc = bub ? bub.getContext('2d') : null;

function apply() {
  T.cur = T.lean + (T.rock > 0 ? 4.5 * Math.sin(T.t * 2 * Math.PI / 2.4) : 0);
  setStaffTilt(T.cur * DEG, T.roll * DEG);
  const a = $('#tiltLv'), b = $('#tiltRv');
  if (a) a.textContent = T.lean.toFixed(1) + '°';
  if (b) b.textContent = T.roll.toFixed(1) + '°';
}
function drawBub() {
  if (!bc) return;
  bc.clearRect(0, 0, 60, 60); bc.fillStyle = '#0d2a22'; bc.beginPath(); bc.arc(30, 30, 28, 0, 7); bc.fill();
  bc.strokeStyle = '#fff'; bc.lineWidth = 1.5; bc.beginPath(); bc.arc(30, 30, 6, 0, 7); bc.stroke();
  let x = T.roll * 6, y = -T.cur * 6; const L = Math.hypot(x, y);
  if (L > 20) { x *= 20 / L; y *= 20 / L; }
  bc.fillStyle = 'rgba(190,255,225,.9)'; bc.beginPath(); bc.arc(30 + x, 30 + y, 5, 0, 7); bc.fill();
}
if ($('#tiltL')) {
  $('#tiltL').oninput = e => { T.lean = +e.target.value; apply(); };
  $('#tiltR').oninput = e => { T.roll = +e.target.value; apply(); };
  $('#btnPlumb').onclick = () => { T.lean = T.roll = 0; T.rock = 0; $('#tiltL').value = 0; $('#tiltR').value = 0; apply(); };
  $('#btnRock').onclick = () => { T.rock = 8; T.t = 0; T.min = 1e9; N().toast && N().toast('تأرجح الميرا: اقرأ أصغر قيمة تراها'); };
}

// ---- الأرض الطرية قرب الماء ----
let wts = [1, 0.7, 0.4], lastKey = '', warnT = 0;
function soft(dt) {
  const rp = I.rigPos;
  if (I.st.mounted) {
    const key = rp.x + ',' + rp.z;
    if (key !== lastKey) { lastKey = key; wts = [0, 1, 2].map(() => 0.3 + Math.random() * 0.7); warnT = 0; }
    const w = wetness(rp.x, rp.z);
    if (w > 0.3) {
      const k = 0.00004 * w * dt;                     // ≈ 2.4 مم/دقيقة عند الرطوبة الكاملة
      for (let i = 0; i < 3; i++) I.st.leg[i] = Math.max(-0.06, I.st.leg[i] - k * wts[i]);
      warnT += k;
      if (warnT > 0.0015) { warnT = -0.004; N().toast && N().toast('⚠ الأرض طرية قرب الماء: الحامل يهبط ببطء — أعد التسوية قبل كل قراءة'); }
    }
  }
  const g = holder.group.position;
  if (!holder.walking && holder.station) {
    const w = wetness(g.x, g.z);
    if (w > 0.3) g.y = Math.max(groundH(g.x, g.z) - 0.03, g.y - 0.00002 * w * dt);   // تغوص الميرا قليلاً
  }
}

let last = performance.now();
(function tick(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (T.rock > 0) {
    T.rock -= dt; T.t += dt; apply();
    const s = N().sight && N().sight();
    if (s && s.hit && Number.isFinite(s.reading)) T.min = Math.min(T.min, s.reading);
    if (T.rock <= 0) {
      T.rock = 0; apply();
      const ex = N().cfg && N().cfg().exam;
      if (N().say) N().say(ex ? 'انتهى التأرجح: القراءة الصحيحة هي أصغر قيمة رأيتها.' : (T.min < 1e8 ? `أصغر قراءة خلال التأرجح = ${T.min.toFixed(3)} م (هي القراءة الصحيحة)` : 'انتهى التأرجح'), 'ok');
    }
  }
  drawBub(); soft(dt);
  requestAnimationFrame(tick);
})(last);
