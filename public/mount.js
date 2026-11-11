// التركيب والأرجل — استُخرج من main.js (B-003)
import { $$, $, toast, openTab } from './util.js';
import { LC } from './leveling.js';
import * as I from './instrument.js';
import { scopeEl } from './ctx.js';
import { ST } from './state.js';
import { setMode } from './camera.js';

$$('.lk').forEach(b => (b.style.borderColor = LC[+b.dataset.lk]));
export function updLegLabels() {
  $$('.lk').forEach(b => { const i = +b.dataset.lk, l = I.st.legLock[i]; b.textContent = (l ? '🔒 ' : '🔓 ') + (i + 1); b.classList.toggle('on', l); });
  $$('.lgv').forEach(b => (b.textContent = (I.st.leg[+b.dataset.lv] * 1000).toFixed(1) + ' مم'));
}
function syncLegUI() {
  $('#hSl').value = I.st.H; $('#hVal').textContent = I.st.H.toFixed(2) + ' م';
  $$('.lg').forEach(s => (s.value = I.st.leg[+s.dataset.lg] * 1000));
  updLegLabels();
}
export function updClampUI() {
  $('#btnClamp').textContent = I.st.clamp ? '🔒 المثبّت: مربوط' : '🔓 المثبّت: محرَّر'; $('#btnClamp').classList.toggle('on', I.st.clamp);
  $('#btnClampV').textContent = I.st.clampV ? '🔒 رأسي' : '🔓 رأسي'; $('#btnClampV').classList.toggle('on', I.st.clampV);
  I.setClamp(I.st.clamp);
}
export function afterChange() {
  syncLegUI(); updClampUI();
  scopeEl.style.display = I.st.mounted ? 'block' : 'none';
  $('#btnMountOnly').style.display = I.st.mounted ? 'none' : '';
}
export function doMount() { if (I.st.mounted) return; I.mount(); afterChange(); toast('تم تركيب الجهاز. اضبط الأرجل ثم سوِّ البراغي'); }
$('#btnMountOnly').onclick = doMount;
$('#btnMount').onclick = () => { I.quickMount(); afterChange(); toast('تركيب فوري: الحامل بالارتفاع المناسب مربوط والجهاز مثبّت'); };
$('#btnLevelNow').onclick = () => { I.quickLevel(); afterChange(); toast('موازنة فورية ✓'); };
$$('.lk').forEach(b => (b.onclick = () => { const i = +b.dataset.lk; I.setLegLock(i, !I.st.legLock[i]); updLegLabels(); }));
$$('.lg').forEach(s => (s.oninput = () => {
  const i = +s.dataset.lg;
  if (I.st.legLock[i]) { toast('حرّر بزال الساق ' + (i + 1) + ' أولاً'); s.value = I.st.leg[i] * 1000; return; }
  I.setLeg(i, +s.value / 1000); updLegLabels();
}));
$('#hSl').oninput = e => {
  if (I.st.legLock.some(Boolean)) { toast('حرّر بزال الأرجل الثلاثة أولاً'); e.target.value = I.st.H; return; }
  I.setHeight(+e.target.value); $('#hVal').textContent = I.st.H.toFixed(2) + ' م';
};
$('#btnLegsLock').onclick = () => { const all = I.st.legLock.every(Boolean); [0, 1, 2].forEach(i => I.setLegLock(i, !all)); updLegLabels(); };
$('#btnLegsLevel').onclick = () => { I.levelLegsNow(); syncLegUI(); toast('تمت موازنة الأرجل'); };
$('#btnFine').onclick = () => { ST.fine = !ST.fine; $('#btnFine').textContent = '🎯 ضبط دقيق: ' + (ST.fine ? 'تشغيل' : 'إيقاف'); $('#btnFine').classList.toggle('on', ST.fine); };
$('#btnExplode').onclick = () => {
  if (!I.st.mounted) doMount();
  const on = I.st.exTarget < 0.5;
  I.setExplode(on); $('#btnExplode').classList.toggle('on', on);
  setMode('inst', on ? 2.8 : 1.3);
  if (on) openTab('t4');
};
