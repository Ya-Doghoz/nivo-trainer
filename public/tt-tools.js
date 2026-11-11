// أدوات التيودوليت والتاكيومتر — استُخرج من main.js (B-003)
import { $, toast, TAU, numOrNull } from './util.js';
import * as I from './instrument.js';
import { setHeading, setVz } from './pointing.js';
import { scopeCam } from './ctx.js';
import { setPrismHeight } from './targets.js';

$('#btn0Set').onclick = () => { if (!I.st.mounted) return toast('ركّب الجهاز أولاً'); I.st.hz0 = I.st.heading; toast('Hz = 0°00′00″'); };
$('#btnPlunge').onclick = () => {
  if (!I.st.mounted) return toast('ركّب الجهاز أولاً');
  if (I.st.clamp || I.st.clampV) return toast('حرّر المثبّتين (الأفقي والرأسي) أولاً');
  setHeading(I.st.heading + Math.PI); setVz(TAU - I.st.vz);
  toast('قُلب المنظار: الوجه ' + (I.st.vz < Math.PI ? 'I' : 'II'));
};
$('#btnHI').onclick = () => {
  if (!I.st.mounted) return toast('ركّب الجهاز أولاً');
  const hi = scopeCam.position.y - I.rigPos.y;
  $('#inHI').value = (Math.round((hi + (Math.random() - 0.5) * 0.004) * 1000) / 1000).toFixed(3);
  toast('ارتفاع الجهاز المقاس i = ' + $('#inHI').value + ' م (بالشريط)');
};
$('#inHr').oninput = e => { const v = numOrNull(e.target.value); if (v !== null) setPrismHeight(v); };
