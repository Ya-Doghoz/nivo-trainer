// دفتر مناسيب النيفو — استُخرج من main.js (B-003)
import { $, f3, numOrNull, toast, say } from './util.js';
import { ST, CFG, flags } from './state.js';
import { ptById, trueRL, saveState } from './job.js';
import { holder } from './world.js';
import * as I from './instrument.js';

const fbRoot = $('#fb');
const newRow = pt => ({ pt, bs: null, is: null, fs: null, uhi: null, url: null, rem: '', tr: {}, d: {} });
function fbCompute() {
  let HI = null; const rlMap = {}, out = [];
  ST.rows.forEach(r => {
    const p = ptById(r.pt), known = p && p.bm && p.elev != null ? p.elev : null;
    const sight = r.fs != null ? r.fs : r.is != null ? r.is : null;
    const o = { rl: null, hi: null, calc: null, miscl: null, tru: p ? trueRL(p) : null, err: null };
    if (HI !== null && sight !== null) o.calc = HI - sight;
    if (known !== null) { o.rl = known; if (o.calc !== null) o.miscl = (o.calc - known) * 1000; }
    else if (o.calc !== null) o.rl = o.calc;
    else if (r.pt && rlMap[r.pt] !== undefined) o.rl = rlMap[r.pt];
    if (o.rl !== null && r.pt) rlMap[r.pt] = o.rl;
    if (r.bs != null && o.rl !== null) HI = o.rl + r.bs;
    o.hi = HI;
    if (known !== null) o.err = o.miscl; else if (o.rl !== null && o.tru !== null && o.calc !== null) o.err = (o.rl - o.tru) * 1000;
    out.push(o);
  });
  return out;
}
function fbSummary(comp) {
  let F = -1, L = -1;
  ST.rows.forEach((r, i) => {
    const p = ptById(r.pt);
    if (F < 0 && r.bs != null && comp[i].rl !== null && p && p.bm) F = i;
    if (r.fs != null && comp[i].calc !== null) L = i;
  });
  const lines = [];
  if (F < 0 || L < F) { lines.push('أضف BS على نقطة BM ثم FS على نقطة لاحقة لتظهر فحوص الحساب والإغلاق.'); return lines; }
  let sb = 0, sf = 0, dist = 0;
  for (let i = 0; i <= L; i++) {
    const r = ST.rows[i];
    if (r.bs != null && i !== L) sb += r.bs;
    if (r.fs != null) sf += r.fs;
    if (r.d) { if (i !== L && r.d.bs) dist += r.d.bs; if (r.d.fs) dist += r.d.fs; }
  }
  const dr = comp[L].calc - comp[F].rl, chk = (sb - sf) - dr;
  lines.push(`ΣBS = ${sb.toFixed(3)} | ΣFS = ${sf.toFixed(3)} | ΣBS−ΣFS = ${(sb - sf).toFixed(3)} | ΔRL = ${dr.toFixed(3)}`);
  lines.push(Math.abs(chk) < 0.0006 ? '✓ فحص الحساب سليم' : `✗ فحص الحساب غير مطابق (فرق ${(chk * 1000).toFixed(1)} مم) — راجع الجمع والطرح`);
  if (comp[L].miscl !== null) {
    const allow = dist > 0 ? 12 * Math.sqrt(dist / 1000) : null, m = comp[L].miscl;
    lines.push(`خطأ الإغلاق = ${m >= 0 ? '+' : ''}${m.toFixed(1)} مم` + (allow !== null ? ` | المسموح 12√K = ${allow.toFixed(1)} مم (K = ${(dist / 1000).toFixed(3)} كم) → ${Math.abs(m) <= allow ? '✓ مقبول' : '✗ مرفوض'}` : ''));
  }
  return lines;
}
export function fbRender() {
  const comp = fbCompute(), showErr_ = !CFG.exam;
  const opts = pt => ['<option value=""></option>'].concat(ST.job.points.map(p => `<option value="${p.id}"${p.id === pt ? ' selected' : ''}>${p.id}</option>`)).concat(pt && !ptById(pt) ? [`<option value="${pt}" selected>${pt}</option>`] : []).join('');
  let h = `<thead><tr><th>#</th><th>النقطة</th><th>BS</th><th>IS</th><th>FS</th><th>HI</th><th>RL</th><th>ملاحظات</th>${showErr_ ? '<th>±مم</th>' : ''}</tr></thead><tbody>`;
  ST.rows.forEach((r, i) => {
    const num = f => `<input class="fn" type="number" step="0.001" inputmode="decimal" data-r="${i}" data-f="${f}" value="${r[f] ?? ''}">`;
    const hiCell = CFG.manual ? `<td><input type="number" step="0.001" inputmode="decimal" data-r="${i}" data-f="uhi" value="${r.uhi ?? ''}"></td>` : `<td class="calc" data-c="hi${i}"></td>`;
    const rlCell = CFG.manual ? `<td><input type="number" step="0.001" inputmode="decimal" data-r="${i}" data-f="url" value="${r.url ?? ''}"></td>` : `<td class="calc" data-c="rl${i}"></td>`;
    h += `<tr><td>${i + 1}</td><td><select data-r="${i}" data-f="pt">${opts(r.pt)}</select></td><td>${num('bs')}</td><td>${num('is')}</td><td>${num('fs')}</td>${hiCell}${rlCell}<td><input type="text" data-r="${i}" data-f="rem" value="${(r.rem || '').replace(/"/g, '&quot;')}"></td>${showErr_ ? `<td class="calc" data-c="er${i}"></td>` : ''}</tr>`;
  });
  fbRoot.innerHTML = h + '</tbody>';
  fbRefresh();
}
export function fbRefresh() {
  const comp = fbCompute();
  ST.rows.forEach((r, i) => {
    const o = comp[i];
    ['bs', 'is', 'fs'].forEach(f => {
      const el = fbRoot.querySelector(`[data-r="${i}"][data-f="${f}"]`); if (!el) return;
      let cls = 'fn';
      const tr = r.tr && r.tr[f];
      if (!CFG.exam && tr != null && r[f] != null) { const d = Math.abs(r[f] - tr) * 1000; cls += d <= 3 ? ' ok' : d <= 10 ? ' warn' : ' bad'; }
      el.className = cls;
    });
    if (CFG.manual) {
      [['uhi', o.hi], ['url', o.rl]].forEach(([f, ref]) => {
        const el = fbRoot.querySelector(`[data-r="${i}"][data-f="${f}"]`); if (!el) return;
        el.className = r[f] == null ? '' : ref !== null && Math.abs(r[f] - ref) <= 0.0015 ? 'ok' : 'bad';
      });
    } else {
      const a = fbRoot.querySelector(`[data-c="hi${i}"]`), b = fbRoot.querySelector(`[data-c="rl${i}"]`);
      if (a) a.textContent = f3(o.hi); if (b) b.textContent = f3(o.rl);
    }
    const er = fbRoot.querySelector(`[data-c="er${i}"]`);
    if (er) { er.textContent = o.err === null ? '' : (o.err >= 0 ? '+' : '') + o.err.toFixed(0); er.style.color = o.err === null ? '' : Math.abs(o.err) <= 10 ? '#7ee787' : '#ff7b72'; }
  });
  $('#fbSum').textContent = ST.rows.length ? fbSummary(comp).join('\n') : 'الدفتر فارغ. أضف قراءة من تبويب المسح (➕ للدفتر) أو أضف صفاً يدوياً.';
}
['input', 'change'].forEach(ev => fbRoot.addEventListener(ev, e => {
  const t = e.target, i = +t.dataset.r, f = t.dataset.f;
  if (isNaN(i) || !f || !ST.rows[i]) return;
  const r = ST.rows[i];
  if (f === 'pt') r.pt = t.value; else if (f === 'rem') r.rem = t.value; else r[f] = numOrNull(t.value);
  fbRefresh(); saveState();
}));
$('#btnAddRow').onclick = () => { ST.rows.push(newRow(holder.station ? holder.station.id : '')); fbRender(); saveState(); };
$('#btnDelRow').onclick = () => { ST.rows.pop(); fbRender(); saveState(); };
$('#btnClearFb').onclick = () => { if (!ST.rows.length || confirm('مسح كل صفوف الدفتر؟')) { ST.rows = []; fbRender(); saveState(); $('#evalBox').textContent = ''; } };
$('#btnEval').onclick = () => {
  const comp = fbCompute(), finals = {}, lines = [];
  ST.rows.forEach((r, i) => { const p = ptById(r.pt), o = comp[i]; if (p && !p.bm && o.rl !== null && o.calc !== null && o.err !== null) finals[p.id] = { rl: o.rl, err: o.err }; });
  ST.job.points.filter(p => !p.bm).forEach(p => {
    const f = finals[p.id];
    lines.push(f ? `${p.id}: RL = ${f.rl.toFixed(3)} م | الخطأ ${f.err >= 0 ? '+' : ''}${f.err.toFixed(0)} مم ${Math.abs(f.err) <= 10 ? '✓' : '✗'}` : `${p.id}: لم تُقَس بعد`);
  });
  lines.push(''); fbSummary(comp).forEach(l => lines.push(l));
  const errs = Object.values(finals).map(f => f.err);
  if (errs.length) lines.push(`عدد النقاط المقاسة ${errs.length}/${ST.job.points.filter(p => !p.bm).length} | أكبر خطأ ${Math.max(...errs.map(Math.abs)).toFixed(0)} مم`);
  $('#evalBox').textContent = lines.join('\n');
};
$('#btnCsv').onclick = async () => {
  const comp = fbCompute(), lines = ['Point,BS,IS,FS,HI,RL,Remarks'];
  ST.rows.forEach((r, i) => lines.push([r.pt, f3(r.bs), f3(r.is), f3(r.fs), f3(comp[i].hi), f3(comp[i].rl), '"' + (r.rem || '').replace(/"/g, '""') + '"'].join(',')));
  const t = lines.join('\n');
  try { await navigator.clipboard.writeText(t); toast('نُسخ الجدول (CSV)'); }
  catch (e) { const b = $('#csvBox'); b.style.display = 'block'; b.value = t; b.select(); toast('انسخ النص من الخانة'); }
};
const KN_NAME = { bs: 'BS (خلفية)', is: 'IS (متوسطة)', fs: 'FS (أمامية)' };
$('#btnRead').onclick = () => {
  const kind = $('#rdType').value, v = parseFloat($('#inRead').value);
  if (isNaN(v)) return say('اكتب القراءة بالمتر، مثل 1.423', 'warn');
  if (!I.st.mounted || holder.walking || !ST.S.hit || !holder.station) return say('الشعيرة الأفقية ليست على الميرا. وجّه المنظار أولاً.', 'warn');
  if (I.getTilt().arc > I.TY().comp) return say('الجهاز غير مسوّى (خارج مدى المعوّض) — القراءة غير معتمدة. سوِّه أولاً.', 'bad');
  const p = holder.station;
  let r = ST.rows[ST.rows.length - 1];
  const reuse = r && r.pt === p.id && (kind === 'bs' || (kind === 'fs' ? r.is == null : r.fs == null));
  if (!reuse) { r = newRow(p.id); ST.rows.push(r); }
  r[kind] = v; r.tr[kind] = ST.S.reading; r.d[kind] = ST.S.dist;
  const ad = Math.abs(v - ST.S.reading) * 1000;
  let msg = `✓ أُضيفت ${KN_NAME[kind]} عند ${p.id}`, cls = 'ok';
  if (!CFG.exam) { msg += ad <= 3 ? ` — دقيقة (فارق ${ad.toFixed(1)} مم)` : ad <= 10 ? ` — قريبة (فارق ${ad.toFixed(0)} مم)` : ` — بعيدة! فارق ${ad.toFixed(0)} مم`; cls = ad <= 3 ? 'ok' : ad <= 10 ? 'warn' : 'bad'; }
  const dv = parseFloat($('#inDist').value);
  if (!isNaN(dv) && ST.S.D) { if (Math.abs(dv - ST.S.D) <= 0.8) { flags.dist = true; msg += ` | المسافة صحيحة (${ST.S.D.toFixed(1)} م)`; } else msg += ` | المسافة الصحيحة ≈ ${ST.S.D.toFixed(1)} م`; }
  flags.read = true;
  flags.two = new Set(ST.rows.filter(q => q.bs != null || q.is != null || q.fs != null).map(q => q.pt)).size >= 2;
  ST.stepKey = ''; $('#inRead').value = '';
  say(msg, cls); fbRender(); saveState();
};
