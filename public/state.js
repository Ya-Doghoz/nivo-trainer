// الحالة المشتركة (B-003 خطوة 2): الإعدادات + متغيّرات كانت تُعدَّل من أقسام متعددة في main.js
// القاعدة: لا يُسنَد إلى متغيّر مستورد؛ كل حالة مشتركة هي حقل في ST (ST.job = ... ✓).
const raw = (() => { try { return JSON.parse(localStorage.getItem('nivoCfg') || '{}'); } catch (e) { return {}; } })();
if (raw.start && !raw.state) { raw.legs = raw.start === 'leveled' ? 'level' : 'random'; raw.state = raw.start === 'legs' ? 'off' : raw.start; }
export const CFG = Object.assign({ legs: 'random', state: 'off', inst: 'level', err: true, errK: 1, veg: 0.5, pat: 'E', lab: 'dots', q: '1.5', ui: '0.9', seed: '', fix: false, exam: false, manual: false }, raw);
export const saveCfg = () => { try { localStorage.setItem('nivoCfg', JSON.stringify(CFG)); } catch (e) { /* تجاهل */ } };
document.documentElement.style.setProperty('--k', CFG.ui);

export const ST = {
  scopeFull: false,
  focV: 0.1,
  eyeV: 0.95,
  blurFrac: 0,
  softFrac: 0,
  fine: false,
  lastMeas: '',
  seed: 0,
  job: { points: [], setups: [], cur: 0, E0: 1000, N0: 1000 },
  rows: [],
  rowsT: [],
  mapImg: null,
  slow: 0,
  slowT: 0,
  slowV: 0,
  slowVT: 0,
  S: { hit: false, dist: 70, ang: 9 },
  stepKey: ''
};
