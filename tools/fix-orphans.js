// يضيف إلى main.js استيراداً جانبياً (import './x.js') لكل وحدة محلية يتيمة:
// وحدة لا يستوردها أي ملف ولا تُحمَّل من index.html (تبقى ميتة في المتصفح — كما حدث مع tabs.js).
// الاستعمال: node --expose-internals tools/fix-orphans.js [--dry]
const fs = require('fs'), path = require('path');
const { analyze } = require('./ast-scope.js');
const pub = path.join(__dirname, '..', 'public'), mainF = path.join(pub, 'main.js'), dry = process.argv.includes('--dry');
const DYNAMIC = new Set(['drone-sound.js', 'drone-worklet.js']);        // تُحمَّل ديناميكياً من drone.js
const files = fs.readdirSync(pub).filter(f => f.endsWith('.js') && !f.includes('.bak') && !f.endsWith('.orig'));
const html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
const inHtml = new Set([...html.matchAll(/<script[^>]*src="\/?([\w.-]+\.js)"/g)].map(m => m[1]));
const imported = new Set();
files.forEach(f => [...fs.readFileSync(path.join(pub, f), 'utf8').matchAll(/^\s*import\s+(?:[^'"\n]*?from\s+)?['"]\.\/([\w.-]+\.js)['"]/gm)].forEach(m => imported.add(m[1])));
const orphans = files.filter(f => !imported.has(f) && !inHtml.has(f) && !DYNAMIC.has(f));
if (!orphans.length) { console.log('✓ لا وحدات يتيمة'); process.exit(0); }
const src = fs.readFileSync(mainF, 'utf8'), { ast } = analyze(src);
const last = ast.body.filter(n => n.type === 'ImportDeclaration').pop(), at = src.indexOf('\n', last.end - 1) + 1;
const add = orphans.map(f => `import './${f}';\n`).join('');
console.log((dry ? '(تجربة) ' : '') + 'يتيمة: ' + orphans.join(', ') + ' ← تُضاف إلى main.js');
if (!dry) fs.writeFileSync(mainF, src.slice(0, at) + add + src.slice(at));
