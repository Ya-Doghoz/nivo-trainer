// إعدادات العالم: جودة شبكة التضاريس ومولّد العالم — تُحفظ في المتصفح وتُطبَّق عند «🌍 عالم جديد»
const KEY = 'nivo.world.cfg';
export const WDEF = { quality: 'balanced', gen: 'classic' };
function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; } }
export const WC = Object.assign({}, WDEF, load());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(WC)); } catch (_) {} };
const QUALITY = [['balanced', 'متوازن — أخف (شبكة 2.4 / 4 / 20 م)'], ['precise', 'دقة أولاً — أدق (شبكة 2 / 4 / 10 م، تحتاج ذاكرة أكثر)']];
const GEN = [['classic', 'المولّد الحالي (classic)']];     // مولّدات واقعية جديدة ستُضاف هنا (انظر ADR-0002)
(function mount() {
  const t5 = document.querySelector('#t5'); if (!t5) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = '<div class="row"><button id="btnWorldCfg" class="big">🌍 العالم والتضاريس</button></div><div id="worldCfgBox" style="display:none"></div>';
  t5.appendChild(wrap);
  const box = wrap.querySelector('#worldCfgBox');
  const row = (label, opts, key) => {
    const d = document.createElement('div'); d.className = 'row'; d.style.flexWrap = 'wrap';
    const l = document.createElement('label'); l.textContent = label; const s = document.createElement('select');
    opts.forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; s.appendChild(o); });
    s.value = WC[key]; s.onchange = () => { WC[key] = s.value; save(); const n = box.querySelector('.wnote'); if (n) n.textContent = '✓ حُفظ. اضغط «🌍 عالم جديد» ليُطبَّق.'; };
    d.appendChild(l); d.appendChild(s); box.appendChild(d);
  };
  wrap.querySelector('#btnWorldCfg').onclick = () => {
    const on = box.style.display === 'none'; box.style.display = on ? 'block' : 'none';
    if (on && !box.children.length) {
      row('دقة شبكة التضاريس', QUALITY, 'quality'); row('مولّد العالم', GEN, 'gen');
      const n = document.createElement('p'); n.className = 'note wnote'; n.textContent = 'التغيير يُطبَّق عند «🌍 عالم جديد». «دقة أولاً» تُنتج أرضاً أدق في المناطق البعيدة لكنها أثقل على الهاتف.'; box.appendChild(n);
    }
  };
})();
