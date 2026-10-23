// يطبّق ردّ ذكاء آخر بأمان: يقبل كتل cat فقط داخل الملفات المسموحة في بطاقة المهمة،
// يأخذ نسخة احتياطية، يشغّل الاختبارات، ويستعيد كل شيء إن فشلت أو إن قلّ عددها.
// الاستعمال: node tools/apply-reply.js T-001 reply.txt [--dry]
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { loadTask, isAllowed, root } = require('./task-lib');
const [id, replyFile, flag] = process.argv.slice(2);
if (!id || !replyFile) { console.log('الاستعمال: node tools/apply-reply.js T-001 reply.txt [--dry]'); process.exit(1); }
let t; try { t = loadTask(id); } catch (e) { console.log('✗ ' + e.message); process.exit(1); }
const txt = fs.readFileSync(replyFile, 'utf8');
const re = /cat\s*>\s*['"]?([^\s'"<>|;&]+)['"]?\s*<<\s*['"]?(\w+)['"]?[ \t]*\r?\n([\s\S]*?)\r?\n\2[ \t]*(?=\r?\n|$)/g;
const blocks = []; let m;
while ((m = re.exec(txt))) blocks.push({ rel: m[1].replace(/^~\/nivo-trainer\//, '').replace(/^\.\//, ''), body: m[3] + '\n' });
if (!blocks.length) { console.log('✗ لم أجد أي كتلة cat > ... << EOF في الرد'); process.exit(1); }
const bad = blocks.filter(b => path.isAbsolute(b.rel) || b.rel.split('/').includes('..') || !isAllowed(b.rel, t.allow));
console.log(`الكتل: ${blocks.map(b => b.rel).join(', ')}`);
if (bad.length) { console.log('✗ مرفوض — ملفات خارج المسموح (' + t.allow.join(', ') + '):\n  ' + bad.map(b => b.rel).join('\n  ') + '\nلم يُكتب شيء.'); process.exit(1); }
if (flag === '--dry') { console.log('✓ (تجربة) كل الكتل ضمن المسموح. لم يُكتب شيء.'); process.exit(0); }

const runTests = () => { const r = cp.spawnSync(process.execPath, ['tests/run.js'], { cwd: root, encoding: 'utf8' }); const mm = /النتيجة: (\d+) نجح · (\d+) فشل/.exec(r.stdout || ''); return { ok: r.status === 0, pass: mm ? +mm[1] : 0, fail: mm ? +mm[2] : 99, out: r.stdout || '' }; };
const base = runTests();
if (!base.ok) { console.log('✗ الاختبارات تفشل قبل التطبيق أصلاً — أصلحها أو اعرض الناتج على Claude:\n' + base.out.split('\n').slice(-12).join('\n')); process.exit(1); }
const ts = new Date().toISOString().replace(/[:.]/g, '-'), bk = path.join(root, '.apply-backup', id + '-' + ts), created = [];
blocks.forEach(b => {
  const p = path.join(root, b.rel);
  if (fs.existsSync(p)) { fs.mkdirSync(path.dirname(path.join(bk, b.rel)), { recursive: true }); fs.copyFileSync(p, path.join(bk, b.rel)); } else created.push(b.rel);
  fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, b.body);
});
const after = runTests();
const fewer = !t.relaxTests && after.pass < base.pass;
if (!after.ok || fewer) {
  blocks.forEach(b => {
    const p = path.join(root, b.rel), saved = path.join(bk, b.rel);
    if (created.includes(b.rel)) { const dst = path.join(bk, '_new', b.rel); fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.renameSync(p, dst); }
    else fs.copyFileSync(saved, p);
  });
  console.log(fewer && after.ok ? `✗ تراجع عدد الاختبارات الناجحة (${base.pass} ← ${after.pass}): رُفض التطبيق واستُعيدت الملفات.` : '✗ فشلت الاختبارات بعد التطبيق، استُعيدت الملفات:\n' + after.out.split('\n').filter(l => l.includes('✗')).slice(0, 8).join('\n'));
  console.log('النسخ في: ' + path.relative(root, bk) + ' (لم يُحذف شيء)'); process.exit(1);
}
console.log(`✓ طُبّق بنجاح: الاختبارات ${base.pass} ← ${after.pass} · نسخة احتياطية: ${path.relative(root, bk)}`);
try { console.log(cp.execSync('git status --short', { cwd: root, encoding: 'utf8' })); } catch (_) {}
