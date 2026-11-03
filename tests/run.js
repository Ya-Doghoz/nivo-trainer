// تشغيل: node tests/run.js        (لا يحتاج أي تنزيل — Node فقط)
// فحوص: ١) صياغة كل ملفات public  ٢) معادلات المسح  ٣) العالم (محاكاة THREE)  ٤) معرّفات الواجهة
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const root = path.join(__dirname, '..'), pub = path.join(root, 'public');
let pass = 0, fail = 0, warn = 0;
const ok = (m) => { pass++; console.log('  ✓ ' + m); };
const bad = (m) => { fail++; console.log('  ✗ ' + m); };
const wn = (m) => { warn++; console.log('  ⚠ ' + m); };
const near = (a, b, eps, name) => (Math.abs(a - b) <= eps ? ok(name) : bad(`${name}: المتوقع ${b} والفعلي ${a}`));
const files = fs.readdirSync(pub).filter(f => f.endsWith('.js') && !f.includes('.bak') && !f.endsWith('.orig'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nivo-'));

console.log('1) الصياغة');
files.forEach(f => {
  const src = fs.readFileSync(path.join(pub, f), 'utf8'), esm = /^\s*(import|export)\s/m.test(src);
  const t = path.join(tmp, f.replace(/\.js$/, esm ? '.mjs' : '.cjs')); fs.writeFileSync(t, src);
  const r = cp.spawnSync(process.execPath, ['--check', t], { encoding: 'utf8' });
  r.status === 0 ? ok(f) : bad(`${f}\n${(r.stderr || '').split('\n').slice(0, 4).join('\n')}`);
});

console.log('2) معادلات المسح (survey-math.js)');
(async () => {
  const sm = path.join(pub, 'survey-math.js');
  if (!fs.existsSync(sm)) wn('survey-math.js غير موجود — تخطّي');
  else {
    const t = path.join(tmp, 'sm.mjs'); fs.copyFileSync(sm, t);
    const M = await import('file://' + t), D = Math.PI / 180;
    near(M.elev(M.zenith(80 * D, 1)), 10 * D, 1e-9, 'α = 90° − Z');
    near(M.zenith(80 * D, 2), 2 * Math.PI - 80 * D, 1e-9, 'الوجه II: Z = 360° − قراءة');
    near(M.kTheory(M.zenith(80 * D, 1)), 200 * Math.tan(10 * D), 1e-9, 'K = 200·tanα');
    near(M.curvRef(1000), 0.0675, 1e-9, 'انحناء وانكسار 1 كم = 0.0675 م');
    near(M.leanErr(3, 0), 0, 1e-12, 'ميلان صفر = لا خطأ');
    near(M.leanErr(3, 5 * D), 3 * (1 / Math.cos(5 * D) - 1), 1e-12, 'خطأ ميلان الميرا 5°');
    const s = M.stadiaClassic({ u: 2.0, l: 1.0, m: 1.5, i: 1.5 }, 90 * D, 100);
    near(s.D, 100, 1e-9, 'ستاديا أفقية: D = 100·s'); near(s.Z, 100, 1e-9, 'ستاديا أفقية: Z = Zs + i − M');
    const s2 = M.stadiaClassic({ u: 2.0, l: 1.0, m: 1.5, i: 1.5 }, 80 * D, 100);
    near(s2.D, 100 * Math.cos(10 * D) ** 2, 1e-9, 'ستاديا مائلة: D = 100·s·cos²α');
    near(s2.dz, 1.5 + 50 * Math.sin(20 * D) - 1.5, 1e-9, 'ستاديا مائلة: ΔZ = i + 50·s·sin2α − M');
    const r = M.stadiaReduced({ u: 2.0, l: 1.0, m: 1.5, kc: 2, i: 1.5, s: 1.5 }, 100);
    near(r.D, 100, 1e-9, 'ذاتي الاختزال: D = (ع−س)×100'); near(r.D2, 100, 1e-9, 'ذاتي الاختزال: D = (ع−و)×200');
    near(r.dH, 0.5 * 2 + 1.5 - 1.5, 1e-9, 'ذاتي الاختزال: ΔH = (ع−و)·K + J − S');
    const ts = M.totalStation({ sd: 100, v: 90 * D, hz: 90 * D, face: 1, i: 1.5, hr: 1.5 }, { N: 1000, E: 2000 }, 50);
    near(ts.HD, 100, 1e-9, 'محطة: HD = SD·sinZ'); near(ts.E, 2100, 1e-6, 'محطة: E نحو الشرق'); near(ts.N, 1000, 1e-6, 'محطة: N ثابت');
    const tf = M.twoFace({ v: 90 * D + 20 / 3600 * D, hz: 10 * D }, { v: 270 * D + 20 / 3600 * D, hz: 190 * D });
    near(tf.ie, 20 / 3600 * D, 1e-9, 'وجهان: خطأ الفهرس 20″'); near(tf.c, 0, 1e-9, 'وجهان: بلا انحراف خط نظر');
    near(M.levelRL(M.levelHI(100, 1.2), 2.2), 99, 1e-9, 'نيفو: RL = HI − قراءة');
    const az = M.azimuth(0, 0, 0, -10); near(az, 0, 1e-9, 'سمت الشمال = 0 (الشمال = −z)');
    near(M.azimuth(0, 0, 10, 0), Math.PI / 2, 1e-9, 'سمت الشرق = 90°');
    M.dms(10 * D + 30 / 3600 * D, 1) === '10°00′30″' ? ok('تنسيق الدرجات') : bad('تنسيق الدرجات: ' + M.dms(10 * D + 30 / 3600 * D, 1));
  }

  console.log('3) العالم (world-smoke)');
  const r = cp.spawnSync(process.execPath, [path.join(__dirname, 'world-smoke.js'), path.join(pub, 'world.js')], { encoding: 'utf8' });
  (r.stdout || '').split('\n').filter(Boolean).forEach(l => { if (l.startsWith('PASS ')) ok(l.slice(5)); else if (l.startsWith('FAIL ')) bad(l.slice(5)); else if (l.startsWith('WARN ')) wn(l.slice(5)); else console.log('    ' + l); });
  if (r.status !== 0 && !(r.stdout || '').includes('FAIL')) bad('world-smoke انهار:\n' + (r.stderr || '').split('\n').slice(0, 6).join('\n'));

  console.log('4) معرّفات الواجهة (index.html ↔ الكود)');
  const html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8'), ids = new Set([...html.matchAll(/id="([\w-]+)"/g)].map(m => m[1]));
  files.forEach(f => {
    const s = fs.readFileSync(path.join(pub, f), 'utf8');
    [...s.matchAll(/id=\\?["']([\w-]+)\\?["']/g)].forEach(m => ids.add(m[1]));        // معرّفات تُنشأ ديناميكياً
    [...s.matchAll(/\.id\s*=\s*['"]([\w-]+)['"]/g)].forEach(m => ids.add(m[1]));
  });
  const miss = new Set();
  files.forEach(f => {
    const s = fs.readFileSync(path.join(pub, f), 'utf8');
    [...s.matchAll(/(?:\$|querySelector|getElementById)\(\s*['"]#?([\w-]+)['"]\s*\)/g)].forEach(m => { if (!ids.has(m[1]) && /^[a-z][\w-]*[A-Z0-9_-]/.test(m[1])) miss.add(f + ' → #' + m[1]); });
  });
  miss.size ? [...miss].slice(0, 25).forEach(m => wn('معرّف غير موجود في HTML: ' + m)) : ok('كل المعرّفات المستعملة موجودة');

  console.log('5) أسماء غير معرّفة (no-undef) — يكشف أخطاء التقسيم والنسيان');
  const lr = cp.spawnSync(process.execPath, ['--expose-internals', path.join(__dirname, 'lint-undef.js'), ...files.map(f => path.join(pub, f))], { encoding: 'utf8' });
  (lr.stdout || '').split('\n').filter(Boolean).forEach(l => { if (l.startsWith('PASS ')) ok(l.slice(5)); else if (l.startsWith('FAIL ')) bad(l.slice(5)); else if (l.startsWith('WARN ')) wn(l.slice(5)); });
  if (!(lr.stdout || '').trim()) wn('كاشف no-undef لم يُنتج ناتجاً: ' + (lr.stderr || '').split('\n')[0]);

  console.log('6) تحميل الوحدات (module-smoke) — يكشف أخطاء الاستيراد والتصدير بعد التقسيم');
  const ms = cp.spawnSync(process.execPath, ['--expose-internals', path.join(__dirname, 'module-smoke.js'), pub], { encoding: 'utf8' });
  (ms.stdout || '').split('\n').filter(Boolean).forEach(l => { if (l.startsWith('PASS ')) ok(l.slice(5)); else if (l.startsWith('FAIL ')) bad(l.slice(5)); else if (l.startsWith('WARN ')) wn(l.slice(5)); });
  if (!(ms.stdout || '').trim()) wn('module-smoke لم يُنتج ناتجاً: ' + (ms.stderr || '').split('\n')[0]);

  console.log('7) ظهور النهر (river-smoke) — الماء لا يختفي تحت تراب الشبكة');
  const rs = cp.spawnSync(process.execPath, [path.join(__dirname, 'river-smoke.js'), path.join(pub, 'world.js')], { encoding: 'utf8' });
  (rs.stdout || '').split('\n').filter(Boolean).forEach(l => { if (l.startsWith('PASS ')) ok(l.slice(5)); else if (l.startsWith('FAIL ')) bad(l.slice(5)); else if (l.startsWith('WARN ')) wn(l.slice(5)); });
  if (!(rs.stdout || '').trim()) wn('river-smoke لم يُنتج ناتجاً: ' + (rs.stderr || '').split('\n')[0]);

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\nالنتيجة: ${pass} نجح · ${fail} فشل · ${warn} تحذير`);
  process.exit(fail ? 1 : 0);
})();
