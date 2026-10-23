// مساعدة قراءة الميرا: تلميحات + أنيميشن خطوة بخطوة
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ease = t => 1 - Math.pow(1 - t, 3);
const N = () => window.NIVO;

const style = document.createElement('style');
style.textContent = `
#hlp{position:fixed;inset:0;background:#0b0f16f2;z-index:15;overflow-y:auto;display:none;padding:8px;color:#fff;font-family:system-ui,Tahoma,sans-serif}
#hlpHead{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
#hlpBody{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;align-items:flex-start}
#hlpC{background:#fff;border-radius:8px;display:block}
#hlpRight{flex:1;min-width:250px;max-width:420px}
.hrow{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
#hlp button{background:#243044;color:#fff;border:1px solid #3a4a62;border-radius:10px;padding:7px 10px;font:inherit;font-size:13px}
#hlp button.on{background:#2f6fed;border-color:#7aa5ff}
#hlpDots{display:flex;gap:6px;margin:8px 0}
#hlpDots i{width:22px;height:6px;border-radius:3px;background:#33425a;display:block}
#hlpDots i.on{background:#ffd34d}
#hlpTitle{font-size:16px;font-weight:bold;color:#ffd34d;margin:6px 0 2px}
#hlpText{font-size:14px;line-height:1.8;min-height:80px}
#hlpTip,#hlpNote{font-size:12px;color:#aab;line-height:1.7;margin-top:6px}
body[data-inst="ts"] #btnHelp{display:none}
`;
document.head.appendChild(style);

const box = document.createElement('div'); box.id = 'hlp';
box.innerHTML = `<div id="hlpHead"><b>💡 مساعدة قراءة الميرا</b><button id="hlpClose">✕ إغلاق</button></div>
<div id="hlpBody"><canvas id="hlpC"></canvas><div id="hlpRight">
<div class="hrow" id="hlpHairs"></div>
<div class="hrow"><button id="hlpLive">قراءتي الحالية</button><button id="hlpDemo">🎲 مثال جديد</button></div>
<div id="hlpDots"></div><div id="hlpTitle"></div><div id="hlpText"></div>
<div class="hrow"><button id="hlpPrev">◀ السابق</button><button id="hlpPlay">⏸ إيقاف</button><button id="hlpNext">التالي ▶</button></div>
<div id="hlpTip"></div><div id="hlpNote"></div></div></div>`;
document.body.appendChild(box);

const cv = $('#hlpC');
const H = { open: false, hair: 'M', wantLive: true, live: false, R: 0, demoStale: true, step: 0, t0: 0, auto: true, raf: 0, base: null, cw: 233, ch: 420, h0: 0, h1: 0, ctx: null };
const DUR = [1.6, 2.2, 2.2, 3.2, 2.8, 3.2];
const TITLES = ['الشعيرة', 'الأمتار', 'الديسيمتر', 'السنتيمترات', 'الملّيمترات', 'النتيجة'];

function hairList() {
  return N().type() === 'tach' ? [['U', 'ق ع'], ['M', 'ق و'], ['L', 'ق س'], ['S', 'S']] : [['U', 'العليا U'], ['M', 'الوسطى M'], ['L', 'السفلى L']];
}
const hairName = () => (hairList().find(h => h[0] === H.hair) || ['', ''])[1];
function liveValue(hair) {
  const s = N().sight(); if (!s || !s.hit) return null;
  const v = hair === 'M' ? s.reading : hair === 'U' ? s.U : hair === 'L' ? s.L : s.sr;
  return Number.isFinite(v) ? v : null;
}
function demo() { let mm = Math.round(350 + Math.random() * 3200); if (mm % 10 === 0) mm += 3; return mm / 1000; }
function vals() {
  const Rmm = Math.round(H.R * 1000);
  return { Rmm, m: Math.floor(Rmm / 1000), d: Math.floor((Rmm % 1000) / 100), cc: Math.floor((Rmm % 100) / 10), mm: Rmm % 10 };
}

