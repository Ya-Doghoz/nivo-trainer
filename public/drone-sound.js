(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DroneSoundEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function cl(v, a, b) { return v < a ? a : (v > b ? b : v); }

  var DEFAULTS = {
    rpmIdle: 4800, rpmMax: 19500, rpmExp: 1.35, rpmFloor: 2200,
    blades: 2, polePairs: 7, slots: 12, propR: 0.105,
    tauUp: 0.17, tauDown: 0.95, jitter: 150,
    toneGain: 0.30, sideDepth: 0.24, impGain: 0.07, impDecay: 0.0026,
    stallAt: 0.78, stallAmt: 0.4, subGain: 0.04,
    bbTotal: 0.115, washShare: 0.50, hissShare: 0.30, teShare: 0.20,
    bbMod: 0.55, asymDepth: 0.45,
    escGain: 0.006, cogGain: 0.008, drive: 1.4,
    cSound: 343.0, micH: 1.5, refDist: 4.0, floorDb: -34,
    reflG: 0.26, groundFc: 800, groundEffect: 0.5,
    isoC: 0.011, isoExp: 1.7, awLo: 150, awHi: 11000,
    dirToneLo: 0.45, dirBBLo: 0.85,
    vibGain: 0.30, windGain: 0.08, gustFc: 0.8, OS: 2,
    masterVolume: 0.9, workletUrl: 'drone-worklet.js',
    modes: [[360, 0.26, 1.9], [790, 0.15, 2.1], [1680, 0.09, 2.0], [3150, 0.07, 1.8]],
    vibModes: [[95, 0.55, 3.0], [210, 0.35, 4.0], [420, 0.18, 3.5]],
    rpos: [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]
  };

  var GROUND_PROPS = {
    water:    { reflG: 0.95, groundFc: 18000, label: 'ماء ساكن' },
    concrete: { reflG: 0.85, groundFc: 12000, label: 'بيتون/أسمنت' },
    asphalt:  { reflG: 0.65, groundFc: 6000,  label: 'أسفلت' },
    soil:     { reflG: 0.45, groundFc: 2500,  label: 'تراب مضغوط' },
    sand:     { reflG: 0.35, groundFc: 1500,  label: 'رمل جاف' },
    grass:    { reflG: 0.26, groundFc: 800,   label: 'عشب كثيف' }
  };

  var PAYLOADS = {
    none:      { addedMass: 0,    lidarHz: 0,   gimbleHum: 0,    dragWhistle: 0 },
    camera:    { addedMass: 0.15, lidarHz: 0,   gimbleHum: 120,  dragWhistle: 0.02 },
    rtk:       { addedMass: 0.25, lidarHz: 0,   gimbleHum: 140,  dragWhistle: 0.06 },
    lidar:     { addedMass: 0.90, lidarHz: 240, gimbleHum: 180,  dragWhistle: 0.10 },
    multispec: { addedMass: 0.45, lidarHz: 0,   gimbleHum: 160,  dragWhistle: 0.08 }
  };

  var COMBO_PRESETS = {
    survey_basic:    ['rtk', 'camera'],
    survey_lidar:    ['rtk', 'lidar'],
    survey_advanced: ['rtk', 'lidar', 'camera'],
    mapping_only:    ['rtk']
  };

  function sanitizeForClone(obj) {
    var seen = new WeakSet();
    function walk(o) {
      if (o === null || typeof o !== 'object') return o;
      if (seen.has(o)) return null;
      seen.add(o);
      if (Array.isArray(o)) return o.map(walk);
      var out = {};
      for (var k in o) {
        if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
        var v = o[k];
        if (typeof v === 'function' || typeof v === 'symbol' || v === undefined) continue;
        out[k] = walk(v);
      }
      return out;
    }
    return walk(obj);
  }

  /* ====== مهلة زمنية: لا نسمح بوعد معلق للأبد ====== */
  function withTimeout(promise, ms, msg) {
    return Promise.race([
      promise,
      new Promise(function (_, rej) {
        setTimeout(function () { rej(new Error(msg || ('timeout ' + ms + 'ms'))); }, ms);
      })
    ]);
  }

  function pinkBuf(ctx, sec) {
    var nn = Math.max(1, (ctx.sampleRate * sec) | 0), b = ctx.createBuffer(1, nn, ctx.sampleRate), d = b.getChannelData(0);
    var b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (var i = 0; i < nn; i++) { var w = Math.random()*2-1;
      b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;
      b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;b6=w*.115926; }
    return b;
  }

  function Fallback(ctx, dest, cfg) {
    this.ctx = ctx; this.cfg = cfg; this.r = [0,0,0,0]; this.n = [];
    var pb = pinkBuf(ctx, 2), pans = [-0.3, 0.3, -0.18, 0.18];
    for (var i = 0; i < 4; i++) {
      var o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 200;
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000; lp.Q.value = 0.6;
      var g = ctx.createGain(); g.gain.value = 0;
      var ns = ctx.createBufferSource(); ns.buffer = pb; ns.loop = true;
      var nh = ctx.createBiquadFilter(); nh.type = 'highpass'; nh.frequency.value = 1000;
      var nl = ctx.createBiquadFilter(); nl.type = 'lowpass'; nl.frequency.value = 8000;
      var lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 200;
      var lg = ctx.createGain(); lg.gain.value = 0.6;
      var ng = ctx.createGain(); ng.gain.value = 0;
      lfo.connect(lg).connect(ng.gain);
      var tail = dest;
      if (ctx.createStereoPanner) { var p = ctx.createStereoPanner(); p.pan.value = pans[i]; p.connect(dest); tail = p; }
      o.connect(lp).connect(g).connect(tail);
      ns.connect(nh).connect(nl).connect(ng).connect(tail);
      o.start(); ns.start(); lfo.start();
      this.n.push({ o: o, lp: lp, g: g, lfo: lfo, ng: ng });
    }
  }
  Fallback.prototype.update = function (T, dt, armed) {
    var c = this.ctx, now = c.currentTime, k = this.cfg;
    for (var i = 0; i < 4; i++) {
      var tau = T[i] > this.r[i] ? k.tauUp : k.tauDown;
      this.r[i] += (T[i] - this.r[i]) * (1 - Math.exp(-dt / tau));
      var rpm = this.r[i], lvl = cl((rpm - k.rpmIdle) / (k.rpmMax - k.rpmIdle), 0, 1);
      var bpf = rpm / 60 * k.blades, load = 0.10 + 0.90 * lvl * lvl * (0.55 + 0.45 * lvl);
      var e = this.n[i];
      e.o.frequency.setTargetAtTime(cl(bpf, 20, 20000), now, 0.02);
      e.lfo.frequency.setTargetAtTime(cl(bpf, 0.5, 20000), now, 0.02);
      e.lp.frequency.setTargetAtTime(4000 + lvl * 11000, now, 0.05);
      e.g.gain.setTargetAtTime(armed ? k.toneGain * 0.8 * load : 0, now, 0.05);
      e.ng.gain.setTargetAtTime(armed ? k.bbTotal * 0.9 * load : 0, now, 0.06);
    }
  };
  Fallback.prototype.dispose = function () { for (var i = 0; i < this.n.length; i++) { try { this.n[i].o.stop(); this.n[i].lfo.stop(); } catch (_) {} } };

  function DroneSoundEngine(options) {
    this.cfg = JSON.parse(JSON.stringify(DEFAULTS));
    if (options) for (var k in options) if (Object.prototype.hasOwnProperty.call(options, k)) this.cfg[k] = options[k];
    this.ctx = null; this.node = null; this.fb = null; this.an = null;
    this.started = false; this._p = null; this._lastArmed = false;
    this.mode = 'none'; this.err = ''; this.lastError = '';
    this.recorder = null; this.recChunks = []; this.recording = false;
    this.telemetry = { rpm: [0,0,0,0], bpf: 0, level: 0, rms: 0, stall: 0, dirTone: 1, dirBB: 1, dist: 4, elev: 0, mode: 'none', applied: {} };
    this._sm = { coll:0, pitch:0, roll:0, yaw:0, adv:0, desc:0, radial:0, ob:0, scan:0,
                 px:0, py:0, pz:4, dist:4, micH:this.cfg.micH, tip:70, wx:0, wz:-1, flowAz:0 };
    this._prevDist = null;
  }

  DroneSoundEngine.DEFAULTS = DEFAULTS;
  DroneSoundEngine.GROUND_PROPS = GROUND_PROPS;
  DroneSoundEngine.PAYLOADS = PAYLOADS;
  DroneSoundEngine.COMBO_PRESETS = COMBO_PRESETS;
  DroneSoundEngine.rpmFromCollective = function (c, cfg) {
    var k = Object.assign({}, DEFAULTS, cfg || {});
    return k.rpmIdle + (k.rpmMax - k.rpmIdle) * Math.pow(cl(c, 0, 1), k.rpmExp);
  };
  DroneSoundEngine.splAt = function (distM, splAt1m) {
    var s = (splAt1m == null ? 72 : splAt1m), d = Math.max(0.5, distM);
    return Math.max(12, s - 20 * Math.log10(d));
  };
  DroneSoundEngine.audibleRange = function (splAt1m, ambientDb) {
    var s = splAt1m == null ? 72 : splAt1m, a = ambientDb == null ? 35 : ambientDb;
    return Math.pow(10, (s - a) / 20);
  };

  /* ================================================================
     FIX الجوهري: start() مع timeout والتقاط أخطاء واضح
     ================================================================ */
  DroneSoundEngine.prototype._tryWorklet = async function (url) {
    var ctx = this.ctx;
    var res;
    try { res = await fetch(url, { cache: 'reload' }); }
    catch (e) { throw new Error('fetch فشل: ' + e.message + (location.protocol === 'file:' ? ' — يجب تشغيله عبر خادم HTTP وليس file://' : '')); }
    if (!res.ok) throw new Error('HTTP ' + res.status + ' للمسار ' + url);
    var mod = await res.text();
    if (mod.indexOf('registerProcessor') === -1) throw new Error('الملف لا يحتوي registerProcessor — مسار خاطئ؟');
    var blobUrl = URL.createObjectURL(new Blob([mod], { type: 'text/javascript' }));
    try {
      await withTimeout(ctx.audioWorklet.addModule(blobUrl), 5000, 'addModule علّق لأكثر من 5 ثوانٍ');
      var node = new AudioWorkletNode(ctx, 'drone-proc', {
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2],
        processorOptions: sanitizeForClone(this.cfg)
      });
      var self = this;
      node.port.onmessage = function (e) {
        var d = e.data;
        if (d && d.type === 'tel') {
          var t = self.telemetry;
          t.rpm = d.rpm; t.level = d.lvl; t.rms = d.rms; t.stall = d.stall || 0;
          t.dirTone = d.dirTone; t.dirBB = d.dirBB; t.dist = d.dist; t.elev = d.elev;
          t.applied = d.applied || {};
          t.bpf = (d.rpm[0] || 0) / 60 * self.cfg.blades;
        }
      };
      /* التقاط أخطاء runtime داخل الـ worklet بدل موتها صامتة */
      node.onerror = function (ev) { console.error('[worklet error]', ev.message || ev); self.lastError = 'worklet: ' + (ev.message || 'unknown'); };
      node.connect(this.master); this.node = node;
      return true;
    } finally { URL.revokeObjectURL(blobUrl); }
  };

  DroneSoundEngine.prototype.start = function () {
    var self = this;
    if (this.started) {
      if (this.ctx && this.ctx.state !== 'running') {
        return withTimeout(this.ctx.resume(), 3000, 'resume علّق').then(
          function () { return true; },
          function (e) { self.lastError = 'resume: ' + e.message; return false; }
        );
      }
      return Promise.resolve(true);
    }
    if (this._p) return this._p;

    this._p = (async function () {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) throw new Error('Web Audio API غير مدعوم في هذا المتصفح');
        self.ctx = new AC({ latencyHint: 'interactive' });

        /* FIX: resume بمهلة 3 ثوانٍ — لا وعد معلق للأبد [[6]] */
        try {
          await withTimeout(self.ctx.resume(), 3000, 'resume علّق — المتصفح ينتظر تفاعل مستخدم أكبر');
        } catch (e) {
          /* Safari قد يرفض ثم يقبل لاحقًا؛ نظّف الوعد المخبوء وأعد المحاولة [[4]] */
          self.lastError = 'resume أولي: ' + e.message;
        }
        if (self.ctx.state !== 'running') {
          throw new Error('الصوت محظور: state=' + self.ctx.state + '. انقر فوق الصفحة مباشرةً ثم أعد المحاولة.');
        }

        self.master = self.ctx.createGain(); self.master.gain.value = 0;
        self.limiter = self.ctx.createDynamicsCompressor();
        self.limiter.threshold.value = -7; self.limiter.knee.value = 6;
        self.limiter.ratio.value = 16; self.limiter.attack.value = 0.002; self.limiter.release.value = 0.2;
        self.an = self.ctx.createAnalyser(); self.an.fftSize = 2048; self.an.smoothingTimeConstant = 0.75;
        self.master.connect(self.limiter); self.limiter.connect(self.an); self.an.connect(self.ctx.destination);
        self.master.gain.setTargetAtTime(cl(self.cfg.masterVolume, 0, 1.5), self.ctx.currentTime, 0.12);

        if (self.ctx.audioWorklet) {
          try { if (await self._tryWorklet(self.cfg.workletUrl)) self.mode = 'worklet'; }
          catch (e) { console.warn('[drone-sound] worklet failed:', e); self.err = String(e && e.message || e); }
        } else {
          self.err = 'audioWorklet غير متوفر في هذا المتصفح';
        }
        if (self.mode !== 'worklet') { self.fb = new Fallback(self.ctx, self.master, self.cfg); self.mode = 'fallback'; }
        self.telemetry.mode = self.mode;
        self.started = true; self._p = null;
        return true;
      } catch (e) {
        self._p = null;
        self.err = String(e && e.message || e);
        /* تنظيف جزئي حتى تنجح إعادة المحاولة لاحقًا */
        if (self.ctx) { try { await self.ctx.close(); } catch (_) {} self.ctx = null; }
        throw e;
      }
    })();
    return this._p;
  };

  DroneSoundEngine.prototype.setCfg = function (patch) {
    var clean = {};
    for (var k in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, k)) continue;
      var v = patch[k];
      if (typeof v === 'number' && !isFinite(v)) continue;
      clean[k] = v;
      this.cfg[k] = v;
    }
    if (this.mode === 'worklet' && this.node) this.node.port.postMessage({ type: 'cfg', v: clean });
    if ('masterVolume' in clean && this.master && this.ctx) { try { this.master.gain.setTargetAtTime(cl(+clean.masterVolume, 0, 1.5), this.ctx.currentTime, 0.05); } catch (_) {} } /* NIVO-SND */
    return this.cfg;
  };

  DroneSoundEngine.prototype.setGround = function (type) {
    var p = GROUND_PROPS[type]; if (!p) return;
    this.setCfg({ reflG: p.reflG, groundFc: p.groundFc });
  };

  DroneSoundEngine.prototype.setCombo = function (comboName) {
    var devices = Array.isArray(comboName) ? comboName : (COMBO_PRESETS[comboName] || (PAYLOADS[comboName] ? [comboName] : []));
    var totalMass = 0, maxLidar = 0, maxGimbal = 0, sumWhistle = 0;
    for (var i = 0; i < devices.length; i++) {
      var p = PAYLOADS[devices[i]];
      if (!p) continue;
      totalMass += p.addedMass;
      if (p.lidarHz > 0) maxLidar = Math.max(maxLidar, p.lidarHz);
      if (p.gimbleHum > 0) maxGimbal = Math.max(maxGimbal, p.gimbleHum);
      if (p.dragWhistle > 0) sumWhistle += p.dragWhistle;
    }
    this.cfg.totalAddedMass = totalMass;
    this.cfg.lidarHz = maxLidar;
    this.cfg.gimbleHum = maxGimbal;
    this.cfg.dragWhistle = sumWhistle;
    var boost = 1 + totalMass / (this.cfg.massKg || 1.4) * 0.12;
    this.cfg.rpmHoverAdj = (this.cfg.rpmHover || this.cfg.rpmIdle) * boost;
    if (this.mode === 'worklet' && this.node) {
      this.node.port.postMessage({ type: 'cfg', v: {
        totalAddedMass: totalMass, lidarHz: maxLidar, gimbleHum: maxGimbal,
        dragWhistle: sumWhistle, rpmHoverAdj: this.cfg.rpmHoverAdj
      }});
    }
  };

  DroneSoundEngine.prototype.update = function (state, dt) {
    if (!this.started || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      /* إعادة محاولة التنشيط عند العودة للتركيز [[9]] */
      withTimeout(this.ctx.resume(), 2000, '').catch(function(){});
      return;
    }
    if (this.ctx.state !== 'running') return;
    state = state || {};
    dt = Math.min(0.1, Number(state.dt != null ? state.dt : dt) || 0.016);
    var armed = !!state.armed, k = this.cfg, sm = this._sm;
    if (armed && !this._lastArmed) this.trigger('arm');
    if (!armed && this._lastArmed) this.trigger('disarm');
    this._lastArmed = armed;

    function kk(a, b) { return 1 - Math.exp(-dt / (armed ? a : b)); }
    sm.coll   += (cl(+(state.collective != null ? state.collective : state.throttle) || 0, 0, 1) - sm.coll) * kk(0.10, 0.18);
    sm.pitch  += (cl(+state.pitch   || 0, -1, 1) - sm.pitch) * kk(0.09, 0.2);
    sm.roll   += (cl(+state.roll    || 0, -1, 1) - sm.roll)  * kk(0.09, 0.2);
    sm.yaw    += (cl(+state.yawRate || 0, -1, 1) - sm.yaw)   * kk(0.09, 0.2);
    sm.adv    += (cl(+state.advance || state.adv || 0, 0, 1) - sm.adv) * (1 - Math.exp(-dt / 0.2));
    sm.desc   += (cl(+state.descent || state.desc || 0, 0, 1) - sm.desc) * (1 - Math.exp(-dt / 0.15));
    sm.ob     += (cl(+state.onboard || 0, 0, 1) - sm.ob) * (1 - Math.exp(-dt / 0.12));
    sm.scan   += (cl(+(state.scanning || 0), 0, 1) - sm.scan) * (1 - Math.exp(-dt / 0.1));
    sm.tip    = +(state.tipSpeed || 70) || 70;
    sm.micH   = +(state.micHeight != null ? state.micHeight : k.micH) || k.micH;
    if (state.wind) { sm.wx = +state.wind.x || 0; sm.wz = +state.wind.z || 0; }
    if (state.flowAz != null) sm.flowAz = +state.flowAz || 0;

    if (state.pos) { sm.px = +state.pos.x || 0; sm.py = +state.pos.y || 0; sm.pz = +state.pos.z || 0; }
    sm.dist = Math.max(0.35, Math.hypot(sm.px, sm.py, sm.pz));

    var radial;
    if (state.vel) radial = -(sm.px * (state.vel.x||0) + sm.py * (state.vel.y||0) + sm.pz * (state.vel.z||0)) / sm.dist;
    else { if (this._prevDist == null) this._prevDist = sm.dist; radial = (this._prevDist - sm.dist) / Math.max(dt, 1e-3); }
    this._prevDist = sm.dist;
    sm.radial += (cl(state.radialVel != null ? +state.radialVel : radial, -120, 120) - sm.radial) * (1 - Math.exp(-dt / 0.1));

    if (this.mode === 'worklet') {
      this.node.port.postMessage({
        type: 'state', armed: armed ? 1 : 0, coll: sm.coll, pitch: sm.pitch, roll: sm.roll, yaw: sm.yaw,
        adv: sm.adv, desc: sm.desc, radial: sm.radial, onboard: sm.ob,
        px: sm.px, py: sm.py, pz: sm.pz, dist: sm.dist, micH: sm.micH, tip: sm.tip,
        wx: sm.wx, wz: sm.wz, flowAz: sm.flowAz, scanning: sm.scan
      });
    } else if (this.fb) {
      var base = DroneSoundEngine.rpmFromCollective(sm.coll, k), dd = (k.rpmMax - k.rpmIdle) * 0.10;
      var T = [0,0,0,0];
      if (armed) {
        T[0] = base + sm.pitch*dd - sm.roll*dd - sm.yaw*dd;
        T[1] = base - sm.pitch*dd + sm.roll*dd + sm.yaw*dd;
        T[2] = base + sm.pitch*dd + sm.roll*dd + sm.yaw*dd;
        T[3] = base - sm.pitch*dd - sm.roll*dd + sm.yaw*dd;
        for (var i = 0; i < 4; i++) T[i] = cl(T[i], k.rpmFloor, k.rpmMax * 1.03);
      }
      this.fb.update(T, dt, armed);
      var geo = Math.max(Math.pow(10, k.floorDb/20), k.refDist / (sm.dist * (1 - sm.ob) + 0.6 * sm.ob));
      this.master.gain.setTargetAtTime(cl(k.masterVolume, 0, 1.5) * geo, this.ctx.currentTime, 0.05);
    }
    return this.telemetry;
  };

  DroneSoundEngine.prototype.trigger = function (name) {
    if (!this.started || !this.ctx || this.ctx.state !== 'running') return;
    if (this.mode === 'worklet') { this.node.port.postMessage({ type: 'evt', name: name }); return; }
    var ctx = this.ctx, t = ctx.currentTime;
    var dest = this.master || ctx.destination;
    function mk(f, d, a, del) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + del);
      g.gain.exponentialRampToValueAtTime(a, t + del + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + del + d);
      o.connect(g).connect(dest);
      o.start(t + del); o.stop(t + del + d + 0.05);
    }
    if (name === 'arm') { mk(660,.05,.05,0); mk(880,.05,.05,.07); mk(1320,.07,.045,.14); }
    else if (name === 'disarm') { mk(1320,.05,.04,0); mk(880,.05,.04,.07); mk(520,.09,.035,.14); }
    else if (name === 'land') mk(58,.22,.26,0);
    else if (name === 'takeoff') mk(120,.18,.22,0);
    else if (name === 'scanStart') { mk(2200,.08,.03,0); mk(2600,.08,.03,.09); }
    else if (name === 'scanStop') mk(1800,.10,.025,0);
    else if (name === 'test') mk(1000,.3,.12,0);
  };

  DroneSoundEngine.prototype.getLevel = function () {
    if (this.mode === 'worklet' && this.telemetry.level) return this.telemetry.level;
    if (!this.an) return 0;
    var a = new Uint8Array(this.an.fftSize);
    this.an.getByteTimeDomainData(a);
    var pk = 0; for (var i = 0; i < a.length; i++) { var v = Math.abs(a[i] - 128) / 128; if (v > pk) pk = v; }
    return pk;
  };

  DroneSoundEngine.prototype.getStatus = function () {
    return {
      started: this.started,
      ctxState: this.ctx ? this.ctx.state : 'none',
      mode: this.mode,
      err: this.err,
      lastError: this.lastError,
      hasWorkletAPI: !!(this.ctx && this.ctx.audioWorklet)
    };
  };

  DroneSoundEngine.prototype.startRec = function () {
    if (!this.started || this.recording) return false;
    try {
      this.recDest = this.ctx.createMediaStreamDestination();
      this.limiter.connect(this.recDest);
      var caps = (window.MediaRecorder && MediaRecorder.isTypeSupported) ? MediaRecorder.isTypeSupported.bind(MediaRecorder) : function(){ return false; };
      var mime = caps('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : (caps('audio/webm') ? 'audio/webm' : '');
      if (!mime) { this.err = 'MediaRecorder لا يدعم webm هنا'; return false; }
      this.recorder = new MediaRecorder(this.recDest.stream, { mimeType: mime, audioBitsPerSecond: 256000 });
      this.recChunks = [];
      var self = this;
      this.recorder.ondataavailable = function (e) { if (e.data && e.data.size) self.recChunks.push(e.data); };
      this.recorder.start(250);
      this.recording = true; this.recMime = mime;
      return true;
    } catch (e) { console.error(e); this.err = 'rec: ' + e.message; return false; }
  };
  DroneSoundEngine.prototype.stopRec = function (onDone) {
    if (!this.recording) return;
    this.recording = false;
    var rec = this.recorder, self = this;
    rec.onstop = function () {
      try { self.limiter.disconnect(self.recDest); } catch (_) {}
      var blob = new Blob(self.recChunks, { type: self.recMime });
      if (onDone) onDone(blob, self.recMime);
    };
    rec.stop();
  };

  DroneSoundEngine.prototype.dispose = function () {
    if (!this.ctx) return;
    if (this.recording) { try { this.recorder.stop(); } catch (_) {} this.recording = false; }
    if (this.node) { try { this.node.disconnect(); } catch (_) {} }
    if (this.fb) this.fb.dispose();
    try { this.ctx.close(); } catch (_) {}
    this.ctx = null; this.node = null; this.fb = null; this.started = false; this.mode = 'none'; this._p = null;
  };

  return DroneSoundEngine;
}));
