#!/bin/bash
# B-003 خطوتا 3 و4: يستخرج 8 وحدات من main.js بالترتيب (كل أمر يختبر ويستعيد عند الفشل)
cd ~/nivo-trainer || exit 1
run() { node --expose-internals tools/extract-section.js "$@" 2>&1 || { echo "✗ توقّف عند: $1 — الوحدات السابقة سليمة ولم يتغيّر شيء بعدها"; exit 1; }; }
run steps "الخطوات" --hoist=flags
run job "المهمة (Job) والحالة"
run books-level "دفتر مناسيب النيفو" --hoist=say@util
run books-tt "دفتر التيودوليت والتاكيومتر|تيودوليت رقمي|تاكيومتر يدوي|تاكيومتر آلي"
run ctx "=الإعدادات" --pick=FOV
run tabs "=التبويبات"
run sight "=النظر في الهدف"
run leveling "=التسوية (لوحة البراغي)" --pick=LC
echo "✓ الخطوتان 3 و4 كاملتان — main.js الآن: $(wc -l < public/main.js) سطراً"