function drawStaff(c, s, h0, h1, pat, lab) {
  const Wd = 144, PW = 76, Hp = (h1 - h0) * 1000, Y = h => (h1 - h) * 1000;
  c.save(); c.scale(s, s); c.beginPath(); c.rect(0, 0, Wd, Hp); c.clip();
  c.fillStyle = '#f6f3e6'; c.fillRect(0, 0, Wd, Hp);
  const i0 = Math.max(0, Math.floor(h0 * 100) - 1), i1 = Math.min(399, Math.ceil(h1 * 100) + 1);
  c.fillStyle = '#161616';
  for (let i = i0; i <= i1; i++) if (i % 2 === 0) c.fillRect(0, Y((i + 1) / 100), PW, 10);
  const k0 = Math.max(0, Math.floor(h0 * 20) - 1), k1 = Math.min(79, Math.ceil(h1 * 20) + 1);
  if (pat === 'E') for (let k = k0; k <= k1; k++) c.fillRect(k % 2 === 0 ? 0 : PW - 16, Y((5 * k + 5) / 100), 16, 50);
  else { c.fillStyle = '#c11'; for (let k = k0; k <= k1; k++) c.fillRect(0, Y((5 * k + 5) / 100) - 1, PW, 3); }
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  const cx = PW + (Wd - PW) / 2;
  for (let n = Math.max(0, Math.floor(h0 * 10) - 1); n <= Math.min(39, Math.ceil(h1 * 10) + 1); n++) {
    const m = Math.floor(n / 10), d = n % 10, y0 = Y(n / 10);
    c.fillStyle = m % 2 === 1 ? '#d11' : '#111';
    if (lab === 'dots') {
      c.font = 'bold 56px sans-serif'; c.fillText(String(d), cx, y0 - 12);
      for (let j = 0; j < m; j++) { c.beginPath(); c.arc(cx + (j - (m - 1) / 2) * 14, y0 - 80, 5, 0, 7); c.fill(); }
    } else if (n > 0 && lab === 'pair') { c.font = 'bold 46px sans-serif'; c.fillText(`${m}${d}`, cx, y0 - 30); }
    else if (n > 0 && lab === 'stack') { c.font = 'bold 40px sans-serif'; c.fillText(String(m), cx, y0 - 52); c.fillText(String(d), cx, y0 - 10); }
    else if (n > 0 && lab === 'dec') { c.font = 'bold 38px sans-serif'; c.fillText(`${m},${d}`, cx, y0 - 30); }
    c.fillStyle = '#666'; c.fillRect(PW, y0 - 1, Wd - PW, 2);
  }
  c.restore();
}

function rebuild() {
  const cfg = N().cfg(), R = H.R;
  let h0 = R - 0.13, h1 = R + 0.13;
  if (h0 < 0) { h1 -= h0; h0 = 0; } if (h1 > 4) { h0 -= h1 - 4; h1 = 4; }
  H.h0 = h0; H.h1 = h1;
  const s = 420 / ((h1 - h0) * 1000), cw = Math.round(144 * s), ch = 420, dpr = Math.min(devicePixelRatio || 1, 2);
  H.cw = cw; H.ch = ch;
  cv.style.width = cw + 'px'; cv.style.height = ch + 'px'; cv.width = cw * dpr; cv.height = ch * dpr;
  H.ctx = cv.getContext('2d'); H.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const base = document.createElement('canvas'); base.width = cw * dpr; base.height = ch * dpr;
  const c = base.getContext('2d'); c.scale(dpr, dpr);
  drawStaff(c, s, h0, h1, cfg.pat, cfg.lab);
  H.base = base;
}

function rr(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function chip(c, text, x, y, bg, small) {
  c.font = (small ? 'bold 11px' : 'bold 13px') + ' sans-serif';
  const w = c.measureText(text).width + (small ? 10 : 16), h = small ? 15 : 22;
  x = clamp(x, w / 2 + 3, H.cw - w / 2 - 3);
  c.fillStyle = bg; rr(c, x - w / 2, y - h / 2, w, h, h / 2); c.fill();
  c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + 1);
}

