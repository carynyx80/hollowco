import { assetUrl } from './layout';
// Procedural textures (no network): facades, roads, signage. Generated once and shared.
import * as THREE from 'three';
const cache = new Map<string, THREE.CanvasTexture>();
function rnd(seed: number) { let s = seed >>> 0 || 1; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)) >>> 0) / 4294967296; }
export function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, r: () => number) => void, srgb = true) {
  const hit = cache.get(key); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!; draw(g, rnd(key.length * 7919 + key.charCodeAt(0)));
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; cache.set(key, t); return t;
}
const noise = (g: CanvasRenderingContext2D, r: () => number, w: number, h: number, a: number, n = 4000) => { for (let i = 0; i < n; i++) { const v = r() > 0.5 ? 255 : 0; g.fillStyle = `rgba(${v},${v},${v},${a * r()})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } };
/* Facade tiles. Each texture is one tile; geometry UVs are scaled in world units (see TILE). */
export const TILE = { glass: [9.6, 8.8], brick: [5.6, 6.4], stucco: [5.6, 5.0], metal: [6, 6] } as const;
function facade(kind: keyof typeof TILE, lit: boolean) {
  return canvasTex(`f-${kind}-${lit}`, 256, 256, (g, r) => {
    if (kind === 'glass') {
      g.fillStyle = lit ? '#000' : '#2a3d52'; g.fillRect(0, 0, 256, 256);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        const on = r(); const px = x * 32, py = y * 32;
        if (!lit) { const gr = g.createLinearGradient(px, py, px + 32, py + 32); gr.addColorStop(0, '#3e5a76'); gr.addColorStop(1, '#1c2b3c'); g.fillStyle = gr; g.fillRect(px + 2, py + 2, 28, 28); }
        else if (on > 0.62) { g.fillStyle = on > 0.93 ? '#ffffff' : on > 0.8 ? '#ffd9a0' : '#bfe3ff'; g.globalAlpha = 0.55 + r() * 0.45; g.fillRect(px + 3, py + 3, 26, 26); g.globalAlpha = 1; }
      }
      if (!lit) { g.fillStyle = '#9fb3c8'; for (let i = 0; i <= 8; i++) { g.fillRect(i * 32 - 1, 0, 2, 256); g.fillRect(0, i * 32 - 1, 256, 3); } }
    } else if (kind === 'brick') {
      if (!lit) { g.fillStyle = '#8a4a36'; g.fillRect(0, 0, 256, 256); for (let y = 0; y < 256; y += 6) { g.fillStyle = 'rgba(40,20,14,.55)'; g.fillRect(0, y, 256, 1); for (let x = (y / 6) % 2 ? 0 : 8; x < 256; x += 16) g.fillRect(x, y, 1, 6); }
        for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${150 + r() * 60},${60 + r() * 40},${40 + r() * 30},.35)`; g.fillRect(((r() * 16) | 0) * 16, ((r() * 43) | 0) * 6 + 1, 15, 5); } } else { g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); }
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const px = x * 64 + 16, py = y * 64 + 12;
        if (!lit) { g.fillStyle = '#d8cfc0'; g.fillRect(px - 3, py - 5, 38, 6); g.fillRect(px - 3, py + 40, 38, 4); g.fillStyle = '#1b2230'; g.fillRect(px, py, 32, 40); g.fillStyle = '#e9e2d3'; g.fillRect(px + 15, py, 2, 40); g.fillRect(px, py + 18, 32, 2); }
        else if (r() > 0.45) { g.fillStyle = r() > 0.3 ? '#ffcf8a' : '#fff1d6'; g.globalAlpha = 0.6 + r() * 0.4; g.fillRect(px + 1, py + 1, 14, 17); g.fillRect(px + 17, py + 1, 14, 17); g.fillRect(px + 1, py + 20, 14, 19); g.fillRect(px + 17, py + 20, 14, 19); g.globalAlpha = 1; } }
    } else if (kind === 'stucco') {
      if (!lit) { g.fillStyle = '#efe9e0'; g.fillRect(0, 0, 256, 256); noise(g, r, 256, 256, 0.08, 6000); } else { g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); }
      for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) { const px = x * 85 + 24, py = y * 128 + 30;
        if (!lit) { g.fillStyle = '#6d5d4b'; g.fillRect(px - 12, py, 9, 60); g.fillRect(px + 42, py, 9, 60); g.fillStyle = '#20252e'; g.fillRect(px, py, 38, 60); g.fillStyle = '#fff'; g.fillRect(px + 18, py, 2, 60); g.fillRect(px - 4, py + 60, 46, 5); }
        else if (r() > 0.4) { g.fillStyle = '#ffd59a'; g.globalAlpha = 0.7; g.fillRect(px + 1, py + 1, 16, 58); g.fillRect(px + 21, py + 1, 16, 58); g.globalAlpha = 1; } }
    } else {
      if (!lit) { for (let x = 0; x < 256; x += 8) { const gr = g.createLinearGradient(x, 0, x + 8, 0); gr.addColorStop(0, '#9aa3ad'); gr.addColorStop(0.5, '#d6dde3'); gr.addColorStop(1, '#7d868f'); g.fillStyle = gr; g.fillRect(x, 0, 8, 256); } noise(g, r, 256, 256, 0.1, 2500); g.fillStyle = '#2b3440'; for (let x = 12; x < 256; x += 42) g.fillRect(x, 14, 28, 16); }
      else { g.fillStyle = '#000'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#ffe0a8'; for (let x = 12; x < 256; x += 42) if (r() > 0.35) g.fillRect(x + 1, 15, 26, 14); }
    }
  }, !lit);
}
export const facadeMap = (k: keyof typeof TILE) => facade(k, false);
export const facadeLit = (k: keyof typeof TILE) => facade(k, true);
export const roofTex = () => canvasTex('roof', 128, 128, (g, r) => { g.fillStyle = '#4a4d52'; g.fillRect(0, 0, 128, 128); noise(g, r, 128, 128, 0.25, 3000); g.strokeStyle = 'rgba(0,0,0,.25)'; g.strokeRect(4, 4, 120, 120); });
export const roadTex = () => canvasTex('road', 128, 512, (g, r) => {
  g.fillStyle = '#2b2d31'; g.fillRect(0, 0, 128, 512); noise(g, r, 128, 512, 0.18, 9000);
  g.fillStyle = '#e8e8e8'; g.fillRect(6, 0, 4, 512); g.fillRect(118, 0, 4, 512);
  g.fillStyle = '#f2c94c'; for (let y = 0; y < 512; y += 64) g.fillRect(61, y, 6, 36);
});
export const zebraTex = () => canvasTex('zebra', 128, 64, (g) => { g.clearRect(0, 0, 128, 64); g.fillStyle = '#eeeeee'; for (let x = 4; x < 128; x += 16) g.fillRect(x, 0, 9, 64); });
export const paveTex = () => canvasTex('pave', 256, 256, (g, r) => { g.fillStyle = '#9b9a96'; g.fillRect(0, 0, 256, 256); noise(g, r, 256, 256, 0.12, 6000); g.fillStyle = 'rgba(60,60,60,.35)'; for (let i = 0; i <= 256; i += 32) { g.fillRect(i, 0, 1, 256); g.fillRect(0, i, 256, 1); } });
export const grassTex = () => canvasTex('grass', 256, 256, (g, r) => { g.fillStyle = '#3f6b35'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${40 + r() * 60},${90 + r() * 70},${30 + r() * 40},.5)`; g.fillRect(r() * 256, r() * 256, 1, 2 + r() * 3); } });
export const doorTex = () => canvasTex('door', 64, 128, (g) => { g.fillStyle = '#5b636c'; g.fillRect(0, 0, 64, 128); g.fillStyle = '#3a4148'; for (let y = 0; y < 128; y += 8) g.fillRect(0, y, 64, 2); g.fillStyle = '#f2c94c'; g.fillRect(0, 122, 64, 6); });
export function stripeTex(a: string, b: string) { return canvasTex(`stripe-${a}-${b}`, 128, 16, (g) => { for (let x = 0; x < 128; x += 16) { g.fillStyle = (x / 16) % 2 ? b : a; g.fillRect(x, 0, 16, 16); } }); }
/* Shop signage: "<Name>" + "by <owner>" with the logo, drawn into a canvas; redrawn when the logo loads. */
const signs = new Map<string, THREE.CanvasTexture>();
export function signTex(id: string, name: string, owner: string, accent: string, logo?: string) {
  const key = `${id}|${name}|${owner}|${accent}`; const hit = signs.get(key); if (hit) return hit;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 320; const g = c.getContext('2d')!;
  const draw = (img?: HTMLImageElement) => {
    g.clearRect(0, 0, 1024, 320); const r = 36;
    g.fillStyle = '#0b0b14'; g.beginPath(); g.roundRect(8, 8, 1008, 304, r); g.fill();
    g.lineWidth = 10; g.strokeStyle = accent; g.shadowColor = accent; g.shadowBlur = 24; g.beginPath(); g.roundRect(14, 14, 996, 292, r - 6); g.stroke(); g.shadowBlur = 0;
    if (img) { g.save(); g.beginPath(); g.roundRect(40, 40, 240, 240, 28); g.clip(); g.drawImage(img, 40, 40, 240, 240); g.restore(); } else { g.fillStyle = accent; g.globalAlpha = 0.25; g.beginPath(); g.roundRect(40, 40, 240, 240, 28); g.fill(); g.globalAlpha = 1; }
    let fs = 96; g.font = `700 ${fs}px Inter, system-ui, sans-serif`; while (g.measureText(name).width > 680 && fs > 40) { fs -= 4; g.font = `700 ${fs}px Inter, system-ui, sans-serif`; }
    g.fillStyle = '#ffffff'; g.textBaseline = 'alphabetic'; g.fillText(name, 312, 150 + (96 - fs) * 0.3);
    g.font = '500 54px Inter, system-ui, sans-serif'; g.fillStyle = accent; let by = `by ${owner}`; while (g.measureText(by).width > 680) by = by.slice(0, -2) + '…'; g.fillText(by, 314, 240);
    t.needsUpdate = true;
  };
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; draw();
  if (logo) { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => draw(im); im.src = assetUrl(logo); }
  signs.set(key, t); return t;
}
/** BoxGeometry whose side UVs are in world units / tile size, so facade textures don't stretch. */
const geos = new Map<string, THREE.BoxGeometry>();
export function facadeBox(w: number, h: number, d: number, tw: number, th: number) {
  const k = [w, h, d, tw, th].map((v) => v.toFixed(2)).join(); const hit = geos.get(k); if (hit) return hit;
  const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv as THREE.BufferAttribute;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) { const i = f * 4 + v; uv.setXY(i, uv.getX(i) * dims[f][0] / (f === 2 || f === 3 ? 6 : tw), uv.getY(i) * dims[f][1] / (f === 2 || f === 3 ? 6 : th)); }
  uv.needsUpdate = true; geos.set(k, g); return g;
}
