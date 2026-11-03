'use client';
// Grounded street life: rigged CC0 pedestrians (Quaternius) with walk/idle cycles, instanced CC0 cars that obey
// traffic lights, street furniture (traffic signals, benches, bins, curbs) and dense background buildings.
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { clone as skClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useEffect, useMemo, useRef } from 'react';
import { CARS, PEDS } from './assets';
import { ENV, PITCH, ROAD, SETBACK, SHORE, bus, faceOf, lotC, samplePath, type Bounds, type CityShop, type P } from './layout';
import { facadeMap, facadeLit, roofTex } from './tex';

const on = (t: string, f: (d: any) => void) => { const h = (e: any) => f(e.detail); bus.addEventListener(t, h); return () => bus.removeEventListener(t, h); };
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const isPlaza = (kx: number, kz: number) => (kx === -1 || kx === 0) && (kz === -1 || kz === 0);
const M = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
function useInst(ref: React.RefObject<THREE.InstancedMesh | null>, mats: THREE.Matrix4[], colors?: THREE.Color[]) {
  useEffect(() => { const r = ref.current; if (!r) return; mats.forEach((m, i) => r.setMatrixAt(i, m)); colors?.forEach((c, i) => r.setColorAt(i, c)); r.count = mats.length; r.instanceMatrix.needsUpdate = true; if (r.instanceColor) r.instanceColor.needsUpdate = true; r.computeBoundingSphere(); }, [ref, mats, colors]);
}
/** Traffic-light phase shared by cars and signals: 0 = x-axis streets green, 1 = z-axis green, -1 = all red. */
export const SIGNAL = { phase: 0 };
const CYCLE = 9;
function phaseAt(t: number) { const u = t % (CYCLE * 2); return u < CYCLE - 1.2 ? 0 : u < CYCLE ? -1 : u < CYCLE * 2 - 1.2 ? 1 : -1; }
const lines = (b: Bounds) => { const xs: number[] = [], zs: number[] = []; for (let k = b.kx0; k <= b.kx1 + 1; k++) xs.push(k * PITCH); for (let k = b.kz0; k <= 2; k++) zs.push(k * PITCH); return { xs, zs }; };

