#!/bin/bash
# يجمع المشروع للإرسال: بدون node_modules ولا النماذج الكبيرة ولا النسخ الاحتياطية
cd ~/nivo-trainer || exit 1
OUT=~/nivo-pack.tgz
tar czf "$OUT" --exclude='node_modules' --exclude='public/models' --exclude='*.bak' --exclude='*.orig' --exclude='.git' --exclude='*.tgz' \
  public server.js package.json docs tasks tests tools AGENTS.md CHANGELOG.md archive 2>/dev/null
echo "✓ $OUT  ($(du -h "$OUT" | cut -f1))"
