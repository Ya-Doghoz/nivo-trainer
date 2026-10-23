// يبني «حزمة سياق» لمهمة واحدة تُلصق كاملة في ذكاء لا يصل إلى GitHub
// الاستعمال: node tools/task-packet.js T-001      ← يكتب packets/T-001.txt
const fs = require('fs'), path = require('path');
const { loadTask, root } = require('./task-lib');
const id = process.argv[2];
if (!id) { console.log('الاستعمال: node tools/task-packet.js T-001'); process.exit(1); }
let t; try { t = loadTask(id); } catch (e) { console.log('✗ ' + e.message); process.exit(1); }
const rd = f => { const p = path.join(root, f); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; };
const out = [];
out.push(`# حزمة المهمة ${id}`, 'أنت منفّذ في مشروع «مدرّب أجهزة المسح». التزم حرفياً بالقواعد أدناه، وعدّل فقط الملفات المسموحة، وأعد الملفات كاملة بصيغة cat كما في القواعد. لا تشرح كثيراً.', '');
['AGENTS.md', 'docs/ARCHITECTURE.md', 'docs/API.md'].forEach(f => { const s = rd(f); if (s) out.push(`=== ${f} ===`, s, ''); });
out.push(`=== بطاقة المهمة (${t.file}) ===`, t.text, '', '=== المحتوى الحالي للملفات المسموحة ===');
let big = 0;
t.allow.forEach(f => {
  const s = rd(f);
  if (s === null) { out.push(`--- FILE: ${f} (ملف جديد — غير موجود بعد) ---`, ''); return; }
  if (s.length > 40000) big++;
  out.push(`--- FILE: ${f} ---`, '```', s.replace(/\n$/, ''), '```', '');
});
out.push('=== المطلوب الآن ===', `نفّذ المهمة ${id}. أعد كل ملف تغيّر كاملاً بصيغة:`, "cat > المسار << 'EOF'", '...المحتوى...', 'EOF', 'ثم اكتب: كيف أجرّبها يدوياً، والمخاطر.');
fs.mkdirSync(path.join(root, 'packets'), { recursive: true });
const file = path.join(root, 'packets', id + '.txt'), txt = out.join('\n');
fs.writeFileSync(file, txt);
const kb = (txt.length / 1024).toFixed(0);
console.log(`✓ packets/${id}.txt  —  ${kb} ك.ب · ${txt.split('\n').length} سطراً · الملفات المسموحة: ${t.allow.join(', ')}`);
if (txt.length > 60000) console.log('⚠ الحزمة كبيرة؛ قد ترفضها الواجهات المجانية. قلّص الملفات المسموحة أو قسّم المهمة.');
if (big) console.log('⚠ بين الملفات المسموحة ملف يتجاوز 40 ك.ب — علامة على أن الوحدة أكبر مما يلزم (انظر B-003).');
console.log('انسخه: cat packets/' + id + '.txt   (أو افتحه من مدير الملفات وألصقه في الذكاء الآخر)');