/* ---------------- background buildings on empty lots + an outer ring of city blocks ---------------- */
export type Filler = { key: string; x: number; z: number; w: number; d: number; h: number; kind: number };
export function fillerLots(inner: Bounds, outer: Bounds, shops: CityShop[], parks: (kx: number, kz: number) => boolean): Filler[] {
  const taken = new Set(shops.map((s) => `${s.plot.gx},${s.plot.gz}`)); const out: Filler[] = [];
  for (let kx = outer.kx0; kx <= outer.kx1; kx++) for (let kz = outer.kz0; kz <= outer.kz1; kz++) {
    if (isPlaza(kx, kz) || parks(kx, kz)) continue; const ring = kx < inner.kx0 || kx > inner.kx1 || kz < inner.kz0;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const gx = kx * 2 + i, gz = kz * 2 + j; if (taken.has(`${gx},${gz}`)) continue; const n = gx * 73.1 + gz * 19.7;
      if (!ring && hash(n) < 0.45) continue; // leave some inner lots open: green space + room for new shops to rise
      const tall = ring ? 1 + (Math.abs(kx) + Math.abs(kz) < 6 ? 1.6 : 0.6) : 0.7; const hh = (4.5 + hash(n * 11) * 9 + (hash(n * 13) > 0.85 ? 14 : 0)) * tall; const kind = hh > 15 && hash(n * 17) > 0.35 ? (hash(n * 19) > 0.5 ? 4 : 6) : Math.floor(hash(n * 3) * 4) + (hash(n * 23) > 0.75 ? 1 : 0);
      out.push({ key: `${gx},${gz}`, x: lotC(gx), z: lotC(gz) - faceOf(gz) * SETBACK, w: 5.4 + hash(n * 5) * 1.2, d: 5 + hash(n * 7) * 0.8, h: hh, kind: Math.min(kind, 6) }); }
  }
  return out;
}
function boxSides(f: Filler, tw: number, th: number) {
  const parts: THREE.BufferGeometry[] = []; const { x, z, w, d, h } = f;
  for (const [ry, len, ox, oz] of [[0, w, 0, d / 2], [Math.PI, w, 0, -d / 2], [Math.PI / 2, d, w / 2, 0], [-Math.PI / 2, d, -w / 2, 0]] as const) {
    const g = new THREE.PlaneGeometry(len, h); const uv = g.attributes.uv as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / tw, uv.getY(i) * h / th);
    g.rotateY(ry); g.translate(x + ox, 0.2 + h / 2, z + oz); parts.push(g); }
  return parts;
}
// warm brick, dark brick, sandstone stucco, terracotta stucco, bronze glass curtain wall, tinted concrete, blue-grey glass
const FILL_TILE: [number, number][] = [[5.6, 6.4], [5.6, 6.4], [5.6, 5.0], [5.6, 5.0], [6, 6], [6, 6], [6, 6]];
const FILL_KEY = ['brick', 'brick', 'stucco', 'stucco', 'glass', 'metal', 'glass'] as const;
const FILL_TINT = ['#e6ad90', '#9c6a55', '#e8cfa6', '#d49a78', '#c9a877', '#cbb9a0', '#9fb1bb'];
const FILL_PBR: [number, number][] = [[0.88, 0], [0.9, 0], [0.85, 0], [0.85, 0], [0.18, 0.75], [0.8, 0.05], [0.15, 0.7]];
export function FillerCity({ items }: { items: Filler[] }) {
  const mats = useMemo(() => FILL_KEY.map((k, i) => new THREE.MeshStandardMaterial({ map: facadeMap(k), emissiveMap: facadeLit(k), emissive: '#ffffff', emissiveIntensity: 0, color: FILL_TINT[i], roughness: FILL_PBR[i][0], metalness: FILL_PBR[i][1], envMapIntensity: FILL_PBR[i][1] > 0.5 ? 1.6 : 1 })), []);
  const roof = useMemo(() => new THREE.MeshStandardMaterial({ map: roofTex(), color: '#7d7f84', roughness: 0.95 }), []);
  const geos = useMemo(() => {
    const sides: THREE.BufferGeometry[][] = FILL_KEY.map(() => []); const roofs: THREE.BufferGeometry[] = []; const trim: THREE.BufferGeometry[] = [];
    items.forEach((f, i) => { sides[f.kind].push(...boxSides(f, FILL_TILE[f.kind][0], FILL_TILE[f.kind][1]));
      const r = new THREE.PlaneGeometry(f.w, f.d); r.rotateX(-Math.PI / 2); r.translate(f.x, 0.2 + f.h, f.z); roofs.push(r);
      const p = new THREE.BoxGeometry(f.w + 0.3, 0.35, f.d + 0.3); p.translate(f.x, 0.2 + f.h + 0.17, f.z); trim.push(p); // parapet
      if (hash(i * 7.7) > 0.4) { const ac = new THREE.BoxGeometry(1.1, 0.7, 0.9); ac.translate(f.x + (hash(i) - 0.5) * f.w * 0.5, 0.2 + f.h + 0.35, f.z + (hash(i * 3) - 0.5) * f.d * 0.5); trim.push(ac); }
      if (hash(i * 9.1) > 0.75) { const tk = new THREE.CylinderGeometry(0.6, 0.6, 1.3, 10); tk.translate(f.x - f.w * 0.25, 0.2 + f.h + 1.6, f.z); const legs = new THREE.BoxGeometry(1, 0.9, 1); legs.translate(f.x - f.w * 0.25, 0.2 + f.h + 0.45, f.z); trim.push(tk.toNonIndexed(), legs.toNonIndexed()); }
    });
    const m = (a: THREE.BufferGeometry[]) => a.length ? mergeGeometries(a.map((g) => g.index ? g.toNonIndexed() : g)) : null;
    return { sides: sides.map(m), roofs: m(roofs), trim: m(trim) };
  }, [items]);
  useFrame(() => { const k = ENV.night; mats.forEach((m) => { m.emissiveIntensity = k * 0.9; }); });
  return <group>
    {geos.sides.map((g, i) => g && <mesh key={i} geometry={g} material={mats[i]} castShadow receiveShadow />)}
    {geos.roofs && <mesh geometry={geos.roofs} material={roof} receiveShadow />}
    {geos.trim && <mesh geometry={geos.trim} castShadow receiveShadow><meshStandardMaterial color="#8c8b87" roughness={0.85} /></mesh>}
  </group>;
}

