#!/bin/bash
# ربط المستودع المحلي بـ GitHub ودفع أول نسخة.
# الاستعمال: bash tools/gh-setup.sh https://github.com/USER/REPO.git [--store]
#   --store : يحفظ التوكن نصاً صريحاً في ~/.git-credentials (بدونه يُسأل عند كل دفع)
cd ~/nivo-trainer || exit 1
URL="$1"; [ -n "$URL" ] || { echo "الاستعمال: bash tools/gh-setup.sh https://github.com/USER/REPO.git [--store]"; exit 1; }
[ -d .git ] || { echo "✗ لا يوجد git هنا — شغّل bash sdlc-init.sh أولاً"; exit 1; }
git rev-parse --verify main >/dev/null 2>&1 || { echo "✗ لا يوجد فرع main — شغّل bash sdlc-init.sh أولاً"; exit 1; }
if ! git diff --quiet || ! git diff --cached --quiet; then echo "⚠ توجد تغييرات غير ملتزَم بها (سيُدفع ما التُزم فقط). نفّذ git status للتفاصيل."; fi
for p in 'packets/' '.apply-backup/' 'public/models/*.glb'; do grep -qxF "$p" .gitignore 2>/dev/null || echo "$p" >> .gitignore; done
git add .gitignore && git commit -q -m "gitignore: packets, backups, models" 2>/dev/null
if git remote | grep -q '^origin$'; then git remote set-url origin "$URL"; else git remote add origin "$URL"; fi
[ "$2" = "--store" ] && git config credential.helper store
echo "حجم ما سيُرفع تقريباً: $(git count-objects -vH | awk '/size-pack|^size:/ {printf "%s ", $0}')"
echo "عند الطلب: اسم المستخدم = حسابك، وكلمة المرور = التوكن (Personal Access Token) — لا تكتبه في أي ملف ولا ترسله لأحد."
git push -u origin main && git push origin --tags && echo "✓ دُفع main والوسوم إلى $URL" || { echo "✗ فشل الدفع (إنترنت؟ توكن؟ صلاحية Contents/Workflows؟). لم يتغيّر شيء محلياً."; exit 1; }
