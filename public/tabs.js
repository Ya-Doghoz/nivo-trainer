// التبويبات — استُخرج من main.js (B-003)
import { $$, $ } from './util.js';
import { elSheet } from './ctx.js';

$$('#tabs [data-t]').forEach(b => (b.onclick = () => {
  $$('#tabs [data-t]').forEach(x => x.classList.toggle('on', x === b));
  $$('#panels section').forEach(s => s.classList.toggle('on', s.id === b.dataset.t));
  elSheet.classList.remove('min');
}));
$('#sheetToggle').onclick = () => elSheet.classList.toggle('min');