/* ---------------- street furniture: curbs, traffic signals, benches, bins, hydrants ---------------- */
export function StreetProps({ b }: { b: Bounds }) {
  const curb = useRef<THREE.InstancedMesh>(null), pole = useRef<THREE.InstancedMesh>(null), arm = useRef<THREE.InstancedMesh>(null), box = useRef<THREE.InstancedMesh>(null), lamp = useRef<THREE.InstancedMesh>(null);
  const bench = useRef<THREE.InstancedMesh>(null), bin = useRef<THREE.InstancedMesh>(null), hyd = useRef<THREE.InstancedMesh>(null);
  const d = useMemo(() => {
    const cu: THREE.Matrix4[] = [], po: THREE.Matrix4[] = [], ar: THREE.Matrix4[] = [], bx: THREE.Matrix4[] = [], la: THREE.Matrix4[] = [], laAxis: number[] = [], be: THREE.Matrix4[] = [], bi: THREE.Matrix4[] = [], hy: THREE.Matrix4[] = [];
    const S = PITCH - ROAD;
    for (let kx = b.kx0; kx <= b.kx1; kx++) for (let kz = b.kz0; kz <= b.kz1; kz++) { const cx = kx * PITCH + PITCH / 2, cz = kz * PITCH + PITCH / 2;
      cu.push(M(cx, 0.11, cz - S / 2, S + 0.3, 1, 1), M(cx, 0.11, cz + S / 2, S + 0.3, 1, 1), M(cx - S / 2, 0.11, cz, 1, 1, S + 0.3, Math.PI / 2 * 0 ), M(cx + S / 2, 0.11, cz, 1, 1, S + 0.3));
      if (isPlaza(kx, kz)) continue; const e = S / 2 - 0.35, n = kx * 31 + kz * 7;
      for (const s of [-1, 1]) { be.push(M(cx + 4.8 * s, 0.2, cz + s * e, 1, 1, 1, s > 0 ? Math.PI : 0)); bi.push(M(cx - 1.9 * s, 0.2, cz + s * e)); if (hash(n + s) > 0.5) hy.push(M(cx + s * e, 0.2, cz - 5.5 * s)); }
    }
    // signals on two diagonal corners of every intersection; heads face the approaching axis
    for (let kx = b.kx0; kx <= b.kx1 + 1; kx++) for (let kz = b.kz0; kz <= 2; kz++) { const x = kx * PITCH, z = kz * PITCH, o = ROAD / 2 + 0.35;
      for (const [sx, sz] of [[1, 1], [-1, -1]] as const) { const px = x + sx * o, pz = z + sz * o; po.push(M(px, 1.6, pz)); bx.push(M(px, 2.6, pz + sz * -0.12));
        ar.push(M(px - sx * 1.2, 3.1, pz, 2.4, 1, 1)); bx.push(M(px - sx * 2.2, 2.7, pz, 1, 1, 1, Math.PI / 2));
        // lamps: [x-axis traffic head, z-axis traffic head]
        la.push(M(px - sx * 2.2 + sx * 0.12, 2.7, pz)); laAxis.push(0); la.push(M(px, 2.6, pz - sz * 0.25)); laAxis.push(1); } }
    return { cu, po, ar, bx, la, laAxis, be, bi, hy };
  }, [b.kx0, b.kx1, b.kz0, b.kz1]);
  useInst(curb, d.cu); useInst(pole, d.po); useInst(arm, d.ar); useInst(box, d.bx); useInst(lamp, d.la); useInst(bench, d.be); useInst(bin, d.bi); useInst(hyd, d.hy);
  const last = useRef(-9); const col = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => { const ph = phaseAt(clock.elapsedTime); SIGNAL.phase = ph; const r = lamp.current; if (!r || ph === last.current) return; last.current = ph; const k = 1.5 + ENV.night * 3;
    d.laAxis.forEach((ax, i) => { if (ph === ax) col.setRGB(0.1 * k, 1 * k, 0.35 * k); else if (ph === -1) col.setRGB(1 * k, 0.55 * k, 0.05 * k); else col.setRGB(1 * k, 0.06 * k, 0.04 * k); r.setColorAt(i, col); });
    if (r.instanceColor) r.instanceColor.needsUpdate = true; });
  const benchGeo = useMemo(() => { const seat = new THREE.BoxGeometry(1.4, 0.07, 0.42).translate(0, 0.36, 0); const back = new THREE.BoxGeometry(1.4, 0.36, 0.06).translate(0, 0.6, -0.2); const l1 = new THREE.BoxGeometry(0.06, 0.36, 0.4).translate(-0.6, 0.18, 0); const l2 = l1.clone().translate(1.2, 0, 0); return mergeGeometries([seat, back, l1, l2]); }, []);
  return <group>
    <instancedMesh ref={curb} args={[undefined, undefined, d.cu.length]} receiveShadow><boxGeometry args={[1, 0.24, 0.22]} /><meshStandardMaterial color="#b3ada2" roughness={0.9} /></instancedMesh>
    <instancedMesh ref={pole} args={[undefined, undefined, d.po.length]} castShadow><cylinderGeometry args={[0.06, 0.08, 3.2, 8]} /><meshStandardMaterial color="#2a2c2e" metalness={0.6} roughness={0.5} /></instancedMesh>
    <instancedMesh ref={arm} args={[undefined, undefined, d.ar.length]} castShadow><boxGeometry args={[1, 0.08, 0.08]} /><meshStandardMaterial color="#2a2c2e" metalness={0.6} roughness={0.5} /></instancedMesh>
    <instancedMesh ref={box} args={[undefined, undefined, d.bx.length]} castShadow><boxGeometry args={[0.26, 0.7, 0.22]} /><meshStandardMaterial color="#1d1f1c" roughness={0.6} /></instancedMesh>
    <instancedMesh ref={lamp} args={[undefined, undefined, d.la.length]}><sphereGeometry args={[0.085, 8, 6]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>
    <instancedMesh ref={bench} args={[undefined, undefined, d.be.length]} geometry={benchGeo} castShadow receiveShadow><meshStandardMaterial color="#5b4636" roughness={0.8} /></instancedMesh>
    <instancedMesh ref={bin} args={[undefined, undefined, d.bi.length]} castShadow><cylinderGeometry args={[0.2, 0.17, 0.62, 10]} onUpdate={(g) => g.translate(0, 0.31, 0)} /><meshStandardMaterial color="#3a4237" metalness={0.4} roughness={0.6} /></instancedMesh>
    <instancedMesh ref={hyd} args={[undefined, undefined, Math.max(1, d.hy.length)]} castShadow><cylinderGeometry args={[0.09, 0.11, 0.42, 8]} onUpdate={(g) => g.translate(0, 0.21, 0)} /><meshStandardMaterial color="#8e2b20" roughness={0.6} /></instancedMesh>
  </group>;
}

