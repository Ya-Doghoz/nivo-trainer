// تحميل نماذج glb مخصّصة من public/models: level.glb و theo.glb و tach.glb و ts.glb
import * as THREE from 'three';
import { GLTFLoader } from '/three/examples/jsm/loaders/GLTFLoader.js';
import * as I from './instrument.js';

const loader = new GLTFLoader();
const find = (o, name) => { let r = null; o.traverse(x => { if (!r && x.name.toLowerCase() === name) r = x; }); return r; };

function attach(kind, root) {
  root.updateMatrixWorld(true);
  const ali = root.children.find(o => o.name.toLowerCase() === 'alidade') || null;
  const axis = find(root, 'axis') || find(root, 'telescope');
  if (axis) I.TYPES[kind].trunH = new THREE.Vector3().setFromMatrixPosition(axis.matrixWorld).y; // ارتفاع محور النظر
  const base = new THREE.Group();
  root.children.slice().forEach(o => { if (o !== ali) base.add(o); });
  I.instRoot.add(base);               // الأجزاء الثابتة: تميل مع الجهاز
  if (ali) I.rotating.add(ali);       // الجزء الدوّار: يدور بالدوران الأفقي
  const tel = ali && find(ali, 'telescope');
  if (tel && kind !== 'level') I.ttTel[kind] = tel; // المنظار يدور رأسياً حول محور X
  I.custom[kind] = { base, ali };
  I.parts.forEach(p => { if (p.type === kind) p.obj.visible = false; });
  I.setType(I.type);
  dispatchEvent(new Event('nivo-custom'));
  console.log('✓ نموذج مخصّص محمَّل:', kind);
}

['level', 'theo', 'tach', 'ts'].forEach(kind => {
  loader.load('/models/' + kind + '.glb?v=' + Date.now(), g => attach(kind, g.scene), undefined, () => { /* لا يوجد ملف: يبقى النموذج المدمج */ });
});

(function tick() {
  for (const k in I.custom) { const c = I.custom[k], v = I.type === k; c.base.visible = v; if (c.ali) c.ali.visible = v; }
  requestAnimationFrame(tick);
})();
