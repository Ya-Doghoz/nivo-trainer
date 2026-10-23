'use strict';

var TL = 1024, KH = 32, NL = 12, TAU = 6.283185307179586;
var SIN = new Float32Array(512);
for (var si = 0; si < 512; si++) SIN[si] = Math.sin(TAU * si / 512);
function sl(x) { var f = x * 512, i = f | 0, r = f - i, a = i & 511, b = (a + 1) & 511; return SIN[a] + (SIN[b] - SIN[a]) * r; }
function rnd() { return Math.random() * 2 - 1; }
function ok(v) { return (v === v && v > -1e4 && v < 1e4) ? v : 0; }
function cl(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lx(a, b, t) { return a + (b - a) * t; }

/* ====== SmParam: يمنع zipper noise عند تغيير الإعدادات حياً ====== */
function SmParam(init, tauSec) { this.v = init; this.target = init; this.tau = tauSec || 0.008; }
SmParam.prototype.set = function (t) { if (isFinite(t)) this.target = t; };
SmParam.prototype.tick = function (dt) { this.v += (this.target - this.v) * (1 - Math.exp(-dt / this.tau)); return this.v; };
SmParam.prototype.get = function () { return this.v; };

/* ====== بنك الأطياف ====== */
var TABS = (function () {
  var T = new Float32Array(NL * TL), seed = 9176;
  function nx() { seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  for (var l = 0; l < NL; l++) {
    var lvl = l / (NL - 1), p = 1.62 - 0.88 * lvl;
    var amp = new Float32Array(KH + 1), ph = new Float32Array(KH + 1);
    amp[1] = 1.0; amp[2] = 0.851;
    for (var k = 3; k <= KH; k++) amp[k] = 0.851 * Math.pow(k / 2, -p);
    for (k = 1; k <= KH; k++) { if (k & 1) amp[k] *= 0.84 + 0.32 * lvl; ph[k] = nx() * TAU; }
    var mx = 0;
    for (var i = 0; i < TL; i++) {
      var s = 0, x = i / TL;
      for (var k2 = 1; k2 <= KH; k2++) s += amp[k2] * Math.sin(TAU * k2 * x + ph[k2]);
      T[l * TL + i] = s; if (s > mx) mx = s; else if (-s > mx) mx = -s;
    }
    if (mx > 0) for (i = 0; i < TL; i++) T[l * TL + i] /= mx;
  }
  return T;
})();

/* ====== RBJ biquad ====== */
function Biquad() { this.b0 = 1; this.b1 = 0; this.b2 = 0; this.a1 = 0; this.a2 = 0; this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0; }
Biquad.prototype.set = function (type, f0, Q, db, sr) {
  f0 = cl(f0 || 1000, 10, sr * 0.48); Q = Math.max(0.08, Q || 0.7);
  var w0 = TAU * f0 / sr, cw = Math.cos(w0), sw = Math.sin(w0), al = sw / (2 * Q);
  var b0, b1, b2, a0, a1, a2;
  if (type === 'LP') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === 'HP') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else if (type === 'BP') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
  else { var A = Math.pow(10, (db || 0) / 40); b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; }
  this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
};
Biquad.prototype.x = function (v) {
  var y = this.b0 * v + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
  this.x2 = this.x1; this.x1 = v; this.y2 = this.y1; this.y1 = y;
  return ok(y);
};

/* ====== Crossfade Delay Line (Carpentier 2024): انتقال سلس للمسار المنعكس ====== */
function XFadeDelay(size, xfMs) {
  this.M = size - 1; this.buf = new Float32Array(size); this.w = 0;
  this.dOld = 0; this.dNew = 0; this.xfLen = Math.max(1, (size * xfMs / 1000) | 0); this.xfPos = 0; this.active = 0;
}
XFadeDelay.prototype.write = function (v) { this.buf[this.w] = v; this.w = (this.w + 1) & this.M; };
XFadeDelay.prototype.setDelay = function (d) {
  if (Math.abs(d - this.dNew) > 0.5) { this.dOld = this.dNew; this.dNew = d; this.xfPos = this.xfLen; this.active = 1; }
};
XFadeDelay.prototype.read = function () {
  if (!this.active) {
    var i = (this.w - 1 - this.dNew) & this.M;
    return ok(this.buf[i]);
  }
  var t = this.xfPos / this.xfLen, wt = t * t * (3 - 2 * t);   /* smoothstep */
  var iA = (this.w - 1 - this.dOld) & this.M, iB = (this.w - 1 - this.dNew) & this.M;
  var v = this.buf[iA] * wt + this.buf[iB] * (1 - wt);
  this.xfPos--; if (this.xfPos <= 0) this.active = 0;
  return ok(v);
};

/* ====== DLine عادي (للـ ITD) ====== */
function DLine(size) { this.M = size - 1; this.b = new Float32Array(size); this.i = 0; }
DLine.prototype.write = function (v) { this.b[this.i] = v; this.i = (this.i + 1) & this.M; };
DLine.prototype.read = function (d) {
  if (!(d > 0)) return this.b[this.i];
  if (d >= this.M) return 0;
  var i0 = d | 0, fr = d - i0, a = (this.i - i0) & this.M, b = (this.i - i0 - 1) & this.M;
  return ok(this.b[a] + (this.b[b] - this.b[a]) * fr);
};

class DroneProc extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.C = Object.assign({
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
      modes: [[360, 0.26, 1.9], [790, 0.15, 2.1], [1680, 0.09, 2.0], [3150, 0.07, 1.8]],
      vibModes: [[95, 0.55, 3.0], [210, 0.35, 4.0], [420, 0.18, 3.5]],
      rpos: [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]
    }, (options && options.processorOptions) || {});

    var st = 0.008;
    this.P = {
      reflG:        new SmParam(this.C.reflG, st),
      groundFc:     new SmParam(this.C.groundFc, st),
      groundEffect: new SmParam(this.C.groundEffect, st),
      isoC:         new SmParam(this.C.isoC, st),
      dirToneLo:    new SmParam(this.C.dirToneLo, st),
      dirBBLo:      new SmParam(this.C.dirBBLo, st),
      bbTotal:      new SmParam(this.C.bbTotal, st),
      toneGain:     new SmParam(this.C.toneGain, st),
      drive:        new SmParam(this.C.drive, st),
      vibGain:      new SmParam(this.C.vibGain, st),
      windGain:     new SmParam(this.C.windGain, st),
      geomDist:     new SmParam(4, 0.05),
      geomElev:     new SmParam(0, 0.05),
      geomAz:       new SmParam(0, 0.05),
      geomRadial:   new SmParam(0, 0.08),
      onboard:      new SmParam(0, 0.12)
    };

    this.rotors = [];
    for (var i = 0; i < 4; i++) this.rotors.push({
      rear: i >= 2, rpm: 0, tgt: 0,
      phB: Math.random(), phS: Math.random(), phE: Math.random(), phC: Math.random(), phR: Math.random(),
      dr: 0, dv: 0, imp: 0, bwi: 0, subPh: Math.random(), wn: 0,
      lpW: new Biquad(), bpB: new Biquad(), bp2: new Biquad(),
      hpH: new Biquad(), lpH: new Biquad(), hpT: new Biquad(), lpT: new Biquad(), bpI: new Biquad(), bpW: new Biquad()
    });

    this.gustBuf = new Float32Array(8192); this.gustW = 0;
    this.gs1 = 0; this.gs2 = 0; this.gs3 = 0;
    this.ga1 = 0.02; this.ga2 = 0.1; this.ga3 = 0.3;

    this.res = this.C.modes.map(function () { return new Biquad(); });
    this.vib = this.C.vibModes.map(function () { return new Biquad(); });
    this.vibLP = new Biquad();
    this.absD = new Biquad(); this.absR = new Biquad(); this.grndLP = new Biquad();
    this.aw = [new Biquad(), new Biquad(), new Biquad()];
    this.loudLP = new Biquad();
    this.shadow = [new Biquad(), new Biquad()];
    this.pinna = [new Biquad(), new Biquad()];
    this.windT = new Biquad(); this.windBP = new Biquad(); this.phL = 0; this.phG = 0; this.gz = 0; this.whB = new Biquad(); /* NIVO-SND */
    this.imgXF = new XFadeDelay(8192, 5);
    this.itd = new DLine(1024);
    this.blips = []; this._lvl = 0; this._rms = 0;

    this.S = { armed: 0, coll: 0, pitch: 0, roll: 0, yaw: 0, adv: 0, desc: 0, radial: 0,
               px: 0, py: 0, pz: 0, dist: 4, micH: 1.5, onboard: 0, tip: 70, wx: 0, wz: -1, flowAz: 0 };

    var self = this;
    this.port.onmessage = function (e) {
      var d = e.data;
      if (!d) return;
      if (d.type === 'state') { Object.assign(self.S, d); self.mixTargets(); }
      else if (d.type === 'cfg') {
        var v = d.v || {};
        for (var key in v) {
          if (!Object.prototype.hasOwnProperty.call(v, key)) continue;
          var val = v[key];
          if (typeof val === 'number' && isFinite(val)) {
            self.C[key] = val;
            if (self.P[key]) self.P[key].set(val);
          }
          else if (Array.isArray(val)) self.C[key] = val;
        }
      }
      else if (d.type === 'evt') self.evt(d.name);
    };
  }

  mixTargets() {
    var C = this.C, S = this.S;
    if (!S.armed) { for (var i = 0; i < 4; i++) this.rotors[i].tgt = 0; return; }
    var base = (C.rpmIdle + (C.rpmMax - C.rpmIdle) * Math.pow(cl(S.coll, 0, 1), C.rpmExp)) * (1 + (C.totalAddedMass || 0) / (C.massKg || 1.4) * 0.12 * cl(S.coll, 0, 1));
    var d = (C.rpmMax - C.rpmIdle) * 0.10;
    var t = [
      base + S.pitch * d - S.roll * d - S.yaw * d,
      base - S.pitch * d + S.roll * d + S.yaw * d,
      base + S.pitch * d + S.roll * d + S.yaw * d,
      base - S.pitch * d - S.roll * d + S.yaw * d
    ];
    for (var j = 0; j < 4; j++) this.rotors[j].tgt = cl(t[j], C.rpmFloor, C.rpmMax * 1.03);
  }

  evt(name) {
    var t = currentTime, self = this;
    function push(f, d, a, del) { self.blips.push({ e: t + del, f: f, d: d, a: a }); }
    if (name === 'arm')         { push(660, .05, .05, 0); push(880, .05, .05, .07); push(1320, .07, .045, .14); }
    else if (name === 'disarm') { push(1320, .05, .04, 0); push(880, .05, .04, .07); push(520, .09, .035, .14); }
    else if (name === 'land')   { push(58, .22, .26, 0); }
    else if (name === 'test')   { push(1000, .3, .12, 0); }
  }

  process(inputs, outputs) {
    var out = outputs[0]; if (!out || !out[0]) return true;
    var L = out[0], R = out[1] || out[0], n = L.length, sr = sampleRate;
    var C = this.C, S = this.S, P = this.P;
    var bdt = n / sr, OS = Math.max(1, C.OS | 0);

    /* تنعيم كل المعاملات الحية */
    var reflG = P.reflG.tick(bdt);
    var groundFc = P.groundFc.tick(bdt);
    var groundEffect = P.groundEffect.tick(bdt);
    var isoC = P.isoC.tick(bdt);
    var dirToneLo = P.dirToneLo.tick(bdt);
    var dirBBLo = P.dirBBLo.tick(bdt);
    var bbTotal = P.bbTotal.tick(bdt);
    var toneGain = P.toneGain.tick(bdt);
    var drive = P.drive.tick(bdt);
    var vibGain = P.vibGain.tick(bdt);
    var windGain = P.windGain.tick(bdt);
    var onboard = P.onboard.tick(bdt);

    var ob = cl(onboard, 0, 1);
    var rawDist = Math.max(0.35, Math.hypot(S.px, S.py, S.pz));
    var dist = P.geomDist.tick(rawDist);
    var elevRaw = Math.asin(cl(S.py / rawDist, -1, 1));
    var azRaw = Math.atan2(S.px, -S.pz);
    var elev = P.geomElev.tick(elevRaw);
    var az = P.geomAz.tick(azRaw);
    var radial = P.geomRadial.tick(cl(S.radial, -120, 120));

    var rH = Math.hypot(S.px, S.pz);
    var hm = Math.max(0.2, S.micH || C.micH);
    var imgSep = Math.abs(S.py) + 2 * hm;
    var dImg = Math.hypot(rH, imgSep);
    var sinEl = Math.abs(Math.sin(elev)), cosEl = Math.abs(Math.cos(elev));

    var dirTone = lx(dirToneLo, 1, sinEl);
    var dirBB = lx(dirBBLo, 1, cosEl * 0.5 + 0.5);

    var floorLin = Math.pow(10, C.floorDb / 20);
    var geoD = Math.max(floorLin, C.refDist / Math.max(0.35, dist));
    var geoR = Math.max(floorLin * 0.5, reflG * C.refDist / Math.max(0.6, dImg));
    var dImgS = cl((dImg - dist) / C.cSound * sr, 0, this.imgXF.M - 2);

    var fcAbs = 1000 * Math.pow(3 / (isoC * Math.max(1, dist)), 1 / C.isoExp);
    var fcAbsR = 1000 * Math.pow(3 / (isoC * Math.max(1, dImg)), 1 / C.isoExp);
    this.absD.set('LP', fcAbs, 0.45, 0, sr);
    this.absR.set('LP', fcAbsR, 0.45, 0, sr);
    this.grndLP.set('LP', groundFc, 0.5, 0, sr);

    var ge = 1 + groundEffect * Math.exp(-Math.pow(elev / 0.16, 2)) * cl(1 - dist / 120, 0, 1);
    var dop = lx(cl(C.cSound / (C.cSound - cl(radial, -120, 120)), 0.86, 1.16), 1, ob);

    var itdS = lx(cl(0.000685 * Math.sin(az) * (1 - 0.2 * sinEl) * sr, -40, 40), 0, ob);
    var shFc = lx(17000 - 13500 * Math.abs(Math.sin(az)), 20000, ob);
    var far = itdS >= 0 ? 1 : 0;
    this.shadow[0].set('LP', far === 0 ? shFc : 20000, 0.5, 0, sr);
    this.shadow[1].set('LP', far === 1 ? shFc : 20000, 0.5, 0, sr);
    var pnDb = lx(-7 * Math.abs(Math.sin(az)), 0, ob);
    this.pinna[0].set('PK', 1600, 1.4, far === 0 ? 0 : pnDb, sr);
    this.pinna[1].set('PK', 1600, 1.4, far === 1 ? 0 : pnDb, sr);

    this.aw[0].set('HP', C.awLo, 0.62, 0, sr);
    this.aw[1].set('LP', C.awHi, 0.55, 0, sr);
    this.aw[2].set('PK', 107, 1.0, -3.5, sr);

    var adv = cl(S.adv, 0, 1), desc = cl(S.desc, 0, 1);
    var tipV = Math.max(1, S.tip || 70);
    var Uwind = Math.max(2, Math.hypot(S.wx, S.wz));

    var gf = cl(Uwind / (2 * C.propR * 6) * C.gustFc * 6, 0.05, sr * 0.3);
    this.ga1 = 1 - Math.exp(-TAU * gf * 0.22 / sr);
    this.ga2 = 1 - Math.exp(-TAU * gf * 1.0 / sr);
    this.ga3 = 1 - Math.exp(-TAU * gf * 4.5 / sr);

    var windLvl = lx(0.012, 1, ob) * windGain * Math.pow(tipV / 70, 3);
    this.windT.set('LP', cl(300 + tipV * 8, 60, sr * 0.45), 0.6, 0, sr);
    this.windBP.set('BP', cl(120 + tipV * 9, 60, sr * 0.45), 0.5, 0, sr); this.whB.set('BP', 2400 + 1600 * adv, 6, 0, sr);

    for (var ii = 0; ii < 4; ii++) {
      var rt = this.rotors[ii];
      var tau = rt.tgt > rt.rpm ? C.tauUp : C.tauDown;
      rt.rpm += (rt.tgt - rt.rpm) * (1 - Math.exp(-bdt / tau));
      var jit = C.jitter * (1 + (rt.rear ? adv * 1.6 : adv * 0.5));
      rt.dv += (-rt.dv * 2.4 + rnd() * jit) * bdt;
      rt.dr = cl((rt.dr + rt.dv * bdt) * Math.exp(-bdt * 2.2), -260, 260);
    }

    var Mh = TAU * C.rpmIdle / 60 * C.propR / C.cSound + 1e-6;
    var Pr = [];
    for (var m = 0; m < 4; m++) {
      var r = this.rotors[m];
      var rpm = Math.max(0, r.rpm + r.dr);
      var shaft = rpm / 60, bpf = shaft * C.blades * dop;
      var lvl = cl((rpm - C.rpmIdle) / (C.rpmMax - C.rpmIdle), 0, 1);
      var tf = lvl * (NL - 1); var li = tf | 0, lf = tf - li; if (li >= NL - 1) { li = NL - 2; lf = 1; }
      var load = 0.10 + 0.90 * lvl * lvl * (0.55 + 0.45 * lvl);
      var stall = cl((load - C.stallAt) / (1 - C.stallAt), 0, 1);
      var Mt = TAU * rpm / 60 * C.propR / C.cSound;
      var teScale = cl(Math.pow(Mt / Math.max(0.05, Mh), 2.0), 0.4, 3.2);

      var rp = C.rpos[m];
      var wlen = Math.max(0.5, Uwind);
      var tauS = cl((rp[0] * S.wx + rp[1] * S.wz) / wlen / C.cSound * sr * 60, -3000, 3000);

      r.lpW.set('LP', 200 + 700 * lvl, 0.6, 0, sr);
      r.bpB.set('BP', bpf, 0.62, 0, sr);
      r.bp2.set('BP', bpf * 2, 0.95, 0, sr);
      r.hpH.set('HP', 1000, 0.7, 0, sr);
      r.lpH.set('LP', 8000, 0.7, 0, sr);
      r.hpT.set('HP', 2000, 0.7, 0, sr);
      r.lpT.set('LP', 8000, 0.7, 0, sr);
      r.bpI.set('BP', 1.6 * bpf + 900, 2.6, 0, sr);
      r.bpW.set('BP', bpf, 1.2, 0, sr);

      Pr.push({ r: r, bpf: bpf, shaft: shaft * dop, li: li * TL, lj: (li + 1) * TL, lf: lf, load: load, lvl: lvl, stall: stall, teScale: teScale, tauS: tauS,
               esc: cl(shaft * C.polePairs, 20, sr * 0.45),
               cog: cl(shaft * C.slots, 20, sr * 0.45),
               wakeMul: r.rear ? (1 + adv * 1.5) : (1 + adv * 0.3),
               bwiMul: desc * 1.0 + (r.rear ? adv * 0.7 : 0) });
    }
    for (var z = 0; z < C.modes.length; z++) this.res[z].set('PK', C.modes[z][0], C.modes[z][2], 6, sr);
    for (z = 0; z < C.vibModes.length; z++) this.vib[z].set('PK', C.vibModes[z][0], C.vibModes[z][2], 6, sr);
    this.vibLP.set('LP', 150, 0.6, 0, sr);

    var shareSum = (C.washShare + C.hissShare + C.teShare) || 1;
    var gw = bbTotal * (C.washShare / shareSum);
    var gh = bbTotal * (C.hissShare / shareSum);
    var gt = bbTotal * (C.teShare / shareSum);

    this.imgXF.setDelay(dImgS);

    var incB = 1 / (sr * OS), incS = 1 / sr;
    var flowAz = S.flowAz || 0;
    var peak = 0, rmsAcc = 0;

    for (var s = 0; s < n; s++) {
      var nzg = rnd();
      this.gs1 += (nzg - this.gs1) * this.ga1;
      this.gs2 += (nzg - this.gs2) * this.ga2;
      this.gs3 += (nzg - this.gs3) * this.ga3;
      var gv = this.gs1 * 0.50 + this.gs2 * 0.33 + this.gs3 * 0.17;
      this.gustBuf[this.gustW] = gv; this.gustW = (this.gustW + 1) & 8191;

      var tonal = 0, wash = 0, hiss = 0, te = 0, es = 0, cg = 0, sub = 0;

      for (var q = 0; q < 4; q++) {
        var pp = Pr[q], rr = pp.r;
        var acc = 0;
        var iB = pp.bpf * incB, iS = pp.shaft * incB;
        for (var o = 0; o < OS; o++) {
          rr.phB += iB;
          if (rr.phB >= 1) { rr.phB -= 1; rr.imp = 1; }
          rr.phS += iS; if (rr.phS >= 1) rr.phS -= 1;
          var idx = rr.phB * TL, i0 = idx | 0, fr = idx - i0, i1 = (i0 + 1) & (TL - 1);
          var v0 = TABS[pp.li + i0] + (TABS[pp.li + i1] - TABS[pp.li + i0]) * fr;
          var v1 = TABS[pp.lj + i0] + (TABS[pp.lj + i1] - TABS[pp.lj + i0]) * fr;
          acc += (v0 + (v1 - v0) * pp.lf) * (1 + C.sideDepth * sl(rr.phS));
        }
        tonal += (acc / OS) * toneGain * pp.load;

        if (pp.stall > 0.001) {
          rr.subPh += pp.bpf * 0.5 * incB; if (rr.subPh >= 1) rr.subPh -= 1;
          sub += sl(rr.subPh) * pp.stall * C.subGain * pp.load;
        }

        rr.phR += pp.shaft * incS;
        if (rr.phR >= 1) { rr.phR -= 1; if (pp.bwiMul > 0.02) rr.bwi = pp.bwiMul * (0.5 + 0.5 * Math.random()); }

        if (rr.imp > 0.0005) { rr.imp *= Math.exp(-bdt / C.impDecay); tonal += rr.bpI.x(rr.imp * rnd()) * C.impGain * pp.load; }
        else rr.imp = 0;
        if (rr.bwi > 0.0005) { rr.bwi *= Math.exp(-bdt / 0.004); wash += rr.bpW.x(rr.bwi * rnd()) * 0.6 * pp.load; }
        else rr.bwi = 0;

        var gd = Math.abs(pp.tauS);
        if (gd > 8190) gd = 8190;
        var gi0 = gd | 0, gfr = gd - gi0;
        var ga = (this.gustW - 1 - gi0) & 8191, gb = (this.gustW - 2 - gi0) & 8191;
        var tin = (this.gustBuf[ga] + (this.gustBuf[gb] - this.gustBuf[ga]) * gfr) * (0.3 + 0.7 * pp.lvl);
        rr.wn += (rnd() - rr.wn) * 0.35;
        var wake = rr.wn * pp.wakeMul * (0.2 + 0.8 * adv);
        var selfN = rnd();
        var asym = 1 + C.asymDepth * adv * Math.sin(rr.phR * TAU - flowAz);

        var bbIn = (tin + wake * 0.8);
        var ww = rr.lpW.x(bbIn * 10);
        var b1 = rr.bpB.x(ww), b2 = rr.bp2.x(ww);
        var env = 1 + C.bbMod * sl(rr.phB);
        wash += (ww * 1.0 + b1 * 0.85 + b2 * 0.5) * env * (1 + pp.stall * 0.8);

        var hpr = rr.lpH.x(rr.hpH.x(selfN * asym));
        hiss += hpr * (0.55 + 0.45 * sl(rr.phB * 2)) * asym;

        var tep = rr.lpT.x(rr.hpT.x(selfN));
        te += tep * pp.teScale * (1 + adv * 0.6);

        rr.phE += pp.esc * incS; if (rr.phE >= 1) rr.phE -= 1;
        es += sl(rr.phE) * (0.72 + 0.28 * sl(rr.phS));
        rr.phC += pp.cog * incS; if (rr.phC >= 1) rr.phC -= 1;
        cg += sl(rr.phC) * pp.lvl * pp.lvl;
      }

      var loadAvg = (Pr[0].load + Pr[3].load) * 0.5;
      var xm = tonal * 0.6 * dirTone
            + wash * gw * (0.22 + 0.78 * loadAvg) * dirBB
            + hiss * gh * (0.2 + 0.8 * loadAvg) * dirBB
            + te * gt * dirBB
            + es * C.escGain * loadAvg
            + cg * C.cogGain
            + sub * dirTone;
      if (C.lidarHz > 0) { this.phL += C.lidarHz * incS; if (this.phL >= 1) this.phL -= 1; xm += (sl(this.phL) * 0.6 + sl((this.phL * 2) % 1) * 0.25) * 0.02; }
      if (C.gimbleHum > 0) { this.phG += C.gimbleHum * incS; if (this.phG >= 1) this.phG -= 1; this.gz += (rnd() - this.gz) * 0.4; xm += (sl(this.phG) * 0.5 + this.gz * 0.5) * 0.008; }
      if (C.dragWhistle > 0) xm += this.whB.x(rnd()) * C.dragWhistle * adv * 3;

      for (var zz = 0; zz < this.res.length; zz++) xm += this.res[zz].x(xm) * C.modes[zz][1];

      var drv = drive * (1 + Pr[0].stall * C.stallAmt);
      xm = Math.tanh(xm * drv) / drv;

      this.imgXF.write(xm);
      var xr = this.grndLP.x(this.imgXF.read());
      var gPath = this.absD.x(xm) * geoD * ge + this.absR.x(xr) * geoR;

      var vibv = this.vibLP.x(xm) * 1.6 + this.vib[0].x(xm) * C.vibModes[0][1] * 2.2
               + this.vib[1].x(xm) * C.vibModes[1][1] * 1.8 + this.vib[2].x(xm) * C.vibModes[2][1] * 1.2;
      var oPath = xm * 1.15 + vibv * vibGain * (0.3 + 0.7 * loadAvg);

      var mm = lx(gPath, oPath, ob);
      mm += this.windBP.x(this.windT.x(rnd())) * windLvl;

      var absM = mm < 0 ? -mm : mm; if (absM > peak) peak = absM; rmsAcc += mm * mm;

      var loud = cl(this._lvl * 6, 0, 1);
      this.loudLP.set('LP', 3200 + 13000 * loud, 0.5, 0, sr);
      mm = this.loudLP.x(mm) * (0.55 + 0.45 * loud) + mm * 0.45;
      mm = this.aw[2].x(this.aw[1].x(this.aw[0].x(mm)));

      for (var bi = this.blips.length - 1; bi >= 0; bi--) {
        var bl = this.blips[bi], bt = currentTime - bl.e;
        if (bt < 0) continue;
        if (bt > bl.d) { this.blips.splice(bi, 1); continue; }
        mm += Math.sin(TAU * bl.f * bt) * bl.a * Math.exp(-bt * 20) * geoD * 3;
      }
      mm = ok(mm);

      this.itd.write(mm);
      var dl = itdS > 0 ? itdS : 0, dr2 = itdS < 0 ? -itdS : 0;
      var sL = dl ? this.itd.read(dl) : mm;
      var sR = dr2 ? this.itd.read(dr2) : mm;
      L[s] = this.pinna[0].x(this.shadow[0].x(sL));
      R[s] = this.pinna[1].x(this.shadow[1].x(sR));
    }

    this._lvl += (peak - this._lvl) * 0.06;
    this._rms += (Math.sqrt(rmsAcc / n) - this._rms) * 0.05;
    this.port.postMessage({
      type: 'tel',
      rpm: this.rotors.map(function (r) { return r.rpm + r.dr; }),
      lvl: this._lvl, rms: this._rms, stall: Pr[0].stall,
      dirTone: dirTone, dirBB: dirBB, dist: dist, elev: elev,
      applied: { toneGain: toneGain, bbTotal: bbTotal, drive: drive, reflG: reflG, groundFc: groundFc, OS: C.OS }
    });
    return true;
  }
}
registerProcessor('drone-proc', DroneProc);