/* ---------------- cars: instanced CC0 models, stop at red lights and queue behind each other ---------------- */
type Car = { ax: 0 | 1; line: number; dir: number; p: number; v: number; cruise: number; lo: number; hi: number; model: number; tint: THREE.Color };
const CAR_LEN = 2.3;
function bakeModel(scene: THREE.Object3D, len: number) {
  scene.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(scene); const sz = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
  const alongX = sz.x > sz.z; const s = len / Math.max(sz.x, sz.z);
  const fix = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z)); if (alongX) fix.premultiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  const parts: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
  scene.traverse((o: any) => { if (!o.isMesh) return; const g = (o.geometry as THREE.BufferGeometry).clone(); g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(fix, o.matrixWorld));
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.length > 1 && g.groups.length) { g.groups.forEach((gr) => { const sub = g.clone(); sub.setIndex(Array.from((g.index!.array as any).slice(gr.start, gr.start + gr.count))); sub.clearGroups(); parts.push({ geo: sub, mat: mats[gr.materialIndex ?? 0] }); }); }
    else parts.push({ geo: g, mat: mats[0] }); });
  return parts;
}
export function Cars({ b, count }: { b: Bounds; count: number }) {
  const gltfs = useGLTF(CARS) as any[];
  const models = useMemo(() => gltfs.map((g) => bakeModel(g.scene, CAR_LEN).map((p) => { const m = (p.mat as THREE.MeshStandardMaterial).clone(); m.envMapIntensity = 1.2; if ('roughness' in m) m.roughness = Math.min(m.roughness, 0.45); return { ...p, mat: m }; })), [gltfs]);
  const cars = useMemo<Car[]>(() => { const { xs, zs } = lines(b);
    const zlo = b.kz0 * PITCH - 2, zhi = SHORE - 3, xlo = b.kx0 * PITCH - 2, xhi = (b.kx1 + 1) * PITCH + 2;
    return Array.from({ length: count }, (_, i) => { const ax = (i % 2) as 0 | 1; const line = ax ? zs[i % zs.length] : xs[(i >> 1) % xs.length]; const dir = hash(i * 3.3) > 0.5 ? 1 : -1; const lo = ax ? xlo : zlo, hi = ax ? xhi : zhi; const cruise = 4 + hash(i * 1.7) * 3;
      return { ax, line, dir, p: lo + hash(i * 7.1) * (hi - lo), v: cruise, cruise, lo, hi, model: i % CARS.length, tint: new THREE.Color().setHSL(hash(i * 5.3), 0.15, 0.6 + hash(i) * 0.3) }; }); }, [b.kx0, b.kx1, b.kz0, count]);
  const refs = useRef<(THREE.InstancedMesh | null)[][]>([]);
  const perModel = useMemo(() => CARS.map((_, m) => cars.filter((c) => c.model === m)), [cars]);
  const hl = useRef<THREE.InstancedMesh>(null), tl = useRef<THREE.InstancedMesh>(null), hlm = useRef<THREE.MeshBasicMaterial>(null), tlm = useRef<THREE.MeshBasicMaterial>(null);
  const o = useMemo(() => new THREE.Object3D(), []);
  const stopDist = ROAD / 2 + 1.9;
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.1); const ph = SIGNAL.phase;
    for (const c of cars) {
      let target = c.cruise;
      // next intersection ahead in our direction of travel
      const ahead = c.dir > 0 ? Math.ceil((c.p + stopDist) / PITCH) * PITCH : Math.floor((c.p - stopDist) / PITCH) * PITCH; const gap = (ahead - c.p) * c.dir - stopDist;
      if (ph !== c.ax && gap > -0.2 && gap < 6) target = gap < 0.3 ? 0 : Math.min(target, gap * 1.1);
      for (const o2 of cars) { if (o2 === c || o2.ax !== c.ax || o2.line !== c.line || o2.dir !== c.dir) continue; const g = (o2.p - c.p) * c.dir; if (g > 0 && g < 5.5) target = Math.min(target, Math.max(0, (g - CAR_LEN - 0.7) * 1.3)); }
      c.v += (target - c.v) * Math.min(1, dt * 3); c.p += c.v * c.dir * dt; if (c.p > c.hi) c.p = c.lo; if (c.p < c.lo) c.p = c.hi;
    }
    const counts = CARS.map(() => 0); let li = 0;
    cars.forEach((c) => { const lane = c.line + c.dir * (c.ax ? 1.25 : -1.25); const x = c.ax ? c.p : lane, z = c.ax ? lane : c.p; const ry = c.ax ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
      o.position.set(x, 0.02, z); o.rotation.set(0, ry, 0); o.scale.setScalar(1); o.updateMatrix(); const k = counts[c.model]++;
      refs.current[c.model]?.forEach((r) => r?.setMatrixAt(k, o.matrix));
      const put = (r: THREE.InstancedMesh | null, fwd: number) => { if (!r) return; o.position.set(x + Math.sin(ry) * fwd, 0.45, z + Math.cos(ry) * fwd); o.updateMatrix(); r.setMatrixAt(li, o.matrix); };
      put(hl.current, CAR_LEN / 2 + 0.02); put(tl.current, -CAR_LEN / 2 - 0.02); li++; });
    refs.current.forEach((rs, m) => rs?.forEach((r) => { if (r) { r.count = counts[m]; r.instanceMatrix.needsUpdate = true; } }));
    [hl.current, tl.current].forEach((r) => { if (r) { r.count = li; r.instanceMatrix.needsUpdate = true; } });
    const n = ENV.night; if (hlm.current) hlm.current.color.setRGB(0.6 + n * 4, 0.6 + n * 3.6, 0.5 + n * 2.6); if (tlm.current) tlm.current.color.setRGB(0.5 + n * 3, 0.02, 0.03);
  });
  return <group>
    {models.map((parts, m) => parts.map((p, j) => <instancedMesh key={`${m}-${j}`} ref={(r) => { (refs.current[m] ||= [])[j] = r; }} args={[p.geo, p.mat, Math.max(1, perModel[m].length)]} castShadow receiveShadow frustumCulled={false} />))}
    <instancedMesh ref={hl} args={[undefined, undefined, count]} frustumCulled={false}><boxGeometry args={[0.85, 0.09, 0.04]} /><meshBasicMaterial ref={hlm} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={tl} args={[undefined, undefined, count]} frustumCulled={false}><boxGeometry args={[0.85, 0.09, 0.04]} /><meshBasicMaterial ref={tlm} toneMapped={false} /></instancedMesh>
  </group>;
}

