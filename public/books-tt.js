// دفتر التيودوليت والتاكيومتر — استُخرج من main.js (B-003)
import { DEG, $, dms, TAU, wrapPi, numOrNull, f3, toast, say, setTxt } from './util.js';
import * as I from './instrument.js';
import { ST, CFG, flags } from './state.js';
import { setupById, ptById, zOf, crd, saveState } from './job.js';
import * as SM from './survey-math.js';
import { holder } from './world.js';

// NIVO-V5 — تيودوليت رقمي + تاكيومتر يدوي ذاتي الاختزال (قوانين المقرر) + تاكيومتر آلي
const SEC = DEG / 3600;
const ttRoot = $('#tt');
const isStad = () => I.type === 'theo' || I.type === 'tach';
const kindRows = () => ST.rowsT.map((r, i) => [r, i]).filter(([r]) => r.k === I.type);
function ttCalc(r) {
  const su = setupById(r.su), p = ptById(r.pt), o = {};
  if (!su || !p) return o;
  const zen = SM.zenith(r.v, r.face), Zs = zOf(su);
  o.Dt = Math.hypot(p.x - su.x, p.z - su.z); o.Zt = zOf(p);
  if (r.k === 'tach' || r.k === 'theo') {
    if (r.u != null && r.l != null) {
      Object.assign(o, r.k === 'tach' ? SM.stadiaReduced(r, Zs) : SM.stadiaClassic(r, zen, Zs));
      o.eD = (o.D - o.Dt) * 100; if (o.Z != null) o.eZ = (o.Z - o.Zt) * 1000;
    }
  } else if (r.sd != null) {
    const c0 = crd(su.x, su.z), ct = crd(p.x, p.z);
    Object.assign(o, SM.totalStation(r, c0, Zs));
    o.eN = (o.N - ct.N) * 1000; o.eE = (o.E - ct.E) * 1000; o.eZ = (o.Z - o.Zt) * 1000;
  }
  return o;
}
export function ttRender() {
  const kind = I.type, exam = CFG.exam;
  const opts = pt => ['<option value=""></option>'].concat(ST.job.points.map(p => `<option value="${p.id}"${p.id === pt ? ' selected' : ''}>${p.id}</option>`)).concat(pt && !ptById(pt) ? [`<option value="${pt}" selected>${pt}</option>`] : []).join('');
  const cols = kind === 'tach' ? ['#', 'النقطة', 'Hz', 'V', 'وجه', 'ق ع', 'ق و', 'ق س', 'K', 'S', 'D م', 'ΔH م', 'Z م'].concat(exam ? [] : ['±D سم', '±Z مم'])
    : kind === 'theo' ? ['#', 'النقطة', 'Hz', 'V', 'وجه', 'U', 'M', 'L', 'D م', 'Z م'].concat(exam ? [] : ['±D سم', '±Z مم'])
    : ['#', 'النقطة', 'Hz', 'V', 'وجه', 'SD', 'hr', 'HD', 'VD', 'N', 'E', 'Z'].concat(exam ? [] : ['±N مم', '±E مم', '±Z مم']);
  let h = '<thead><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
  kindRows().forEach(([r, i]) => {
    const inp = (f, v) => `<input type="number" step="0.001" inputmode="decimal" data-r="${i}" data-f="${f}" value="${v ?? ''}">`;
    const c = k => `<td class="calc" data-c="${k}${i}"></td>`;
    h += `<tr><td>${i + 1}</td><td><select data-r="${i}" data-f="pt">${opts(r.pt)}</select></td><td class="calc">${dms(r.hz)}</td><td class="calc">${dms(r.v)}</td><td>${r.face === 1 ? 'I' : 'II'}</td>`;
    if (kind === 'tach') h += `<td>${inp('u', r.u)}</td><td>${inp('m', r.m)}</td><td>${inp('l', r.l)}</td><td>${inp('kc', r.kc)}</td><td>${inp('s', r.s)}</td>${c('D')}${c('dH')}${c('Z')}` + (exam ? '' : c('eD') + c('eZ'));
    else if (kind === 'theo') h += `<td>${inp('u', r.u)}</td><td>${inp('m', r.m)}</td><td>${inp('l', r.l)}</td>${c('D')}${c('Z')}` + (exam ? '' : c('eD') + c('eZ'));
    else h += `<td class="calc">${(r.sd ?? 0).toFixed(3)}</td><td>${inp('hr', r.hr)}</td>${c('HD')}${c('VD')}${c('N')}${c('E')}${c('Z')}` + (exam ? '' : c('eN') + c('eE') + c('eZ'));
    h += '</tr>';
  });
  ttRoot.innerHTML = h + '</tbody>';
  ttRefresh();
}
export function ttRefresh() {
  const set = (k, i, v, d, color) => {
    const el = ttRoot.querySelector(`[data-c="${k}${i}"]`); if (!el) return;
    el.textContent = v == null || Number.isNaN(v) ? '' : v.toFixed(d); if (color !== undefined) el.style.color = color;
  };
  const col = (e, lim) => (e == null ? '' : Math.abs(e) <= lim ? '#7ee787' : '#ff7b72');
  kindRows().forEach(([r, i]) => {
    const o = ttCalc(r);
    if (isStad()) {
      set('D', i, o.D, 2); set('Z', i, o.Z, 3); set('eD', i, o.eD, 1, col(o.eD, 10)); set('eZ', i, o.eZ, 0, col(o.eZ, 15));
      if (r.k === 'tach') set('dH', i, o.dH, 3);
    } else { set('HD', i, o.HD, 3); set('VD', i, o.VD, 3); set('N', i, o.N, 3); set('E', i, o.E, 3); set('Z', i, o.Z, 3); set('eN', i, o.eN, 0, col(o.eN, 15)); set('eE', i, o.eE, 0, col(o.eE, 15)); set('eZ', i, o.eZ, 0, col(o.eZ, 15)); }
  });
  $('#ttSum').textContent = ttSummary(false).join('\n');
}
function ttSummary(reveal) {
  const rr = ST.rowsT.filter(r => r.k === I.type), lines = [], show = reveal || !CFG.exam;
  if (!rr.length) return ['لا توجد قياسات بعد. ' + (I.type === 'ts' ? 'وجّه الشعيرة إلى المنشور واضغط 📏 قياس وحفظ.' : 'اقرأ ق ع/ق و/ق س (U/M/L) واضغط ➕ تسجيل.')];
  lines.push('عدد القياسات: ' + rr.length);
  if (isStad() && rr.length >= 2) {
    const a = rr[rr.length - 2], b = rr[rr.length - 1], su = setupById(a.su), pa = ptById(a.pt), pb = ptById(b.pt);
    if (a.su === b.su && su && pa && pb && a.pt !== b.pt && a.face === b.face) {
      const ang = (((b.hz - a.hz) % TAU) + TAU) % TAU, bt = p => Math.atan2(p.x - su.x, -(p.z - su.z)), trAng = (((bt(pb) - bt(pa)) % TAU) + TAU) % TAU;
      lines.push(`الزاوية الأفقية ${a.pt}→${b.pt} = ${dms(ang, 1)}` + (show ? ` | الحقيقية ${dms(trAng, 1)} | الخطأ ${(wrapPi(ang - trAng) / SEC).toFixed(0)}″` : ''));
    }
  }
  const by = {};
  rr.forEach(r => { const k = r.su + '|' + r.pt; (by[k] = by[k] || {})[r.face] = r; });
  Object.values(by).forEach(g => {
    if (!g[1] || !g[2]) return;
    const a = g[1], b = g[2], ie = (a.v + b.v - TAU) / 2, hzd = wrapPi(b.hz - a.hz - Math.PI);
    const zz = Math.min(Math.max(a.v, 0.2), Math.PI - 0.2), c2 = hzd * Math.sin(zz) / 2, mh = a.hz + wrapPi(b.hz - Math.PI - a.hz) / 2;
    let s = `${a.pt} (الوجهان): Hz متوسط = ${dms(mh, 1)} | i المقدّر = ${(wrapPi(ie) / SEC).toFixed(0)}″ | |c| المقدّر = ${(Math.abs(c2) / SEC).toFixed(0)}″`;
    if (show && I.ERR.on) s += ` | الحقيقي: i = ${I.errArc('i').toFixed(0)}″، |c| = ${Math.abs(I.errArc('c')).toFixed(0)}″` + (I.type === 'tach' ? ' (i يشمل برغي الفهرس)' : '');
    lines.push(s);
  });
  if (show) {
    const es = [];
    rr.forEach(r => { const o = ttCalc(r); if (isStad()) { if (o.eZ != null) es.push(Math.abs(o.eZ)); } else if (o.eN != null) es.push(Math.max(Math.abs(o.eN), Math.abs(o.eE), Math.abs(o.eZ))); });
    if (es.length) lines.push(`أكبر خطأ في المنسوب/الإحداثيات = ${Math.max(...es).toFixed(0)} مم`);
  }
  return lines;
}
['input', 'change'].forEach(ev => ttRoot.addEventListener(ev, e => {
  const t = e.target, i = +t.dataset.r, f = t.dataset.f;
  if (isNaN(i) || !f || !ST.rowsT[i]) return;
  if (f === 'pt') ST.rowsT[i].pt = t.value; else ST.rowsT[i][f] = numOrNull(t.value);
  ttRefresh(); saveState();
}));
$('#btnTtDel').onclick = () => { const idx = ST.rowsT.map(r => r.k).lastIndexOf(I.type); if (idx >= 0) ST.rowsT.splice(idx, 1); ttRender(); saveState(); };
$('#btnTtClear').onclick = () => { if (confirm('مسح كل قياسات هذا الجهاز؟')) { ST.rowsT = ST.rowsT.filter(r => r.k !== I.type); ttRender(); saveState(); } };
$('#btnTtEval').onclick = () => { $('#ttSum').textContent = ttSummary(true).join('\n'); };
$('#btnTtCsv').onclick = async () => {
  const kind = I.type, lines = [kind === 'tach' ? 'Point,Hz,V,Face,U,M,L,K,S,D,dH,Z' : kind === 'theo' ? 'Point,Hz,V,Face,U,M,L,D,Z' : 'Point,Hz,V,Face,SD,hr,HD,VD,N,E,Z'];
  kindRows().forEach(([r]) => {
    const o = ttCalc(r), base = [r.pt, dms(r.hz, 1), dms(r.v, 1), r.face === 1 ? 'I' : 'II'];
    const rest = kind === 'tach' ? [f3(r.u), f3(r.m), f3(r.l), f3(r.kc), f3(r.s), f3(o.D), f3(o.dH), f3(o.Z)] : kind === 'theo' ? [f3(r.u), f3(r.m), f3(r.l), f3(o.D), f3(o.Z)] : [f3(r.sd), f3(r.hr), f3(o.HD), f3(o.VD), f3(o.N), f3(o.E), f3(o.Z)];
    lines.push(base.concat(rest).join(','));
  });
  const t = lines.join('\n');
  try { await navigator.clipboard.writeText(t); toast('نُسخ الجدول (CSV)'); }
  catch (e) { const b = $('#ttCsvBox'); b.style.display = 'block'; b.value = t; b.select(); toast('انسخ النص من الخانة'); }
};
function afterTTRecord(r, msg, cls) {
  flags.read = true;
  if (r.face === 2) flags.face2 = true;
  flags.two = new Set(ST.rowsT.filter(q => q.k === I.type).map(q => q.pt)).size >= 2;
  ST.stepKey = ''; say(msg, cls); ttRender(); saveState();
}
const curSetupId = () => (ST.job.setups[ST.job.cur] || {}).id;
$('#btnThRec').onclick = () => {
  const u = numOrNull($('#inU').value), m = numOrNull($('#inM').value), l = numOrNull($('#inL').value), i = numOrNull($('#inHI').value);
  if (!I.st.mounted || !holder.station || holder.walking || !ST.S.hit) return say('الشعيرة ليست على الميرا. وجّه المنظار أولاً.', 'warn');
  if (u === null || l === null || u <= l) return say('اكتب قراءة الشعيرة العليا U (الأكبر) والسفلى L', 'warn');
  if (i === null) return say('قِس ارتفاع الجهاز i أولاً (📏)', 'warn');
  const rd = I.readings();
  const r = { k: 'theo', pt: holder.station.id, su: curSetupId(), hz: rd.hz, v: rd.v, face: rd.face, u, m, l, i, tr: { u: ST.S.U, m: ST.S.reading, l: ST.S.L } };
  ST.rowsT.push(r);
  let msg = `✓ سُجّل: Hz ${dms(rd.hz)} V ${dms(rd.v)} (وجه ${rd.face === 1 ? 'I' : 'II'})`, cls = 'ok';
  if (!CFG.exam && ST.S.U != null) { const e = Math.max(Math.abs(u - ST.S.U), Math.abs(l - ST.S.L)) * 1000; msg += ` | فارق قراءة الشعيرات ${e.toFixed(0)} مم`; cls = e <= 5 ? 'ok' : e <= 15 ? 'warn' : 'bad'; }
  if (I.getTilt().arc > 3) { msg += ' | ⚠ الجهاز غير مسوّى جيداً'; if (cls === 'ok') cls = 'warn'; }
  $('#inU').value = $('#inM').value = $('#inL').value = '';
  afterTTRecord(r, msg, cls);
};
export function updK() {
  const rd = I.readings(), zen = SM.zenith(rd.v, rd.face);
  setTxt('#kHint', `K النظري = 200·tanα = ${SM.kTheory(zen).toFixed(3)}  (α = ${(SM.elev(zen) / DEG).toFixed(3)}°).  ΔH = (ق ع − ق و)·K + J − S`);
}
$('#btnTcRec').onclick = () => {
  const u = numOrNull($('#inU').value), m = numOrNull($('#inM').value), l = numOrNull($('#inL').value), i = numOrNull($('#inHI').value);
  const kc = numOrNull($('#inK').value), s = numOrNull($('#inS').value);
  const hD = numOrNull($('#inHzD').value), hM = numOrNull($('#inHzM').value), vD = numOrNull($('#inVD').value), vM = numOrNull($('#inVM').value);
  if (!I.st.mounted || !holder.station || holder.walking || !ST.S.hit) return say('الشعيرة ليست على الميرا. وجّه المنظار أولاً.', 'warn');
  if (hD === null || vD === null) return say('اكتب قراءتي Hz وV (درجات ودقائق) من نافذة القراءة', 'warn');
  if (u === null || l === null || u <= l) return say('اكتب ق ع (الأكبر) وق س (الأصغر)', 'warn');
  if (kc === null) return say('اكتب قيمة K (انظر K النظري تحت الخانات)', 'warn');
  if (s === null) return say('اكتب S: قراءة شعيرة التصويب (القصيرة تحت المنتصف)', 'warn');
  if (i === null) return say('قِس ارتفاع الجهاز J أولاً (📏)', 'warn');
  const hz = (((hD + (hM || 0) / 60) % 360 + 360) % 360) * DEG, v = (((vD + (vM || 0) / 60) % 360 + 360) % 360) * DEG, rd = I.readings();
  const r = { k: 'tach', pt: holder.station.id, su: curSetupId(), hz, v, face: rd.face, u, m, l, s, kc, i, tr: { u: ST.S.U, m: ST.S.reading, l: ST.S.L, s: ST.S.sr, hz: rd.hz, v: rd.v } };
  ST.rowsT.push(r);
  const o = ttCalc(r);
  let msg = `✓ سُجّل: D = ${o.D.toFixed(2)} م` + (o.dH != null ? ` | ΔH = ${o.dH >= 0 ? '+' : ''}${o.dH.toFixed(3)} م` : ''), cls = 'ok';
  const mm = m != null ? m : (u + l) / 2;
  if (Math.abs(o.D - (u - mm) * 200) > 0.15) { msg += ' | ⚠ ق و ليست منتصف ق ع وق س (D من المعادلتين تختلف)'; cls = 'warn'; }
  if (!CFG.exam) {
    const eh = Math.abs(wrapPi(hz - rd.hz)) / SEC, ev2 = Math.abs(wrapPi(v - rd.v)) / SEC, es = ST.S.U != null ? Math.max(Math.abs(u - ST.S.U), Math.abs(l - ST.S.L), m != null ? Math.abs(m - ST.S.reading) : 0, ST.S.sr != null ? Math.abs(s - ST.S.sr) : 0) * 1000 : 0;
    msg += ` | فارق قراءتك: Hz ${eh.toFixed(0)}″ و V ${ev2.toFixed(0)}″ والشعيرات ${es.toFixed(0)} مم`;
    if (cls === 'ok') cls = Math.max(eh, ev2) <= 90 && es <= 5 ? 'ok' : Math.max(eh, ev2) <= 240 && es <= 15 ? 'warn' : 'bad';
  }
  if (Math.abs(I.indexBubble()) > 0.5) { msg += ' | ⚠ كمانة الدائرة الرأسية غير مركزية'; if (cls === 'ok') cls = 'warn'; }
  if (I.getTilt().arc > 3) { msg += ' | ⚠ الجهاز غير مسوّى جيداً'; if (cls === 'ok') cls = 'warn'; }
  $('#inU').value = $('#inM').value = $('#inL').value = $('#inK').value = $('#inS').value = '';
  afterTTRecord(r, msg, cls);
};
$('#btnMeasTS').onclick = () => {
  if (!I.st.mounted || holder.walking || !holder.station) return say('أرسل المنشور وانتظر وصوله', 'warn');
  if (!ST.S.hit || !ST.S.edm) return say('الشعيرة ليست على منتصف المنشور — وجّه بدقة (EDM لا يعيد إشارة).', 'warn');
  const i = numOrNull($('#inHI').value), hr = numOrNull($('#inHr').value);
  if (i === null) return say('قِس ارتفاع الجهاز i أولاً (📏)', 'warn');
  if (hr === null) return say('اكتب ارتفاع العاكس hr', 'warn');
  const rd = I.readings(), ee = I.edmErr();
  const sdv = Math.round((ST.S.sd * (1 + ee.ppm * 1e-6) + ee.zero + (Math.random() - 0.5) * 2 * (0.002 + 2e-6 * ST.S.sd)) * 1000) / 1000;
  const r = { k: 'ts', pt: holder.station.id, su: curSetupId(), hz: rd.hz, v: rd.v, face: rd.face, sd: sdv, hr, i, comp: rd.comp };
  ST.rowsT.push(r);
  const o = ttCalc(r);
  ST.lastMeas = `SD ${sdv.toFixed(3)}  HD ${o.HD.toFixed(3)}  VD ${o.VD >= 0 ? '+' : ''}${o.VD.toFixed(3)}`;
  let msg = `✓ ${r.pt}: ${ST.lastMeas}`, cls = 'ok';
  if (!flags.orient) { msg += ' | ⚠ الاتجاه غير مضبوط: الإحداثيات مدوّرة'; cls = 'warn'; }
  if (!rd.comp) { msg += ' | ⚠ الميل خارج مدى المعوّض'; cls = 'bad'; }
  afterTTRecord(r, msg, cls);
};
$('#btnOrient').onclick = () => {
  if (!I.st.mounted) return say('ركّب الجهاز أولاً', 'warn');
  const bs = ptById($('#bsSel').value), s0 = ST.job.setups[ST.job.cur];
  if (!bs || !s0) return say('اختر نقطة BS معلومة (BM)', 'warn');
  if (!holder.station || holder.station.id !== bs.id) return say('أرسل المنشور إلى ' + bs.id + ' أولاً', 'warn');
  if (!ST.S.hit || !ST.S.edm) return say('وجّه الشعيرة إلى منتصف المنشور أولاً', 'warn');
  const az = Math.atan2(bs.x - s0.x, -(bs.z - s0.z)), face2 = I.st.vz > Math.PI;
  I.st.hz0 = I.st.heading - (az + (face2 ? Math.PI : 0)); flags.orient = true; ST.stepKey = '';
  say(`✓ ضُبط الاتجاه: Hz = ${dms(az, 1)} (سمت ${s0.id}→${bs.id})`, 'ok');
};
