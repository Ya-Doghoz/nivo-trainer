// إعدادات الدرون (صوت + طيران + حمولة): تُحفظ في المتصفح وتظهر في ⚙️ إعدادات ← «🚁 محاكاة الدرون»
const KEY = 'nivo.drone.cfg.v1';
export const DEF = {
  OS: 1, bbTotal: 0.115, washShare: 0.5, hissShare: 0.3, teShare: 0.2, toneGain: 0.3, drive: 1.4, masterVolume: 0.9, windGain: 0.08, vibGain: 0.3, isoC: 0.011, groundEffect: 0.5,
  payload: 'none', maxR: 800, maxH: 120, maxV: 9, rthH: 60, battery: true, view: 'ctrl'
};
export const SOUND_KEYS = ['OS', 'bbTotal', 'washShare', 'hissShare', 'teShare', 'toneGain', 'drive', 'masterVolume', 'windGain', 'vibGain', 'isoC', 'groundEffect'];
// الحمولات: الكتلة (كغ) كما في محرّك الصوت
const M = { camera: 0.15, rtk: 0.25, lidar: 0.9, multispec: 0.45 };
export const PAY = {
  none: { label: 'بلا حمولة', parts: [] },
  camera: { label: 'كاميرا', parts: ['camera'] },
  rtk: { label: 'RTK', parts: ['rtk'] },
  lidar: { label: 'ليدار (LiDAR)', parts: ['lidar'] },
  multispec: { label: 'كاميرا متعددة الأطياف', parts: ['multispec'] },
  survey_basic: { label: 'مسح أساسي: RTK + كاميرا', parts: ['rtk', 'camera'] },
  survey_lidar: { label: 'مسح ليدار: RTK + LiDAR', parts: ['rtk', 'lidar'] },
  survey_advanced: { label: 'مسح متقدم: RTK + LiDAR + كاميرا', parts: ['rtk', 'lidar', 'camera'] },
  mapping_only: { label: 'رفع خرائط: RTK فقط', parts: ['rtk'] }
};
export const payloadMass = n => ((PAY[n] || PAY.none).parts.reduce((a, p) => a + (M[p] || 0), 0));
export const hasPart = (n, p) => (PAY[n] || PAY.none).parts.includes(p);

function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; } }
export const DC = Object.assign({}, DEF, load());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(DC)); } catch (_) {} };
export const soundCfg = () => { const o = {}; SOUND_KEYS.forEach(k => { o[k] = DC[k]; }); return o; };
export function setCfg(k, v) { DC[k] = v; save(); window.dispatchEvent(new CustomEvent('nivo-drone-cfg', { detail: { k } })); }
export function resetCfg() { Object.assign(DC, DEF); save(); window.dispatchEvent(new CustomEvent('nivo-drone-cfg', { detail: { k: '*' } })); }

