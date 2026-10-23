#!/bin/bash
# تهيئة SDLC: أرشفة سكربتات الترقيع (نقل لا حذف)، .gitignore، git، اختبار، وسم baseline
cd ~/nivo-trainer || { echo "✗ المجلد ~/nivo-trainer غير موجود"; exit 1; }
for f in docs/SDLC.md tests/run.js tests/world-smoke.js tools/gen-api.js AGENTS.md; do
  [ -f "$f" ] || { echo "✗ ملف ناقص: $f — أنشئه أولاً"; exit 1; }
done
if ! grep -q "NIVO-V10" public/world.js 2>/dev/null; then echo "✗ طبّق patch-v10 أولاً (وجرّبه على الهاتف) ثم أعد تشغيل هذا السكربت"; exit 1; fi

mkdir -p archive/patches
for f in patch-v*.js patch-sound.js; do [ -e "$f" ] && mv -n "$f" archive/patches/; done
[ -d patch ] && [ ! -e archive/patches/patch ] && mv -n patch archive/patches/patch
echo "✓ سكربتات الترقيع نُقلت إلى archive/patches (لم يُحذف شيء)"

cat > .gitignore << 'IGN'
node_modules/
*.bak
*.orig
*.tgz
.DS_Store
IGN

node tools/gen-api.js
echo "── تشغيل الاختبارات ──"
node tests/run.js || { echo "✗ الاختبارات فشلت: لن أنشئ baseline. أصلح أو أرسل لي الناتج."; exit 1; }

if command -v git >/dev/null 2>&1; then
  [ -d .git ] || git init -q
  git config user.name  >/dev/null 2>&1 || git config user.name  "nivo-dev"
  git config user.email >/dev/null 2>&1 || git config user.email "nivo@localhost"
  git checkout -q -B main 2>/dev/null
  git add -A && git commit -q -m "baseline v10" && git tag -f v10-baseline >/dev/null
  echo "✓ git: $(git log --oneline | head -1)  ·  وسم v10-baseline"
else
  echo "⚠ git غير مثبّت. الخيارات:"
  echo "   • pkg install git   (تنزيل — شغّل أولاً: pkg show git | grep -i size  لترى الحجم)"
  echo "   • أو استعمل: bash tools/snapshot.sh   قبل كل مهمة"
  bash tools/snapshot.sh
fi
echo "✓ جاهز. الخطوة التالية: docs/BACKLOG.md (B-002 اختبار الهاتف)"
