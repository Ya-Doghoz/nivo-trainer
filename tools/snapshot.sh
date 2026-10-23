#!/bin/bash
# نسخة احتياطية سريعة بلا git (لا تحذف شيئاً)
cd ~/nivo-trainer || exit 1
mkdir -p ~/nivo-snapshots
F=~/nivo-snapshots/nivo-$(date +%F-%H%M).tgz
tar czf "$F" --exclude='node_modules' --exclude='public/models' public server.js docs tasks tests tools AGENTS.md CHANGELOG.md 2>/dev/null
echo "✓ $F  ($(du -h "$F" | cut -f1))"
