// أدوات مشتركة صغيرة بلا اعتماد على بقية المشروع (B-003 خطوة 1)
import * as THREE from 'three';
import * as SM from './survey-math.js';

export const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const V3 = THREE.Vector3, DEG = Math.PI / 180, TAU = Math.PI * 2;
export const wrapPi = SM.wrapPi;
export const cap = (el, id) => { try { el.setPointerCapture(id); } catch (e) { /* تجاهل */ } };
export const numOrNull = v => { const x = parseFloat(v); return Number.isFinite(x) ? x : null; };
export const f3 = v => (v === null || v === undefined || Number.isNaN(v) ? '' : v.toFixed(3));
export const dms = SM.dms;
export function showErr(m) { const b = $('#err'); b.textContent = '⚠ ' + m; b.style.display = 'block'; }
addEventListener('error', e => showErr(e.message));
addEventListener('unhandledrejection', e => showErr(String(e.reason)));
let tT;
export function toast(m) { const t = $('#toast'); t.textContent = m; t.style.opacity = 1; clearTimeout(tT); tT = setTimeout(() => (t.style.opacity = 0), 2800); }
export function openTab(id) { $(`#tabs [data-t="${id}"]`).click(); }
const cache = {};
export function setTxt(sel, v) { if (cache[sel] !== v) { cache[sel] = v; $(sel).textContent = v; } }
export function setCl(sel, v) { const k = sel + '#c'; if (cache[k] !== v) { cache[k] = v; $(sel).className = v; } }

export function say(t, c) { const m = $('#readMsg'); m.textContent = t; m.className = 'stat ' + (c || ''); }
