// Real-world assets (CC0, see /public/city/CREDITS.md): photo textures, HDRI, rigged people and cars.
// Images are preloaded once (behind the loading screen) so the canvas-drawn facades can use them synchronously.
export const TEX = ['asphalt', 'asphalt_n', 'pavers', 'pavers_n', 'brick_red', 'brick_red_n', 'brick_tan', 'concrete', 'concrete_n', 'plaster'] as const;
export type TexName = (typeof TEX)[number];
export const texUrl = (n: TexName) => `/city/tex/${n}.webp`;
export const HDRI = '/city/hdri/potsdamer_platz_1k.hdr';
export const PEDS = Array.from({ length: 8 }, (_, i) => `/city/models/ped${i}.glb`);
export const CARS = Array.from({ length: 6 }, (_, i) => `/city/models/car${i}.glb`);
const imgs = new Map<string, HTMLImageElement>();
export const img = (n: TexName) => imgs.get(n);
let pending: Promise<void> | null = null;
export function preloadImages(onStep?: (done: number, total: number) => void) {
  if (pending) return pending; let done = 0;
  pending = Promise.all(TEX.map((n) => new Promise<void>((res) => { const im = new Image(); im.onload = () => { imgs.set(n, im); onStep?.(++done, TEX.length); res(); }; im.onerror = () => { onStep?.(++done, TEX.length); res(); }; im.src = texUrl(n); }))).then(() => {});
  return pending;
}
