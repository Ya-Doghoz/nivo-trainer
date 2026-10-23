// مكتبة مشتركة: قراءة بطاقة مهمة واستخراج الملفات المسموحة
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
function loadTask(id) {
  const dir = path.join(root, 'tasks');
  const f = fs.readdirSync(dir).find(n => n.endsWith('.md') && (n.startsWith(id + '-') || n === id + '.md'));
  if (!f) throw new Error('لا توجد بطاقة للمهمة ' + id + ' في tasks/');
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  const line = text.split('\n').find(l => l.includes('الملفات المسموحة')) || '';
  const allow = [...line.matchAll(/`([^`]+)`/g)].map(m => m[1].trim()).filter(p => /[\/.]/.test(p));
  if (!allow.length) throw new Error('البطاقة ' + f + ' بلا سطر «الملفات المسموحة» صالح');
  return { id, file: path.join('tasks', f), text, allow, root, relaxTests: text.includes('allow-fewer-tests') };
}
const isAllowed = (rel, allow) => allow.some(a => (a.endsWith('/') ? rel.startsWith(a) : rel === a));
module.exports = { loadTask, isAllowed, root };
