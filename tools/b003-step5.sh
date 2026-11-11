#!/bin/bash
# B-003 خطوة 5: تفكيك العنقود المتشابك (بسجلّ الدوال المتأخر H لكسر 5 دورات فقط)
cd ~/nivo-trainer || exit 1
run() { node --expose-internals tools/extract-section.js "$@" 2>&1 || { echo "✗ توقّف عند: $1 — الوحدات السابقة سليمة ولم يتغيّر شيء بعدها"; exit 1; }; }
run camera "=الكاميرا الخارجية" --hook=toggleFull
run mount "=التركيب والأرجل"
run transfer "=نقل الجهاز / عالم جديد" --hook=renderPtBtns,renderMapList,drawMap,applyInstType
run map "=الخريطة|=الخريطة: المعالم وتحريك النقاط وتثبيتها|=سحب النقاط (أداة التحريك)"
run errors "=أخطاء الجهاز"
run device "=نوع الجهاز|=التسميات في العرض التفكيكي|=نافذة قراءة الدوائر (ميكروسكوب بمقياس دقائق) وكمانة الفهرس"
run pointing "=التوجيه (دوران أفقي لا نهائي + رأسي)"
run tt-tools "=أدوات التيودوليت والتاكيومتر"
run loop "=الإطار"
run settings-ui "=الإعدادات (واجهة)"
echo "✓ الخطوة 5 كاملة — main.js الآن: $(wc -l < public/main.js) سطراً"
