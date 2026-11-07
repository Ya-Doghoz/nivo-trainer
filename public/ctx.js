// الإعدادات — استُخرج من main.js (B-003)
import * as THREE from 'three';
import { $ } from './util.js';
import { createScopeFX } from './scopefx.js';
import { renderer } from './world.js';
import * as I from './instrument.js';

export const FOV = 1.2;
export const cam = new THREE.PerspectiveCamera(50, 1, 0.1, 3600);
export const scopeCam = new THREE.PerspectiveCamera(FOV, 1, 1, 400);
export const cv = $('#c'), scopeEl = $('#scope'), fx = createScopeFX(renderer);
export const elSheet = $('#sheet'), elT1 = $('#t1'), elLegs = $('#legsBox'), jogT = $('#jogT'), mapBox = $('#mapBox'), lblBox = $('#labels');
const mqSide = matchMedia('(min-width:760px) and (min-aspect-ratio:5/4)');
export const sideLayout = () => mqSide.matches;
export const isTT = () => I.type !== 'level';
export const eyeIdeal = 0.3 + Math.random() * 0.4;
export const mapOpen = () => mapBox.style.display === 'block';
