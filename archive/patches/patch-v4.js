const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, 'public'), pat = path.join(__dirname, 'patch');
const P = n => fs.readFileSync(path.join(pat, n), 'utf8');
let main = fs.readFileSync(path.join(pub, 'main.js'), 'utf8');
let html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
if (main.includes('NIVO-V4') || html.includes('NIVO-V4')) { console.log('✓ التحديث مطبّق مسبقاً'); process.exit(0); }

const fails = [];
const count = (s, a) => s.split(a).length - 1;
function once(s, a, b, tag) {
  const n = count(s, a);
  if (n !== 1) { fails.push(`${tag} (وُجد ${n} مرة)`); return s; }
  return s.replace(a, () => b);
}
function between(s, a, b, mid, tag) {
  const n = count(s, a);
  if (n !== 1) { fails.push(`${tag}: بداية المقطع (وُجد ${n})`); return s; }
  const i = s.indexOf(a), j = s.indexOf(b, i + a.length);
  if (j < 0) { fails.push(`${tag}: نهاية المقطع`); return s; }
  return s.slice(0, i) + mid + s.slice(j);
}

// ---- main.js ----
main = between(main, '// ================= دفتر التيودوليت والتاكيومتر =================', '// ================= التسميات في العرض التفكيكي =================', P('main_tt.txt'), 'main:tt');
main = between(main, '// ================= الإطار =================', 'function render() {', P('main_ui.txt'), 'main:ui');
main = once(main, "import { prismFace, setTarget, setPrismHeight, getPrismHeight } from './targets.js';", "import { prismFace, setTarget, setPrismHeight, getPrismHeight, setStaffZero } from './targets.js';", 'main:import');
main = once(main, "inst: 'level', pat: 'E',", "inst: 'level', err: true, errK: 1, pat: 'E',", 'main:cfg');
main = once(main, 'if (I.st.mounted) return; I.setMounted(true); afterChange();', 'if (I.st.mounted) return; I.mount(); afterChange();', 'main:mount');
main = once(main, "const o = ['level', 'theo', 'ts']; applyInstType(o[(o.indexOf(I.type) + 1) % 3]);", "const o = ['level', 'theo', 'tach', 'ts']; applyInstType(o[(o.indexOf(I.type) + 1) % 4]);", 'main:cycle');
main = once(main, 'CFG.inst = t; saveCfg(); I.setType(t); document.body.dataset.inst = t;', 'CFG.inst = t; saveCfg(); I.setType(t); applyErr(); document.body.dataset.inst = t;', 'main:applyInst');
main = once(main, 'const curSteps = () => ({ level: STEPS_L, theo: STEPS_T, ts: STEPS_S })[I.type];', P('main_steps.txt').trim(), 'main:steps');
main = once(main, "if (kind === 'theo') {", "if (kind === 'theo' || kind === 'tach') {", 'main:drawLevel');
main = once(main, 's.reading = h.point.y - gy;', 's.reading = h.point.y - gy - (ts ? 0 : I.staffZero());', 'main:zero1');
main = once(main, 's.U = hu.point.y - gy; s.L = hl.point.y - gy;', 's.U = hu.point.y - gy - I.staffZero(); s.L = hl.point.y - gy - I.staffZero();', 'main:zero2');
main = once(main, 'async function lanRefresh(tries = 4) {', P('main_settings.txt') + 'async function lanRefresh(tries = 4) {', 'main:settings');

// ---- index.html ----
html = between(html, '/* إظهار عناصر كل جهاز */', '/* الجداول */', P('idx_css.txt'), 'html:css');
html = between(html, '<section id="t2">', '<section id="t6">', P('idx_t2.txt'), 'html:t2');
html = between(html, '<section id="t7">', '<section id="t3">', P('idx_t7.txt'), 'html:t7');
html = once(html, '<select id="cfgInst"><option value="level">النيفو (Level)</option><option value="theo">التيودوليت (Theodolite)</option><option value="ts">التاكيومتر (Total Station)</option></select>',
  '<select id="cfgInst"><option value="level">النيفو (Level)</option><option value="theo">التيودوليت الرقمي (Theodolite)</option><option value="tach">التاكيومتر اليدوي (Optical Tacheometer)</option><option value="ts">التاكيومتر الآلي (Total Station)</option></select>', 'html:select');
html = once(html, '<div class="row"><label class="chk"><input type="checkbox" id="cfgManual">', P('idx_err.txt') + '<div class="row"><label class="chk"><input type="checkbox" id="cfgManual">', 'html:err');

if (fails.length) {
  console.log('✗ لم يُطبَّق التحديث ولم يتغيّر أي ملف. المشاكل:');
  fails.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
fs.copyFileSync(path.join(pub, 'main.js'), path.join(pub, 'main.js.v3.bak'));
fs.copyFileSync(path.join(pub, 'index.html'), path.join(pub, 'index.html.v3.bak'));
fs.writeFileSync(path.join(pub, 'main.js'), main);
fs.writeFileSync(path.join(pub, 'index.html'), html);
console.log('✓ تم تحديث main.js و index.html (نسخ احتياطية: *.v3.bak)');
