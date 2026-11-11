// اختبار field-math.js — الحسابات النقية للميزات الجديدة (T-003)
// التشغيل: node tests/field-math.js   (ينسخ الوحدة إلى ملف mjs مؤقت ثم يستوردها)
const fs = require('fs'), os = require('os'), path = require('path');
let pass = 0, fail = 0;
const ok = m => { pass++; console.log('PASS ' + m); };
const bad = m => { fail++; console.log('FAIL ' + m); };
const near = (a, b, eps, name) => Math.abs(a - b) <= eps ? ok(name) : bad(`${name}: المتوقع ${b} والفعلي ${a}`);
const DEG = Math.PI / 180, PI = Math.PI, TAU = Math.PI * 2;

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  const t = path.join(tmp, 'field-math.mjs');
  fs.copyFileSync(path.join(__dirname, '..', 'public', 'field-math.js'), t);
  fs.copyFileSync(path.join(__dirname, '..', 'public', 'survey-math.js'), path.join(tmp, 'survey-math.js'));
  const M = await import('file://' + t);

  console.log('أ) إدخال الزوايا');
  near(M.parseAngle('45'), 45 * DEG, 1e-12, 'parseAngle: درجات عشرية');
  near(M.parseAngle('45.5'), 45.5 * DEG, 1e-12, 'parseAngle: كسر عشري');
  near(M.parseAngle('45 30'), 45.5 * DEG, 1e-9, 'parseAngle: درجات دقائق');
  near(M.parseAngle('45 30 15'), (45 + 30 / 60 + 15 / 3600) * DEG, 1e-9, 'parseAngle: د-ق-ث');
  near(M.parseAngle(`45°30'15"`), (45 + 30 / 60 + 15 / 3600) * DEG, 1e-9, 'parseAngle: برموز DMS');
  near(M.parseAngle('٩٠'), 90 * DEG, 1e-12, 'parseAngle: أرقام عربية');
  (M.parseAngle('90 60') === null) ? ok('parseAngle: دقائق ≥ 60 مرفوضة') : bad('parseAngle: يقبل 60 دقيقة');
  (M.parseAngle('abc') === null) ? ok('parseAngle: نص غير رقمي مرفوض') : bad('parseAngle: يقبل نصاً');

  console.log('ب) المسار المساحي');
  const SQ = [{ x: 0, z: 0 }, { x: 100, z: 0 }, { x: 100, z: -100 }, { x: 0, z: -100 }];
  const legs = () => [0, 1, 2, 3].map(() => ({ d: 100, dir: PI / 2 }));
  const r1 = M.traverseCompute({ stations: SQ, legs: legs(), mode: 'ang', closed: true, startAz: null });
  near(r1.closure, 0, 1e-9, 'مسار مغلق مربع: خطأ الإغلاق = 0');
  near(r1.perimeter, 400, 1e-9, 'مسار مغلق مربع: المحيط = 400');
  near(r1.az0, 90 * DEG, 1e-9, 'مسار مغلق مربع: اتجاه أول ضلع من الخريطة = شرقاً');
  near(r1.angleSum, 360 * DEG, 1e-9, 'مسار مغلق مربع: مجموع الزوايا = 360°');
  near(r1.expSum, 360 * DEG, 1e-9, 'مسار مغلق مربع: المتوقع (n−2)·180°');
  r1.devs.every(d => d < 1e-9) ? ok('مسار مغلق مربع: انحراف كل محطة = 0') : bad('مسار مغلق مربع: انحراف غير صفري');
  r1.coords.slice(0, 4).every((c, i) => Math.abs(c.x - SQ[i].x) < 1e-9 && Math.abs(c.z - SQ[i].z) < 1e-9) && Math.abs(r1.coords[4].x) < 1e-9 && Math.abs(r1.coords[4].z) < 1e-9 ? ok('مسار مغلق مربع: الإحداثيات المحسوبة تطابق الحقيقية ويعود للبداية') : bad('مسار مغلق مربع: إحداثيات خاطئة');
  const lg2 = legs(); lg2[1].d = 101;
  const r2 = M.traverseCompute({ stations: SQ, legs: lg2, mode: 'ang', closed: true });
  near(r2.closure, 1, 1e-6, 'مسار مغلق: خبط طول 1 م → إغلاق 1 م');
  near(r2.denom, 401, 0, 'مسار مغلق: دقة المسار 1:401 (محيط 401 / إغلاق 1)');
  const lg3 = legs(); lg3[1].dir = PI;  // زاوية عند B = 180° بدل 90°
  const r3 = M.traverseCompute({ stations: SQ, legs: lg3, mode: 'ang', closed: true });
  near(r3.closure, Math.hypot(100, 100), 1e-6, 'مسار مغلق بزاوية خاطئة 180°: إغلاق = 141.42 م');
  r3.err === null ? ok('الإغلاق غير الصفري لا يمنع إرجاع النتيجة (err = null)') : bad('رسالة خطأ غير متوقعة');
  const L3 = [{ x: 0, z: 0 }, { x: 100, z: 0 }, { x: 100, z: -100 }];
  const r4 = M.traverseCompute({ stations: L3, legs: [{ d: 100, dir: 90 * DEG }, { d: 100, dir: 0 }], mode: 'az', closed: false });
  near(r4.closure, 0, 1e-9, 'مسار مفتوح باتجاهات: إغلاق = 0');
  const r5 = M.traverseCompute({ stations: L3, legs: [{ d: 100, dir: 90 * DEG }, { d: 100, dir: 90 * DEG }], mode: 'ang', closed: false });
  near(r5.closure, 0, 1e-9, 'مسار مفتوح بزوايا داخلية (زاوية B = 90°): إغلاق = 0');
  const r6 = M.traverseCompute({ stations: L3.slice(0, 2), legs: [{ d: 100, dir: null }], mode: 'az', closed: false });
  r6.err ? ok('مسار ناقص القيم: يعيد رسالة خطأ') : bad('مسار ناقص القيم: لا رسالة خطأ');

  console.log('ج) المضلعات');
  const ang = i => M.interiorAngleAt(SQ, i);
  [0, 1, 2, 3].forEach(i => near(ang(i), 90 * DEG, 1e-9, `زاوية رأس المربع ${i + 1} = 90°`));
  const LS = [{ x: 0, z: 0 }, { x: 20, z: 0 }, { x: 20, z: 10 }, { x: 10, z: 10 }, { x: 10, z: 20 }, { x: 0, z: 20 }];
  near(M.interiorAngleAt(LS, 3), 270 * DEG, 1e-9, 'زاوية الرأس المقعّر = 270°');
  near(LS.reduce((s, _, i) => s + M.interiorAngleAt(LS, i), 0), 4 * 180 * DEG, 1e-6, 'مجموع زوايا مسدس مقعّر = (n−2)·180°');
  const pc = M.polyCheck(SQ, [99, null, 101, 100], [90 * DEG, null, null, null]);
  near(pc.area, 10000, 1e-9, 'مساحة المربع = 10000 م²');
  near(pc.perimeter, 400, 1e-9, 'محيط المربع = 400 م');
  near(pc.edgeDiff[0], -1, 1e-9, 'فرق طول مُدخل 99 عن الفعلي 100 = −1');
  pc.edgeDiff[1] === null ? ok('ضلع بلا إدخال: فرقه null') : bad('ضلع بلا إدخال: فرق غير null');

  console.log('د) نقاط المسار (للمقطع)');
  const A = { x: 0, z: 0 }, B = { x: 100, z: 0 };
  const pts = [{ x: 50, z: 0, id: 'P1' }, { x: 50, z: 20, id: 'P2' }, { x: -5, z: 0, id: 'P3' }, { x: 80, z: 5, id: 'P4' }];
  const onl = M.pointsOnLine(pts, A, B, 12);
  (onl.length === 2 && onl[0].p.id === 'P1' && onl[0].d === 50 && onl[1].p.id === 'P4') ? ok('نقاط المسار: اثنتان ضمن الممر 12 م بترتيب d') : bad('نقاط المسار: ' + onl.map(o => o.p.id).join());
  onl[1].off === 5 ? ok('نقاط المسار: الانحراف الجانبي صحيح') : bad('نقاط المسار: انحراف خاطئ ' + onl[1].off);

  console.log('د2) تدوير اختيار المتقاربات (cyclePick — بديل المكبرة)');
  (M.cyclePick([], 'P1') === null) ? ok('cyclePick: لا مرشحين → null') : bad('cyclePick: قائمة فارغة ليست null');
  (M.cyclePick([{ id: 'P1' }], 'P1') && M.cyclePick([{ id: 'P1' }], 'P1').id === 'P1') ? ok('cyclePick: مرشح واحد يُعاد دائماً') : bad('cyclePick: مرشح واحد');
  const TWO = [{ id: 'P1' }, { id: 'P2' }];
  (M.cyclePick(TWO, null) && M.cyclePick(TWO, null).id === 'P1') ? ok('cyclePick: بلا سابق → الأقرب (P1)') : bad('cyclePick: بلا سابق');
  (M.cyclePick(TWO, 'P1') && M.cyclePick(TWO, 'P1').id === 'P2') ? ok('cyclePick: السابق P1 → التالي P2') : bad('cyclePick: تدوير إلى P2');
  (M.cyclePick(TWO, 'P2') && M.cyclePick(TWO, 'P2').id === 'P1') ? ok('cyclePick: السابق P2 → يعود إلى P1 (تدوير A,B,A…)') : bad('cyclePick: تدوير إلى P1');

  console.log('هـ) الكنتور (IDW + Marching Squares)');
  const ring = [[10, 10], [10, -10], [-10, 10], [-10, -10], [0, 10], [0, -10], [10, 0], [-10, 0]].map(([x, z]) => ({ x, z, v: 0 }));
  const pp = [{ x: 0, z: 0, v: 10 }, ...ring];
  const nx = 21, nz = 21, x0 = -10, z0 = -10, dx = 1, dz = 1;
  const g = M.idwGrid(pp, x0, z0, nx, nz, dx, dz);
  near(g[10 * nx + 10], 10, 1e-12, 'IDW: قيمة مركز البيانات نفسها');
  near(g[0 * nx + 0], 0, 1e-12, 'IDW: قيمة نقطة الزاوية نفسها');
  const one = M.idwGrid([{ x: 3, z: 4, v: 7 }], 0, 0, 5, 5, 2, 2);
  [...one].every(v => Math.abs(v - 7) < 1e-12) ? ok('IDW: نقطة واحدة → سطح ثابت') : bad('IDW: نقطة واحدة ليست ثابتة');
  const lines = M.marchingSquares(g, nx, nz, 5, x0, z0, dx, dz);
  lines.length === 1 ? ok('marching squares: خط واحد حول القمة عند 5 م') : bad('marching squares: عدد الخطوط ' + lines.length);
  if (lines.length === 1) {
    const ln = lines[0];
    const closed = Math.hypot(ln[0][0] - ln[ln.length - 1][0], ln[0][1] - ln[ln.length - 1][1]) <= 1.5;
    const inside = ln.every(p => Math.hypot(p[0], p[1]) <= 8.5);
    closed ? ok('marching squares: الخط مغلق') : bad('marching squares: الخط غير مغلق');
    inside ? ok('marching squares: الخط يحيط بالقمة ضمن نصف قطر 8.5 م') : bad('marching squares: الخط خارج القمة');
  }
  const outer = M.marchingSquares(g, nx, nz, 8, x0, z0, dx, dz);
  outer.length === 1 && Math.hypot(outer[0][0][0], outer[0][0][1]) < Math.hypot(lines[0][0][0], lines[0][0][1]) ? ok('marching squares: خط 8 م أصغر من خط 5 م') : bad('marching squares: ترتيب الخطوط بالمنسوب خاطئ');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`field-math: ${pass} نجح · ${fail} فشل`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('FAIL انهيار: ' + e.message); process.exit(1); });
