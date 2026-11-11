// الإعدادات (واجهة) — استُخرج من main.js (B-003)
import { $, toast } from './util.js';
import { CFG, saveCfg, ST } from './state.js';
import { applyInstType } from './device.js';
import { setStaffStyle, setQuality } from './world.js';
import { resize } from './loop.js';
import { fbRender } from './books-level.js';
import { ttRender } from './books-tt.js';
import { newWorld, randSeed, placeInstrument } from './transfer.js';
import * as I from './instrument.js';
import { doMount } from './mount.js';

// NIVO-V8
$('#cfgInst').value = CFG.inst;
$('#cfgLegs').value = CFG.legs;
$('#cfgState').value = CFG.state;
$('#cfgPat').value = CFG.pat;
$('#cfgLab').value = CFG.lab;
$('#cfgQ').value = CFG.q;
$('#cfgUI').value = CFG.ui;
$('#cfgFix').checked = !!CFG.fix;
$('#cfgManual').checked = !!CFG.manual;
$('#cfgExam').checked = !!CFG.exam;
$('#cfgInst').onchange = e => applyInstType(e.target.value);
$('#cfgLegs').onchange = e => { CFG.legs = e.target.value; saveCfg(); };
$('#cfgState').onchange = e => { CFG.state = e.target.value; saveCfg(); };
$('#cfgPat').onchange = e => { CFG.pat = e.target.value; saveCfg(); setStaffStyle(CFG.pat, CFG.lab); };
$('#cfgLab').onchange = e => { CFG.lab = e.target.value; saveCfg(); setStaffStyle(CFG.pat, CFG.lab); };
$('#cfgQ').onchange = e => { CFG.q = e.target.value; saveCfg(); setQuality(+CFG.q); resize(); };
$('#cfgUI').onchange = e => { CFG.ui = e.target.value; saveCfg(); document.documentElement.style.setProperty('--k', CFG.ui); };
$('#cfgFix').onchange = e => { CFG.fix = e.target.checked; saveCfg(); };
$('#cfgManual').onchange = e => { CFG.manual = e.target.checked; saveCfg(); fbRender(); };
$('#cfgExam').onchange = e => { CFG.exam = e.target.checked; saveCfg(); fbRender(); ttRender(); };
$('#btnSeedApply').onclick = () => { const v = Math.floor(+$('#cfgSeed').value); if (!(v > 0)) return toast('اكتب رقماً صحيحاً أكبر من 0'); newWorld(v); };
$('#btnSeedRnd').onclick = () => newWorld(randSeed());
$('#btnRestart').onclick = () => { placeInstrument(ST.job.setups[ST.job.cur] || { x: 0, z: 0, id: 'S1' }, true); toast('تمت إعادة ضبط الجهاز'); };
$('#btnLegsLevel2').onclick = $('#btnLegsLevel').onclick;
$('#btnScrewsNow').onclick = () => { if (!I.st.mounted) doMount(); I.levelScrewsNow(); toast('تمت موازنة البراغي'); };
