import * as THREE from 'three';

const VERT = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const FRAG = `
uniform sampler2D tMap; uniform float uBlur; uniform float uSoft; uniform float uMode; uniform float uSpread; varying vec2 vUv;
float ln(float d, float w, float s){ return 1.0 - smoothstep(w, w + s, abs(d)); }
float segd(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  vec3 col;
  if (uBlur < 0.0015) { col = texture2D(tMap, vUv).rgb; }
  else {
    float bias = log2(1.0 + uBlur * 700.0);
    float o = uBlur * 0.4;
    col = vec3(0.0);
    for (int i = -1; i <= 1; i++) { for (int j = -1; j <= 1; j++) { col += texture2D(tMap, vUv + vec2(float(i), float(j)) * o, bias).rgb; } }
    col /= 9.0;
  }
  float s = uSoft, w = 0.0045, ws = 0.003 + s;
  // uMode: 0 = تيودوليت ، 1 = تاكيومتر يدوي مختزل (4 شعيرات أفقية + قطعة مائلة) ، 2 = آلي
  float m0 = step(uMode, 0.5), m1 = step(0.5, uMode) * step(uMode, 1.5), m2 = step(1.5, uMode);
  float full = m0 + m2;
  float hy = 0.4775 * uSpread;
  float h1 = ln(p.y, w, ws) * full;
  float v1 = ln(p.x, w, ws);
  float sd = (ln(p.y - hy, w, ws) + ln(p.y + hy, w, ws)) * step(abs(p.x), 0.24) * m0;
  float tU = ln(p.y - hy, w, ws) * step(abs(p.x), 0.32);      // ق ع
  float tM = ln(p.y, w, ws) * step(abs(p.x), 0.3);            // ق و
  float tS = ln(p.y + 0.167, w, ws) * step(abs(p.x), 0.3);    // S (شعيرة التصويب)
  float tL = ln(p.y + hy, w, ws) * step(abs(p.x), 0.32);      // ق س
  float tI = 1.0 - smoothstep(w, w + ws, segd(p, vec2(0.32, hy), vec2(-0.38, 0.17 * hy))); // قطعة مائلة تخرج من العليا
  float line = clamp(h1 + v1 + sd + (tU + tM + tS + tL + tI) * m1, 0.0, 1.0);
  float halo = clamp(ln(p.y, w * 2.6, 0.004 + s) * full + ln(p.x, w * 2.6, 0.004 + s), 0.0, 1.0) * 0.45;
  col = mix(col, vec3(1.0), halo);
  col = mix(col, vec3(0.02), line * (1.0 - clamp(s * 10.0, 0.0, 0.6)));
  col = mix(vec3(0.02, 0.02, 0.03), col, 1.0 - smoothstep(0.985, 1.0, r));
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function createScopeFX(renderer) {
  const rt = new THREE.WebGLRenderTarget(512, 512, { minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true });
  const mat = new THREE.ShaderMaterial({
    uniforms: { tMap: { value: rt.texture }, uBlur: { value: 0 }, uSoft: { value: 0 }, uMode: { value: 0 }, uSpread: { value: 1 } },
    vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false
  });
  const qs = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.frustumCulled = false; qs.add(quad);
  const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  let size = 512;
  return {
    setMode(m) { mat.uniforms.uMode.value = m; },
    setStadia(on) { mat.uniforms.uMode.value = on ? 0 : 2; },
    setSpread(v) { mat.uniforms.uSpread.value = v; },
    draw(scene, cam, vp, blur, soft) {
      const px = Math.max(160, Math.min(768, Math.round(vp.w * renderer.getPixelRatio())));
      if (px !== size) { size = px; rt.setSize(px, px); }
      renderer.setScissorTest(false);
      renderer.setRenderTarget(rt); renderer.render(scene, cam); renderer.setRenderTarget(null);
      mat.uniforms.uBlur.value = blur; mat.uniforms.uSoft.value = soft;
      renderer.setScissorTest(true);
      renderer.setViewport(vp.x, vp.y, vp.w, vp.h); renderer.setScissor(vp.x, vp.y, vp.w, vp.h);
      renderer.render(qs, qc);
      renderer.setScissorTest(false);
    }
  };
}