/* ---------------- pedestrians: rigged, animated; sidewalk walkers, window-shoppers, people entering/leaving shops ---------------- */
const PED_H = 1.0, WALK = 1.05; // world units ≈ 2 m; walk speed in units/s
type Mode = 'walk' | 'idle' | 'path' | 'off';
type Ped = { obj: THREE.Object3D; mixer: THREE.AnimationMixer; walk: THREE.AnimationAction; idle: THREE.AnimationAction; mode: Mode; anim: 'walk' | 'idle' | '';
  ax: 0 | 1; line: number; off: number; p: number; v: number; lo: number; hi: number; path?: P[]; t0: number; dur: number; fadeIn: boolean; fadeOut: boolean; face: number; idleUntil: number };
export function Pedestrians({ b, count, shops }: { b: Bounds; count: number; shops: CityShop[] }) {
  const gltfs = useGLTF(PEDS) as any[]; const { camera } = useThree();
  const base = useMemo(() => gltfs.map((g) => { const s = g.scene as THREE.Object3D; s.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(s, true); const h = box.max.y - box.min.y || 1;
    s.traverse((o: any) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; const m = o.material as THREE.MeshStandardMaterial; if (m) { m.roughness = Math.max(0.65, m.roughness ?? 0.8); m.metalness = 0; } } });
    return { scene: s, k: PED_H / h, y0: -box.min.y * (PED_H / h), clips: g.animations as THREE.AnimationClip[] }; }), [gltfs]);
  const SLOTS = 14; const total = count + SLOTS;
  const peds = useMemo<Ped[]>(() => { const { xs, zs } = lines(b);
    return Array.from({ length: total }, (_, i) => { const B = base[i % base.length]; const obj = skClone(B.scene); obj.scale.setScalar(B.k * (0.94 + hash(i * 1.3) * 0.12));
      const wrap = new THREE.Group(); wrap.add(obj); obj.position.y = B.y0;
      const mixer = new THREE.AnimationMixer(obj); const clip = (n: string) => B.clips.find((c) => c.name === n) || B.clips[0];
      const walk = mixer.clipAction(clip('Walk')), idle = mixer.clipAction(clip('Idle')); walk.time = hash(i) * 2; idle.time = hash(i * 2) * 3;
      const ax = (i % 2) as 0 | 1; const line = ax ? zs[(i * 7) % zs.length] : xs[(i * 5) % xs.length]; const lo = ax ? b.kx0 * PITCH : b.kz0 * PITCH, hi = ax ? (b.kx1 + 1) * PITCH : SHORE - 3.4;
      const side = hash(i * 2.2) > 0.5 ? 1 : -1;
      return { obj: wrap, mixer, walk, idle, mode: i >= count ? 'off' : 'walk', anim: '', ax, line, off: side * (ROAD / 2 + 0.55 + hash(i) * 0.4), p: lo + hash(i * 9.7) * (hi - lo), v: (0.85 + hash(i * 4.4) * 0.35) * WALK * (hash(i * 6.1) > 0.5 ? 1 : -1), lo, hi, t0: 0, dur: 1, fadeIn: false, fadeOut: false, face: 0, idleUntil: 0 } as Ped; }); }, [base, b.kx0, b.kx1, b.kz0, total, count]);
  const byId = useRef(new Map<string, CityShop>()); useEffect(() => { byId.current = new Map(shops.map((s) => [s.id, s])); }, [shops]);
  const next = useRef(0);
  // Shop visits: a few people walk up the sidewalk and in through the door; others step out and walk away.
  const visit = (s: CityShop, n: number, out = false) => { for (let k = 0; k < n; k++) { const ped = peds[count + (next.current++ % SLOTS)]; const dx = (k - (n - 1) / 2) * 0.35;
    const door: P = [s.x + dx, 0, s.z + s.face * 1.9], walk: P = [s.x + dx, 0, s.z + s.face * (PITCH * 0 + 6 - ROAD / 2 - 0.75)];
    const from: P = [s.x + (hash(k + s.x) > 0.5 ? 1 : -1) * (6 + k * 1.4), 0, walk[2]];
    const path: P[] = out ? [door, walk, from] : [from, walk, door]; ped.path = path; ped.t0 = performance.now() + k * 600; ped.dur = 5600 + k * 300; ped.mode = 'path'; ped.fadeIn = out; ped.fadeOut = !out; } };
  useEffect(() => on('shopper', ({ shopId, n = 3 }: { shopId: string; n?: number }) => { const s = byId.current.get(shopId); if (s) visit(s, Math.min(4, n)); }), [peds]); // eslint-disable-line react-hooks/exhaustive-deps
  // ambient foot traffic in and out of storefronts
  useEffect(() => { const t = setInterval(() => { const list = [...byId.current.values()]; if (!list.length || document.hidden) return; const s = list[(Math.random() * list.length) | 0]; visit(s, 1 + ((Math.random() * 2) | 0), Math.random() > 0.5); }, 3500); return () => clearInterval(t); }, [peds]); // eslint-disable-line react-hooks/exhaustive-deps
  // some walkers stop to window-shop in front of the nearest storefront
  const tmp = useMemo<P>(() => [0, 0, 0], []), tmp2 = useMemo<P>(() => [0, 0, 0], []);
  const play = (p: Ped, a: 'walk' | 'idle') => { if (p.anim === a) return; const to = a === 'walk' ? p.walk : p.idle, from = a === 'walk' ? p.idle : p.walk; to.reset().play(); if (p.anim) to.crossFadeFrom(from, 0.3, false); p.anim = a; };
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.1); const now = performance.now(); const cam = camera.position;
    peds.forEach((p, i) => { let x = 0, z = 0, ry = 0, sc = 1;
      if (p.mode === 'off') { p.obj.visible = false; return; }
      if (p.mode === 'path') { const t = (now - p.t0) / p.dur; if (t < 0) { p.obj.visible = false; return; } if (t > 1) { p.mode = 'off'; p.obj.visible = false; return; }
        samplePath(p.path!, t, tmp); samplePath(p.path!, Math.min(1, t + 0.02), tmp2); if (t > 0.98) samplePath(p.path!, Math.max(0, t - 0.02), tmp2), ry = Math.atan2(tmp[0] - tmp2[0], tmp[2] - tmp2[2]); else ry = Math.atan2(tmp2[0] - tmp[0], tmp2[2] - tmp[2]); x = tmp[0]; z = tmp[2];
        if (p.fadeOut && t > 0.9) sc = Math.max(0.001, (1 - t) / 0.1); if (p.fadeIn && t < 0.1) sc = Math.max(0.001, t / 0.1); play(p, 'walk'); }
      else { // sidewalk walker, occasionally pausing (idle anim) as if looking at a shop window
        if (p.mode === 'idle') { if (now > p.idleUntil) p.mode = 'walk'; play(p, 'idle'); }
        else { p.p += p.v * dt; if (p.p > p.hi) p.p = p.lo; if (p.p < p.lo) p.p = p.hi; play(p, 'walk'); if (hash(i + Math.floor(now / 4000)) > 0.985 && Math.random() < dt) { p.mode = 'idle'; p.idleUntil = now + 3000 + Math.random() * 5000; } }
        x = p.ax ? p.p : p.line + p.off; z = p.ax ? p.line + p.off : p.p; ry = p.mode === 'idle' ? (p.ax ? (p.off > 0 ? 0 : Math.PI) : (p.off > 0 ? Math.PI / 2 : -Math.PI / 2)) : (p.ax ? (p.v > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.v > 0 ? 0 : Math.PI)); }
      const d2 = (x - cam.x) ** 2 + (z - cam.z) ** 2 + cam.y * cam.y * 0.5; const vis = d2 < 120 * 120; p.obj.visible = vis; if (!vis) return;
      p.obj.position.set(x, 0.2, z); p.obj.rotation.y += (((ry - p.obj.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 10); p.obj.scale.setScalar(sc);
      // animation LOD: far people tick at a lower rate
      if (d2 < 45 * 45 || (i + Math.floor(now / 33)) % 3 === 0) p.mixer.update(d2 < 45 * 45 ? dt : dt * 3); });
  });
  return <group>{peds.map((p, i) => <primitive key={i} object={p.obj} />)}</group>;
}
PEDS.forEach((u) => useGLTF.preload(u)); CARS.forEach((u) => useGLTF.preload(u));