function render(now) {
  const c = H.ctx, cw = H.cw, ch = H.ch, h0 = H.h0, h1 = H.h1, k = ch / (h1 - h0), lab = N().cfg().lab;
  const yOf = h => (h1 - h) * k, PWx = cw * 76 / 144, v = vals(), hr = v.Rmm / 1000;
  const dm = v.m + v.d / 10, cmTop = dm + v.cc / 100;
  const el = (now - H.t0) / 1000, dur = DUR[H.step], t = clamp(el / dur, 0, 1), S = H.step;
  if (H.auto && el > dur + 0.8) { go((S + 1) % 6); return; }
  c.clearRect(0, 0, cw, ch); c.drawImage(H.base, 0, 0, cw, ch);
  const rng = w => (lab === 'dots' ? (w === 'm' ? [dm + 0.07, dm + 0.092] : [dm + 0.01, dm + 0.068])
    : lab === 'stack' ? (w === 'm' ? [dm + 0.052, dm + 0.092] : [dm + 0.01, dm + 0.05]) : [dm + 0.03, dm + 0.075]);
  const hi = (r, col) => { c.fillStyle = col; c.fillRect(PWx, yOf(r[1]), cw - PWx, yOf(r[0]) - yOf(r[1])); };
  const pulse = 0.25 + 0.15 * Math.sin(now / 180);

  if (S === 1) {
    hi(rng('m'), `rgba(255,214,0,${0.3 + pulse * 0.5})`);
    chip(c, v.m > 0 || lab !== 'dots' ? `الأمتار = ${v.m}` : 'لا نقاط: 0 م', cw - 56, clamp(yOf(rng('m')[1]) - 14, 14, ch - 14), '#b45309');
  }
  if (S >= 2) {
    c.strokeStyle = '#2563eb'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, yOf(dm)); c.lineTo(cw * (S === 2 ? ease(t) : 1), yOf(dm)); c.stroke();
  }
  if (S === 2) {
    hi(rng('d'), `rgba(37,99,235,${0.18 + pulse * 0.4})`);
    chip(c, `ديسيمتر = ${v.d}`, cw - 56, clamp(yOf(dm) + 16, 14, ch - 14), '#2563eb');
    chip(c, `${v.m}.${v.d} م`, 40, clamp(yOf(dm) - 14, 14, ch - 14), '#2563eb');
  }
  if (S >= 3) {
    const shown = S === 3 ? Math.ceil(ease(t) * v.cc - 1e-9) : v.cc;
    for (let j = 0; j < shown; j++) {
      const y0 = yOf(dm + j / 100), y1 = yOf(dm + (j + 1) / 100);
      c.fillStyle = S === 3 ? 'rgba(16,185,129,.42)' : 'rgba(16,185,129,.22)'; c.fillRect(0, y1, PWx, y0 - y1);
      if (S === 3) chip(c, String(j + 1), PWx / 2, (y0 + y1) / 2, '#047857', true);
    }
    if (S === 3) chip(c, v.cc + ' سم', cw - 46, clamp(yOf(dm + v.cc / 200), 14, ch - 14), '#047857');
  }
  if (S >= 4) {
    const yt = yOf(cmTop + 0.01), yb = yOf(cmTop);
    c.fillStyle = 'rgba(250,204,21,.45)'; c.fillRect(0, yt, PWx, yb - yt);
    if (S === 4) {
      const bx0 = cw - 122, bw = 114, bh = 180, by = clamp(yOf(cmTop + 0.005) - bh / 2, 6, ch - bh - 6);
      c.fillStyle = 'rgba(250,204,21,.25)'; c.beginPath(); c.moveTo(PWx, yt); c.lineTo(bx0, by + 10); c.lineTo(bx0, by + bh - 10); c.lineTo(PWx, yb); c.closePath(); c.fill();
      c.fillStyle = '#fffbe6'; c.strokeStyle = '#a16207'; c.lineWidth = 2; rr(c, bx0, by, bw, bh, 8); c.fill(); c.stroke();
      const tb = by + bh - 14, th = bh - 28;
      for (let q = 0; q <= 10; q++) {
        const y = tb - q * th / 10; c.strokeStyle = '#444'; c.lineWidth = q % 5 === 0 ? 2 : 1;
        c.beginPath(); c.moveTo(bx0 + 10, y); c.lineTo(bx0 + (q % 5 === 0 ? 34 : 24), y); c.stroke();
        if (q % 5 === 0) { c.fillStyle = '#222'; c.font = '11px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(String(q), bx0 + 38, y); }
      }
      const e = ease(t), yh = tb - e * v.mm * th / 10;
      c.strokeStyle = '#e11d48'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(bx0 + 6, yh); c.lineTo(bx0 + bw - 6, yh); c.stroke();
      chip(c, `${Math.round(e * v.mm)} مم`, bx0 + bw - 34, clamp(yh - 14, by + 14, by + bh - 14), '#e11d48');
    }
  }
  const yh = yOf(hr);
  c.strokeStyle = '#e11d48'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(0, yh); c.lineTo(S === 0 ? cw * ease(t) : cw, yh); c.stroke();
  chip(c, hairName(), 38, clamp(yh - 14, 14, ch - 14), '#e11d48');
  if (S === 5) {
    c.fillStyle = '#fde047'; rr(c, cw / 2 - 74, 8, 148, 36, 10); c.fill();
    c.fillStyle = '#111'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(hr.toFixed(3) + ' م', cw / 2, 27);
  }
}

