// أخطاء الجهاز — استُخرج من main.js (B-003)
import { $, toast } from './util.js';
import { CFG, ST, saveCfg } from './state.js';
import * as I from './instrument.js';
import { setStaffZero } from './targets.js';
import { ttRefresh } from './books-tt.js';
import { setVegDensity } from './world.js';
import { newWorld } from './transfer.js';

$('#cfgErr').checked = !!CFG.err;
$('#cfgErrK').value = String(CFG.errK);
export const applyErr = () => { I.setErrors(CFG.err, +CFG.errK, ST.seed); setStaffZero(I.staffZero()); };
$('#cfgErr').onchange = e => { CFG.err = e.target.checked; saveCfg(); applyErr(); ttRefresh(); toast(CFG.err ? 'أخطاء الجهاز: تشغيل' : 'أخطاء الجهاز: إيقاف'); };
$('#cfgErrK').onchange = e => { CFG.errK = +e.target.value; saveCfg(); applyErr(); toast('حجم الأخطاء ×' + CFG.errK); };
$('#btnErrShow').onclick = () => { $('#errInfo').textContent = I.errReport().join('\n'); };
$('#cfgVeg').value = String(CFG.veg);
$('#cfgVeg').onchange = e => { CFG.veg = +e.target.value; saveCfg(); setVegDensity(CFG.veg); newWorld(ST.seed); toast('كثافة الأشجار: ' + e.target.selectedOptions[0].text); };
export async function lanRefresh(tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const j = await (await fetch('/api/lan', { cache: 'no-store' })).json(); showLan(j); return; }
    catch (e) { await new Promise(r => setTimeout(r, 500)); }
  }
}
function showLan(j) {
  const b = $('#btnLan');
  b.textContent = j.on ? '🟢 مفعّلة — اضغط للإيقاف' : '⚪ معطّلة — اضغط للتفعيل';
  b.classList.toggle('on', j.on); b.disabled = !j.canToggle;
  let t = '';
  if (j.on) t = (j.urls.length ? j.urls.join('\n') : `اكتب عنوان IP جهازك (من إعدادات الواي فاي) ثم :${j.port}`) + '\n⚠ أي جهاز على نفس الشبكة يقدر يفتحها. فعّلها على شبكة تثق بها.';
  else if (!j.canToggle) t = 'التبديل متاح فقط من الجهاز الذي يشغّل السيرفر.';
  $('#lanInfo').textContent = t;
}
$('#btnLan').onclick = async () => {
  const on = !$('#btnLan').classList.contains('on');
  try { await fetch('/api/lan?on=' + (on ? 1 : 0), { cache: 'no-store' }); } catch (e) { /* قد ينقطع الاتصال لحظياً */ }
  setTimeout(() => lanRefresh(6), 700);
};