const SND = [
  ['OS', 'جودة المعالجة OS (1 أخف · 2 أدق)', 'sel', [[1, '1 — خفيف (مناسب للهاتف)'], [2, '2 — أدق (أثقل)']]],
  ['bbTotal', 'مجموع الكسب العريض (bbTotal) — الافتراضي 0.115', 'rng', 0, 0.4, 0.005],
  ['washShare', 'حصة ضجيج الغسيل (wash)', 'rng', 0, 1, 0.05], ['hissShare', 'حصة الهسيس (hiss)', 'rng', 0, 1, 0.05], ['teShare', 'حصة الحافة الخلفية (te)', 'rng', 0, 1, 0.05],
  ['toneGain', 'قوة النغمة (toneGain)', 'rng', 0, 0.8, 0.01], ['drive', 'التشبّع (drive)', 'rng', 0.5, 3, 0.05],
  ['masterVolume', 'مستوى الصوت العام', 'rng', 0, 1.5, 0.05], ['windGain', 'صوت الرياح', 'rng', 0, 0.4, 0.01], ['vibGain', 'اهتزاز الهيكل', 'rng', 0, 1, 0.02],
  ['isoC', 'امتصاص الهواء مع المسافة (isoC)', 'rng', 0, 0.03, 0.001], ['groundEffect', 'تأثير الأرض', 'rng', 0, 1, 0.05]
];
const FLY = [
  ['payload', 'الحمولة المركّبة', 'sel', Object.keys(PAY).map(k => [k, PAY[k].label + (payloadMass(k) ? ` (${payloadMass(k).toFixed(2)} كغ)` : '')])],
  ['view', 'المنظور الافتراضي', 'sel', [['ctrl', '🎮 من الأرض + شاشة جهاز التحكم'], ['fpv', '📷 كاميرا الدرون كاملة'], ['ground', '👁 من الأرض فقط']]],
  ['maxR', 'أقصى مدى عن نقطة الإقلاع (م)', 'rng', 100, 1500, 50], ['maxH', 'أقصى ارتفاع (م)', 'rng', 30, 300, 10],
  ['maxV', 'أقصى سرعة (م/ث)', 'rng', 3, 20, 1], ['rthH', 'ارتفاع العودة التلقائية (م)', 'rng', 20, 200, 10],
  ['battery', 'محاكاة البطارية', 'chk']
];
// يبني صفوف الإعدادات داخل عنصر (يُستعمل في ⚙️ إعدادات وفي لوحة الدرون)
export function buildCfg(el) {
  el.innerHTML = '';
  const sec = t => { const h = document.createElement('p'); h.className = 'note'; h.innerHTML = `<b>${t}</b>`; el.appendChild(h); };
  const row = f => {
    const [k, lab, type] = f, d = document.createElement('div'); d.className = 'row'; d.style.flexWrap = 'wrap';
    const l = document.createElement('label'); l.textContent = lab; d.appendChild(l);
    if (type === 'sel') {
      const s = document.createElement('select');
      f[3].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; s.appendChild(o); });
      s.value = DC[k]; s.onchange = () => setCfg(k, typeof DEF[k] === 'number' ? +s.value : s.value); d.appendChild(s);
    } else if (type === 'chk') {
      const c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!DC[k]; c.onchange = () => setCfg(k, c.checked); d.appendChild(c);
    } else {
      const r = document.createElement('input'), n = document.createElement('input');
      r.type = 'range'; n.type = 'number'; [r, n].forEach(q => { q.min = f[3]; q.max = f[4]; q.step = f[5]; q.value = DC[k]; });
      n.style.width = '84px';
      const set = v => { v = Math.min(f[4], Math.max(f[3], +v)); if (!isFinite(v)) return; r.value = n.value = v; setCfg(k, v); };
      r.oninput = () => set(r.value); n.onchange = () => set(n.value); d.appendChild(r); d.appendChild(n);
    }
    el.appendChild(d);
  };
  sec('🔊 صوت الدرون'); SND.forEach(row);
  sec('🛩 الطيران والحمولة'); FLY.forEach(row);
  const b = document.createElement('div'); b.className = 'row';
  b.innerHTML = '<button class="zap">↺ القيم الافتراضية</button>'; b.firstChild.onclick = () => { resetCfg(); buildCfg(el); };
  el.appendChild(b);
  const nt = document.createElement('p'); nt.className = 'note';
  nt.textContent = 'تُطبَّق التغييرات فوراً على صوت الدرون وهو يعمل. الحمولة الثقيلة تزيد دوران المراوح وتقلل السرعة وزمن التحليق، والليدار له أزيز عالٍ.';
  el.appendChild(nt);
}
(function mount() {
  const t5 = document.querySelector('#t5'); if (!t5) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = '<div class="row"><button id="btnDroneCfg" class="big">🚁 محاكاة الدرون</button></div><div id="droneCfgBox" style="display:none"></div>';
  t5.appendChild(wrap);
  const box = wrap.querySelector('#droneCfgBox');
  wrap.querySelector('#btnDroneCfg').onclick = () => { const on = box.style.display === 'none'; box.style.display = on ? 'block' : 'none'; if (on) buildCfg(box); };
})();
