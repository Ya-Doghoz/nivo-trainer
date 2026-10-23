// يعدّل نسخة محرّك الصوت داخل public/ (النسخ الأصلية في ~/delete_qwen لا تُمَسّ)
const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, 'public');
const fW = path.join(pub, 'drone-worklet.js'), fE = path.join(pub, 'drone-sound.js');
if (!fs.existsSync(fW) || !fs.existsSync(fE)) { console.log('✗ انسخ drone-sound.js و drone-worklet.js إلى public/ أولاً'); process.exit(1); }
let W = fs.readFileSync(fW, 'utf8'), E = fs.readFileSync(fE, 'utf8');
if (W.includes('NIVO-SND') && E.includes('NIVO-SND')) { console.log('✓ التعديلات مطبّقة مسبقاً'); process.exit(0); }
const fails = [], count = (s, a) => s.split(a).length - 1;
const once = (s, a, b, tag) => { const n = count(s, a); if (n !== 1) { fails.push(`${tag} (وُجد ${n} مرة)`); return s; } return s.replace(a, () => b); };

// ---- drone-worklet.js ----
// 1) خيارات المعالج (OS وغيرها) كانت تُهمَل لأن المنشئ لا يقرأ options.processorOptions
W = once(W, 'constructor() {', 'constructor(options) {', 'worklet:ctor');
W = once(W, '}, this.processorOptions || {});', '}, (options && options.processorOptions) || {});', 'worklet:opts');
// 2) كتلة الحمولة ترفع دوران المراوح (rpmHoverAdj كان يُحسب ولا يُستعمل)
W = once(W, 'var base = C.rpmIdle + (C.rpmMax - C.rpmIdle) * Math.pow(cl(S.coll, 0, 1), C.rpmExp);',
  'var base = (C.rpmIdle + (C.rpmMax - C.rpmIdle) * Math.pow(cl(S.coll, 0, 1), C.rpmExp)) * (1 + (C.totalAddedMass || 0) / (C.massKg || 1.4) * 0.12 * cl(S.coll, 0, 1));', 'worklet:mass');
// 3) أصوات الحمولة: أزيز الليدار + طنين الجيمبل + صفير السحب (كانت تُرسل ولا يعالجها الـ worklet)
W = once(W, 'this.windT = new Biquad(); this.windBP = new Biquad();', 'this.windT = new Biquad(); this.windBP = new Biquad(); this.phL = 0; this.phG = 0; this.gz = 0; this.whB = new Biquad(); /* NIVO-SND */', 'worklet:fields');
W = once(W, "this.windBP.set('BP', cl(120 + tipV * 9, 60, sr * 0.45), 0.5, 0, sr);", "this.windBP.set('BP', cl(120 + tipV * 9, 60, sr * 0.45), 0.5, 0, sr); this.whB.set('BP', 2400 + 1600 * adv, 6, 0, sr);", 'worklet:whistle');
W = once(W, '+ sub * dirTone;',
  '+ sub * dirTone;\n' +
  '      if (C.lidarHz > 0) { this.phL += C.lidarHz * incS; if (this.phL >= 1) this.phL -= 1; xm += (sl(this.phL) * 0.6 + sl((this.phL * 2) % 1) * 0.25) * 0.02; }\n' +
  '      if (C.gimbleHum > 0) { this.phG += C.gimbleHum * incS; if (this.phG >= 1) this.phG -= 1; this.gz += (rnd() - this.gz) * 0.4; xm += (sl(this.phG) * 0.5 + this.gz * 0.5) * 0.008; }\n' +
  '      if (C.dragWhistle > 0) xm += this.whB.x(rnd()) * C.dragWhistle * adv * 3;', 'worklet:payload');

// ---- drone-sound.js ----
// 4) مستوى الصوت العام يتغيّر حياً + 5) setCombo تقبل حمولة مفردة أو مصفوفة
E = once(E, "this.node.port.postMessage({ type: 'cfg', v: clean });",
  "this.node.port.postMessage({ type: 'cfg', v: clean });\n    if ('masterVolume' in clean && this.master && this.ctx) { try { this.master.gain.setTargetAtTime(cl(+clean.masterVolume, 0, 1.5), this.ctx.currentTime, 0.05); } catch (_) {} } /* NIVO-SND */", 'sound:volume');
E = once(E, 'var devices = COMBO_PRESETS[comboName] || [];', 'var devices = Array.isArray(comboName) ? comboName : (COMBO_PRESETS[comboName] || (PAYLOADS[comboName] ? [comboName] : []));', 'sound:combo');

if (fails.length) { console.log('✗ لم يتغيّر أي ملف. المشاكل:'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
['drone-worklet.js', 'drone-sound.js'].forEach(f => { const b = path.join(pub, f + '.orig'); if (!fs.existsSync(b)) fs.copyFileSync(path.join(pub, f), b); });
fs.writeFileSync(fW, W); fs.writeFileSync(fE, E);
console.log('✓ عُدّل المحرّك (نسخة أصلية: public/*.orig)');
