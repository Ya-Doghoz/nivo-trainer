const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, 'public'), pat = path.join(__dirname, 'patch');
const P = n => fs.readFileSync(path.join(pat, n), 'utf8');
const rd = f => fs.readFileSync(path.join(pub, f), 'utf8');
let main = rd('main.js'), html = rd('index.html'), ins = rd('instrument.js');
if (main.includes('NIVO-V5') || ins.includes('NIVO-V5')) { console.log('✓ التحديث مطبّق مسبقاً'); process.exit(0); }
if (!main.includes('NIVO-V4')) { console.log('✗ طبّق التحديث السابق أولاً (node patch-v4.js)'); process.exit(1); }

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
main = between(main, '// ================= دفتر التيودوليت والتاكيومتر =================', '// ================= التسميات في العرض التفكيكي =================', P('main5_tt.txt'), 'main:tt');
main = between(main, 'const STEPS_C = [...S_COMMON,', 'const curSteps = ()', P('main5_steps.txt'), 'main:steps');
main = once(main, "fx.setStadia(t !== 'ts');", "fx.setMode(t === 'ts' ? 2 : t === 'tach' ? 1 : 0);", 'main:fxmode');
main = once(main, 'const a = Math.atan(0.005);', "const sp = I.type === 'tach' ? 1 - _d.y * _d.y : 1, a = Math.atan(0.005 * sp);", 'main:spread');
main = once(main, 'S = sightInfo();', "S = sightInfo();\n  scopeCam.getWorldDirection(_t); fx.setSpread(I.type === 'tach' ? 1 - _t.y * _t.y : 1); if (I.type === 'tach') updK();", 'main:step');

// ---- index.html ----
html = once(html, '<script type="module" src="/main.js"></script>', '<script type="module" src="/custom.js"></script>\n<script type="module" src="/main.js"></script>', 'html:custom');
html = between(html, '<div class="stad-only">', '<div class="ts-only"><div class="row"><label>hr (م)</label>', P('idx5_stad.txt'), 'html:stad');
html = between(html, '<p class="note stad-only">', '<p class="note ts-only">', P('idx5_note.txt'), 'html:note');

// ---- instrument.js ----
ins = once(ins, "import { scene, groundH, mulberry32 } from './world.js';", "import { scene, groundH, mulberry32, renderer } from './world.js';", 'ins:import');
ins = between(ins, '// ================= التيودوليت والتاكيومترات =================', "buildTT('theo'); buildTT('tach'); buildTT('ts');", P('ins5_region.txt'), 'ins:region');
ins = once(ins, "parts.forEach(p => { if (p.type !== 'all') p.obj.visible = p.type === t; });", "parts.forEach(p => { if (p.type !== 'all') p.obj.visible = p.type === t && !custom[p.type]; });", 'ins:setType');
ins = once(ins, "export const partsFor = () => parts.filter(p => p.type === 'all' || p.type === type);", "export const partsFor = () => parts.filter(p => p.type === 'all' || (p.type === type && !custom[type]));", 'ins:partsFor');
ins = ins.replace(/\s*$/, '\n') + 'export { rig, instRoot, rotating, ttTel };\n';

if (fails.length) {
  console.log('✗ لم يُطبَّق التحديث ولم يتغيّر أي ملف. المشاكل:');
  fails.forEach(f => console.log('  - ' + f));
  process.exit(1);
}
['main.js', 'index.html', 'instrument.js'].forEach(f => fs.copyFileSync(path.join(pub, f), path.join(pub, f + '.v4.bak')));
fs.writeFileSync(path.join(pub, 'main.js'), main);
fs.writeFileSync(path.join(pub, 'index.html'), html);
fs.writeFileSync(path.join(pub, 'instrument.js'), ins);
console.log('✓ تم التحديث (نسخ احتياطية: *.v4.bak)');