function texts(i) {
  const cfg = N().cfg(), lab = cfg.lab, pat = cfg.pat, v = vals(), hn = hairName();
  const labT = lab === 'dots' ? (v.m > 0 ? `عدد النقاط الحمراء فوق الرقم = الأمتار: <b>${v.m} م</b>.` : 'لا توجد نقاط حمراء فوق الرقم: القراءة أقل من متر <b>(0 م)</b>.')
    : lab === 'pair' ? `الرقم المزدوج <b>«${v.m}${v.d}»</b>: الأول = الأمتار (${v.m}) والثاني = الديسيمتر (${v.d}).`
    : lab === 'stack' ? `رقمان فوق بعض: العلوي = الأمتار (<b>${v.m}</b>) والسفلي = الديسيمتر (${v.d}).`
    : `الرقم العشري <b>«${v.m},${v.d}»</b>: ${v.m} متر و${v.d} ديسيمتر.`;
  const dT = lab === 'dots' ? `الرقم الكبير تحت الشعيرة = الديسيمتر: <b>${v.d}</b>. حتى الآن: ${v.m}.${v.d} م.` : `آخر علامة رقمية تحت الشعيرة تعطينا: <b>${v.m}.${v.d} م</b>.`;
  return [
    `نحدّد موضع الشعيرة <b>${hn}</b> على الميرا. القراءة = ارتفاع هذه الشعيرة فوق قاعدة الميرا (الصفر عند الأسفل).`,
    labT, dT,
    `نعدّ الأشرطة (${pat === 'E' ? 'كل شريط أسود أو أبيض = 1 سم، وكل حرف E = 5 سم' : 'كل شريط = 1 سم والخط الأحمر كل 5 سم'}) صعوداً من علامة الديسيمتر حتى الشعيرة: <b>${v.cc} سم</b>. حتى الآن: ${v.m}.${v.d}${v.cc} م.`,
    `نقدّر الملّيمتر داخل الشريط الذي فيه الشعيرة: نقسمه إلى 10 أجزاء (1 سم = 10 مم) وتقع الشعيرة عند الجزء <b>${v.mm}</b> ⇒ ${v.mm} مم.`,
    `القراءة = ${v.m} + 0.${v.d} + 0.0${v.cc} + 0.00${v.mm} = <b>${(v.Rmm / 1000).toFixed(3)} م</b>. اكتبها بالمتر في الخانة المناسبة (${hn}).`
  ][i];
}
function tip() {
  const ty = N().type(), h = H.hair;
  if (ty === 'level') return h === 'M' ? 'في الميزان القراءة المعتمدة هي <b>الوسطى</b> (BS/IS/FS).' : 'العليا والسفلى لقياس المسافة: D = 100 × (العليا − السفلى). تأكد أن الوسطى في منتصفهما تقريباً.';
  if (ty === 'theo') return h === 'M' ? 'الوسطى M تدخل في ΔZ = i + 50·s·sin2α − M.' : 'العليا U والسفلى L: s = U − L ثم D = 100·s·cos²α.';
  return { U: 'ق ع: D = (ق ع − ق س)×100 = (ق ع − ق و)×200.', M: 'ق و: تدخل في ΔH = (ق ع − ق و)·K + J − S.', L: 'ق س: الشعيرة السفلى، D = (ق ع − ق س)×100.', S: 'S: شعيرة التصويب القصيرة تحت المنتصف، تدخل في ΔH = (ق ع − ق و)·K + J − S.' }[h];
}

