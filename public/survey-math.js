// معادلات المسح المشتركة (دوال نقية بلا اعتماد على الواجهة)
export const DEG = Math.PI / 180, SEC = DEG / 3600, TAU = Math.PI * 2;
export const wrapPi = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
export const dms = (rad, res = 5) => {
  let s = Math.round(rad / DEG * 3600 / res) * res; s = ((s % 1296000) + 1296000) % 1296000;
  return `${Math.floor(s / 3600)}°${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}′${String(s % 60).padStart(2, '0')}″`;
};
export const zenith = (v, face) => (face === 2 ? TAU - v : v);        // زاوية الزنت الحقيقية من قراءة الوجه
export const elev = zen => Math.PI / 2 - zen;                          // الزاوية الرأسية α
export const azimuth = (x1, z1, x2, z2) => Math.atan2(x2 - x1, -(z2 - z1));
export const coords = (E0, N0, x, z) => ({ E: E0 + x, N: N0 - z });
export const kTheory = zen => 200 * Math.tan(elev(zen));               // K للتاكيومتر ذاتي الاختزال
export const levelHI = (rl, bs) => rl + bs;
export const levelRL = (hi, r) => hi - r;
export const leanErr = (R, th) => R * (1 / Math.cos(th) - 1);          // خطأ ميلان الميرا
export const curvRef = D => 0.0675 * (D / 1000) ** 2;                  // الانحناء والانكسار (م)

// تاكيومتري كلاسيكي (تيودوليت): D = 100·s·cos²α ، ΔZ = i + 50·s·sin2α − M
export function stadiaClassic(r, zen, Zs) {
  const s = r.u - r.l, a = elev(zen), m = r.m != null ? r.m : (r.u + r.l) / 2;
  const D = 100 * s * Math.cos(a) ** 2, dz = (r.i ?? 0) + 50 * s * Math.sin(2 * a) - m;
  return { s, D, dz, Z: Zs + dz };
}
// تاكيومتر ذاتي الاختزال (قوانين المقرر): D = (ق ع − ق س)×100 = (ق ع − ق و)×200 ، ΔH = (ق ع − ق و)·K + J − S
export function stadiaReduced(r, Zs) {
  const mm = r.m != null ? r.m : (r.u + r.l) / 2, ss = r.s != null ? r.s : mm, o = { D: (r.u - r.l) * 100, D2: (r.u - mm) * 200 };
  if (r.kc != null) { o.dH = (r.u - mm) * r.kc + (r.i ?? 0) - ss; o.Z = Zs + o.dH; }
  return o;
}
// محطة شاملة: HD = SD·sinZ ، VD = SD·cosZ ، إحداثيات الهدف
export function totalStation(r, c0, Zs) {
  const zen = zenith(r.v, r.face), az = r.face === 2 ? r.hz - Math.PI : r.hz;
  const HD = r.sd * Math.sin(zen), VD = r.sd * Math.cos(zen);
  return { HD, VD, N: c0.N + HD * Math.cos(az), E: c0.E + HD * Math.sin(az), Z: Zs + (r.i ?? 0) + VD - (r.hr ?? 0) };
}
// قياسان على نقطة واحدة بالوجهين (a وجه I و b وجه II): خطأ الفهرس وانحراف خط النظر والمتوسط
export function twoFace(a, b) {
  const ie = wrapPi((a.v + b.v - TAU) / 2), hzd = wrapPi(b.hz - a.hz - Math.PI), zz = Math.min(Math.max(a.v, 0.2), Math.PI - 0.2);
  return { ie, c: hzd * Math.sin(zz) / 2, meanHz: a.hz + wrapPi(b.hz - Math.PI - a.hz) / 2 };
}
