import * as THREE from 'three';
import { holder } from './world.js';

// الميرا والقطب يميلان حول قاعدتهما (tiltG)
const tiltG = new THREE.Group(); holder.group.add(tiltG);
const g = new THREE.Group(); g.visible = false; tiltG.add(g);
const L = c => new THREE.MeshLambertMaterial({ color: c });

function plateTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#ff7a00'; x.fillRect(0, 0, 128, 16); x.fillRect(0, 112, 128, 16); x.fillRect(0, 0, 16, 128); x.fillRect(112, 0, 16, 128);
  x.fillStyle = '#1f3b5c'; x.beginPath(); x.arc(64, 64, 30, 0, 7); x.fill();
  x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.moveTo(64, 36); x.lineTo(64, 92); x.moveTo(36, 64); x.lineTo(92, 64); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 8), L(0x333333)); g.add(pole);
export const prismFace = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: plateTex() })); g.add(prismFace);
const prism = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 20), L(0x1f3b5c)); prism.rotation.x = Math.PI / 2; g.add(prism);

let hr = 1.5;
export function setPrismHeight(h) {
  hr = Math.min(2.6, Math.max(0.8, h));
  pole.scale.y = hr + 0.3; pole.position.y = (hr + 0.3) / 2;
  prismFace.position.set(0, hr, 0.0115); prism.position.set(0, hr, 0.03);
}
export const getPrismHeight = () => hr;

const body = holder.group.children.find(o => o.isMesh && o.geometry.type === 'BoxGeometry');
if (body) tiltG.add(body);
tiltG.add(holder.face);
export function setTarget(kind) {
  const ps = kind === 'prism';
  g.visible = ps; if (body) body.visible = !ps; holder.face.visible = !ps;
}
// خطأ صفر الميرا: يُزاح التدريج عن قاعدتها
export function setStaffZero(e) { holder.face.position.y = 2 + e; }
// ميلان الميرا/القطب (راديان): lean أمام/خلف (موجب نحو الجهاز) و roll جانبي
let lean = 0, roll = 0;
export function setStaffTilt(l, r) { lean = l; roll = r; tiltG.rotation.set(l, 0, r); }
export const getStaffTilt = () => ({ lean, roll });
setPrismHeight(1.5);