function go(i) {
  H.step = i; H.t0 = performance.now();
  $('#hlpTitle').textContent = `${i + 1}/6 — ${TITLES[i]}`;
  $('#hlpText').innerHTML = texts(i);
  $('#hlpTip').innerHTML = tip();
  [...$('#hlpDots').children].forEach((d, j) => d.classList.toggle('on', j === i));
}
function resolve() {
  const n = N(), exam = !!n.cfg().exam, lv = liveValue(H.hair);
  let note;
  if (H.wantLive && !exam && lv !== null && lv >= 0.02 && lv <= 3.98) { H.R = Math.round(lv * 1000) / 1000; H.live = true; note = 'تعرض قراءتك الفعلية عند هذه الشعيرة الآن.'; }
  else {
    H.live = false; if (!H.R || H.demoStale) { H.R = demo(); H.demoStale = false; }
    note = exam ? 'وضع الامتحان: مثال توضيحي فقط (لا تُعرض قراءتك الفعلية).' : H.wantLive ? 'لا توجد ميرا ضمن المنظار الآن: هذا مثال توضيحي.' : 'مثال توضيحي.';
  }
  $('#hlpNote').textContent = note;
  $('#hlpLive').classList.toggle('on', H.live);
  rebuild(); go(0);
}
function buildHairs() {
  const hb = $('#hlpHairs'); hb.innerHTML = '';
  hairList().forEach(([k, name]) => {
    const b = document.createElement('button'); b.textContent = name; b.className = k === H.hair ? 'on' : '';
    b.onclick = () => { H.hair = k; buildHairs(); resolve(); };
    hb.appendChild(b);
  });
  const dots = $('#hlpDots'); if (!dots.children.length) for (let i = 0; i < 6; i++) dots.appendChild(document.createElement('i'));
}
function updPlay() { $('#hlpPlay').textContent = H.auto ? '⏸ إيقاف' : '▶ تشغيل'; }
function frame(now) { if (!H.open) return; render(now); H.raf = requestAnimationFrame(frame); }

function open() {
  const n = N();
  if (!n) { alert('تعذّر الاتصال بالمحاكاة: تأكد من تحديث main.js'); return; }
  if (n.type() === 'ts') { n.say('التاكيومتر الآلي لا يقرأ ميرا: يقيس المسافة بالمنشور (EDM).', 'warn'); return; }
  H.open = true; H.hair = 'M'; H.wantLive = true; H.auto = true; H.R = 0; H.demoStale = true;
  box.style.display = 'block'; buildHairs(); resolve(); updPlay();
  cancelAnimationFrame(H.raf); H.raf = requestAnimationFrame(frame);
}
function close() { H.open = false; box.style.display = 'none'; cancelAnimationFrame(H.raf); }

$('#hlpClose').onclick = close;
$('#hlpPrev').onclick = () => { H.auto = false; updPlay(); go((H.step + 5) % 6); };
$('#hlpNext').onclick = () => { H.auto = false; updPlay(); go((H.step + 1) % 6); };
$('#hlpPlay').onclick = () => { H.auto = !H.auto; updPlay(); H.t0 = performance.now(); };
$('#hlpLive').onclick = () => { H.wantLive = !H.wantLive; resolve(); };
$('#hlpDemo').onclick = () => { H.wantLive = false; H.demoStale = true; resolve(); };
addEventListener('keydown', e => { if (e.key === 'Escape' && H.open) close(); });

// الزر في آخر قسم التسجيل (تبويب المسح)
(function () {
  const rm = $('#readMsg'); if (!rm || $('#btnHelp')) return;
  const row = document.createElement('div'); row.className = 'row';
  const b = document.createElement('button'); b.id = 'btnHelp'; b.className = 'zap'; b.textContent = '💡 مساعدة قراءة الميرا'; b.onclick = open;
  row.appendChild(b); rm.parentNode.insertBefore(row, rm);
})();
