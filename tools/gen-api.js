// يولّد docs/API.md من الكود نفسه (صادرات كل وحدة + مفاتيح window.NIVO) — لا يُعدَّل يدوياً
// الاستعمال: node tools/gen-api.js
const fs = require('fs'), path = require('path');
const pub = path.join(__dirname, '..', 'public'), out = [];
out.push('# واجهات الوحدات (مولَّد آلياً — لا تعدّله يدوياً)\n', 'لتحديثه: `node tools/gen-api.js`\n');
fs.readdirSync(pub).filter(f => f.endsWith('.js') && !f.includes('.bak') && !f.endsWith('.orig')).sort().forEach(f => {
  const s = fs.readFileSync(path.join(pub, f), 'utf8'), lines = s.split('\n').length;
  const ex = [...s.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([\w$]+)/gm)].map(m => m[1]);
  const im = [...s.matchAll(/^import\s+(?:\*\s+as\s+(\w+)|\{([^}]*)\})\s+from\s+'([^']+)'/gm)].map(m => `${m[3]} ← ${(m[1] ? '* as ' + m[1] : m[2].trim().replace(/\s+/g, ' '))}`);
  const nv = [...s.matchAll(/Object\.assign\(window\.NIVO[^,]*,\s*\{([^}]*)\}/g)].map(m => m[1].replace(/\s+/g, ' ').trim());
  out.push(`## ${f}  (${lines} سطر)`);
  if (ex.length) out.push('- **يصدّر:** ' + ex.map(e => '`' + e + '`').join('، '));
  if (im.length) out.push('- **يستورد:**\n' + im.map(i => '  - ' + i).join('\n'));
  if (nv.length) out.push('- **يضيف إلى window.NIVO:** `' + nv.join(' | ') + '`');
  if (!ex.length && !im.length && !nv.length) out.push('- (سكربت عادي بلا وحدات)');
  out.push('');
});
fs.mkdirSync(path.join(__dirname, '..', 'docs'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'API.md'), out.join('\n'));
console.log('✓ docs/API.md');
