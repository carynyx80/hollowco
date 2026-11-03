'use client';
// Streets, blocks, parks, streetlights, trees, water, traffic and pedestrians. Everything repeated is instanced.
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { ENV, PITCH, ROAD, SHORE, bus, lotC, samplePath, type Bounds, type CityShop, type P } from './layout';
import { grassTex, paveTex, roadTex, zebraTex } from './tex';

const on = (t: string, f: (d: any) => void) => { const h = (e: any) => f(e.detail); bus.addEventListener(t, h); return () => bus.removeEventListener(t, h); };
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const isPlaza = (kx: number, kz: number) => (kx === -1 || kx === 0) && (kz === -1 || kz === 0);
export const isCartLot = (kx: number, kz: number) => kx === 0 && kz === -1;
export const isPark = (kx: number, kz: number) => isPlaza(kx, kz) && !(kx === -1 && kz === -1) && !isCartLot(kx, kz);
function useInst(ref: React.RefObject<THREE.InstancedMesh | null>, mats: THREE.Matrix4[], colors?: THREE.Color[]) {
  useEffect(() => { const r = ref.current; if (!r) return; mats.forEach((m, i) => r.setMatrixAt(i, m)); if (colors) colors.forEach((c, i) => r.setColorAt(i, c)); r.count = mats.length; r.instanceMatrix.needsUpdate = true; if (r.instanceColor) r.instanceColor.needsUpdate = true; r.computeBoundingSphere(); }, [ref, mats, colors]);
}
const M = (x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));

/* ---------- ground: blocks (sidewalk slabs), streets with lane markings, crosswalks, parks ---------- */
export function Ground({ b, shops }: { b: Bounds; shops: CityShop[] }) {
  const x0 = b.kx0 * PITCH - ROAD / 2, x1 = (b.kx1 + 1) * PITCH + ROAD / 2, z0 = b.kz0 * PITCH - ROAD / 2, z1 = SHORE;
  const blocks = useRef<THREE.InstancedMesh>(null); const parks = useRef<THREE.InstancedMesh>(null); const zebra = useRef<THREE.InstancedMesh>(null); const xs = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const bl: THREE.Matrix4[] = [], pk: THREE.Matrix4[] = [], zb: THREE.Matrix4[] = [], it: THREE.Matrix4[] = [];
    for (let kx = b.kx0; kx <= b.kx1; kx++) for (let kz = b.kz0; kz <= b.kz1; kz++) { const cx = kx * PITCH + PITCH / 2, cz = kz * PITCH + PITCH / 2; bl.push(M(cx, 0.1, cz, PITCH - ROAD, 0.2, PITCH - ROAD)); if (isPark(kx, kz)) pk.push(M(cx, 0.205, cz, PITCH - ROAD - 1.6, 1, PITCH - ROAD - 1.6)); }
    for (let kx = b.kx0; kx <= b.kx1 + 1; kx++) for (let kz = b.kz0; kz <= 2; kz++) { const x = kx * PITCH, z = kz * PITCH; it.push(M(x, 0.012, z, ROAD, 1, ROAD));
      zb.push(M(x, 0.02, z + ROAD / 2 + 0.9, 1, 1, 1, 0)); if (kz > b.kz0) zb.push(M(x, 0.02, z - ROAD / 2 - 0.9, 1, 1, 1, 0)); zb.push(M(x + ROAD / 2 + 0.9, 0.02, z, 1, 1, 1, Math.PI / 2)); zb.push(M(x - ROAD / 2 - 0.9, 0.02, z, 1, 1, 1, Math.PI / 2)); }
    return { bl, pk, zb, it };
  }, [b.kx0, b.kx1, b.kz0, b.kz1]);
  useInst(blocks, data.bl); useInst(parks, data.pk); useInst(zebra, data.zb); useInst(xs, data.it);
  const road = useMemo(() => roadTex(), []); const pave = useMemo(() => { const t = paveTex().clone(); t.repeat.set(4, 4); t.needsUpdate = true; return t; }, []); const grass = useMemo(() => { const t = grassTex().clone(); t.repeat.set(3, 3); t.needsUpdate = true; return t; }, []);
  const streets = useMemo(() => { const out: { x: number; z: number; len: number; rot: number }[] = [];
    for (let kx = b.kx0; kx <= b.kx1 + 1; kx++) out.push({ x: kx * PITCH, z: (z0 + z1 - ROAD) / 2 + 0.5, len: z1 - z0 - 1, rot: 0 });
    for (let kz = b.kz0; kz <= 2; kz++) out.push({ x: (x0 + x1) / 2, z: kz * PITCH, len: x1 - x0, rot: Math.PI / 2 });
    return out; }, [b.kx0, b.kx1, b.kz0, x0, x1, z0, z1]);
  void shops;
  return <group>
    <mesh rotation-x={-Math.PI / 2} position={[(x0 + x1) / 2, -0.02, (z0 + SHORE) / 2 - 30]} receiveShadow><planeGeometry args={[x1 - x0 + 400, SHORE - z0 + 340]} /><meshStandardMaterial color="#39402f" roughness={1} /></mesh>
    {streets.map((s, i) => { const t = road.clone(); t.repeat.set(1, s.len / 8); t.needsUpdate = true; return <mesh key={i} rotation={[-Math.PI / 2, 0, s.rot]} position={[s.x, 0.006, s.z]} receiveShadow><planeGeometry args={[ROAD, s.len]} /><meshStandardMaterial map={t} roughness={0.92} metalness={0} /></mesh>; })}
    <instancedMesh ref={xs} args={[undefined, undefined, data.it.length]} receiveShadow><boxGeometry args={[1, 0.004, 1]} /><meshStandardMaterial color="#2b2d31" roughness={0.95} /></instancedMesh>
    <instancedMesh ref={zebra} args={[undefined, undefined, data.zb.length]}><planeGeometry args={[ROAD - 0.6, 1.4]} onUpdate={(g) => g.rotateX(-Math.PI / 2)} /><meshStandardMaterial map={zebraTex()} transparent roughness={0.8} /></instancedMesh>
    <instancedMesh ref={blocks} args={[undefined, undefined, data.bl.length]} receiveShadow castShadow={false}><boxGeometry /><meshStandardMaterial map={pave} color="#b9b7b1" roughness={0.9} /></instancedMesh>
    <instancedMesh ref={parks} args={[undefined, undefined, data.pk.length]} receiveShadow><boxGeometry args={[1, 0.02, 1]} /><meshStandardMaterial map={grass} roughness={1} /></instancedMesh>
    {/* roundabout at the beacon */}
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 0]}><circleGeometry args={[2.2, 40]} /><meshStandardMaterial color="#4b7a3e" roughness={1} /></mesh>
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.035, 0]}><ringGeometry args={[2.2, 2.45, 40]} /><meshStandardMaterial color="#d9d6cf" /></mesh>
  </group>;
}

/* ---------- streetlights with night-only light pools ---------- */
export function Lamps({ b }: { b: Bounds }) {
  const pole = useRef<THREE.InstancedMesh>(null), head = useRef<THREE.InstancedMesh>(null), pool = useRef<THREE.InstancedMesh>(null);
  const headMat = useRef<THREE.MeshBasicMaterial>(null), poolMat = useRef<THREE.MeshBasicMaterial>(null);
  const d = useMemo(() => { const p: THREE.Matrix4[] = [], h: THREE.Matrix4[] = [], l: THREE.Matrix4[] = [];
    for (let kx = b.kx0; kx <= b.kx1; kx++) for (let kz = b.kz0; kz <= b.kz1; kz++) { const cx = kx * PITCH + PITCH / 2, cz = kz * PITCH + PITCH / 2, e = PITCH / 2 - ROAD / 2 - 0.35;
      for (const [dx, dz, ry] of [[-e, -e, 0], [e, -e, 0], [-e, e, 0], [e, e, 0], [0, -e, 0], [0, e, 0], [-e, 0, 1], [e, 0, 1]] as const) {
        const x = cx + dx, z = cz + dz; const ox = ry ? Math.sign(dx) * 0.9 : 0, oz = ry ? 0 : Math.sign(dz || 1) * 0.9;
        p.push(M(x, 2.1, z)); h.push(M(x + ox, 4.15, z + oz, ry ? 1.8 : 0.5, 1, ry ? 0.5 : 1.8)); l.push(M(x + ox * 1.6, 0.03, z + oz * 1.6)); } }
    return { p, h, l }; }, [b.kx0, b.kx1, b.kz0, b.kz1]);
  useInst(pole, d.p); useInst(head, d.h); useInst(pool, d.l);
  useFrame(() => { const n = ENV.night; if (headMat.current) headMat.current.color.setRGB(0.3 + n * 3.2, 0.3 + n * 2.6, 0.25 + n * 1.6); if (poolMat.current) poolMat.current.opacity = Math.max(0, n - 0.35) * 0.55; });
  return <group>
    <instancedMesh ref={pole} args={[undefined, undefined, d.p.length]} castShadow><cylinderGeometry args={[0.06, 0.09, 4.2, 6]} /><meshStandardMaterial color="#2c3036" metalness={0.7} roughness={0.4} /></instancedMesh>
    <instancedMesh ref={head} args={[undefined, undefined, d.h.length]}><boxGeometry args={[0.35, 0.12, 0.35]} /><meshBasicMaterial ref={headMat} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={pool} args={[undefined, undefined, d.l.length]}><circleGeometry args={[2.4, 20]} onUpdate={(g) => g.rotateX(-Math.PI / 2)} /><meshBasicMaterial ref={poolMat} color="#ffb85c" transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} /></instancedMesh>
  </group>;
}

/* ---------- trees: sidewalk rows, parks, empty lots ---------- */
export function Trees({ b, shops, density, filled }: { b: Bounds; shops: CityShop[]; density: number; filled?: Set<string> }) {
  const trunk = useRef<THREE.InstancedMesh>(null), crown = useRef<THREE.InstancedMesh>(null);
  const taken = useMemo(() => new Set([...shops.map((s) => `${s.plot.gx},${s.plot.gz}`), ...(filled || [])]), [shops, filled]);
  const d = useMemo(() => { const t: THREE.Matrix4[] = [], c: THREE.Matrix4[] = [], col: THREE.Color[] = []; let n = 0;
    const add = (x: number, z: number, s: number) => { n++; if (hash(n) > density) return; const k = s * (0.8 + hash(n * 3) * 0.5); t.push(M(x, 0.8 * k, z, k, k, k)); c.push(M(x, 2.1 * k, z, k * (0.9 + hash(n * 5) * 0.3), k, k * (0.9 + hash(n * 7) * 0.3), hash(n) * 6)); col.push(new THREE.Color().setHSL(0.24 + hash(n * 11) * 0.1, 0.45, 0.22 + hash(n * 13) * 0.12)); };
    for (let kx = b.kx0; kx <= b.kx1; kx++) for (let kz = b.kz0; kz <= b.kz1; kz++) { const cx = kx * PITCH + PITCH / 2, cz = kz * PITCH + PITCH / 2, e = PITCH / 2 - ROAD / 2 - 0.3;
      if (kx === -1 && kz === -1) continue; // bank square
      if (isPark(kx, kz)) { for (let i = 0; i < 14; i++) { const a = hash(kx * 31 + kz * 17 + i) * 6.28, r = 2.5 + hash(i * 9 + kx) * 3.6; add(cx + Math.cos(a) * r, cz + Math.sin(a) * r, 1.15); } continue; }
      for (const s of [-1, 1]) for (const u of [-3.4, 3.4]) { add(cx + u, cz + s * e, 0.8); add(cx + s * e, cz + u, 0.8); }
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const gx = kx * 2 + i, gz = kz * 2 + j; if (taken.has(`${gx},${gz}`) || isPlaza(kx, kz)) continue; const x = lotC(gx), z = lotC(gz); add(x - 1.6, z - 1.2, 1); add(x + 1.5, z + 1.4, 1.1); add(x + 1.2, z - 1.7, 0.9); } }
    return { t, c, col }; }, [b.kx0, b.kx1, b.kz0, b.kz1, taken, density]);
  // positions from the matrices above; drawn with CC0 tree models (Quaternius), low-poly icosahedrons only while they load
  const spots = useMemo(() => d.t.map((m, n) => { const e = m.elements; return { x: e[12], z: e[14], k: e[5], v: hash(n * 13.7 + e[12]) }; }), [d.t]);
  return <Suspense fallback={null}><TreeModels spots={spots} /></Suspense>;
}
const TREE_URLS = [0, 1, 2, 3, 4].map((i) => `/city/models/tree${i}.glb`);
function TreeModels({ spots }: { spots: { x: number; z: number; k: number; v: number }[] }) {
  const gltfs = useGLTF(TREE_URLS) as any[];
  const groups = useMemo(() => { const by: { x: number; z: number; k: number; r: number }[][] = TREE_URLS.map(() => []);
    spots.forEach((s, n) => { const vi = s.v > 0.88 ? 4 : s.v > 0.83 ? 3 : Math.floor(s.v / 0.83 * 3); by[vi].push({ x: s.x, z: s.z, k: s.k, r: hash(n * 3.3) * 6.28 }); }); return by; }, [spots]);
  const models = useMemo(() => gltfs.map((g, vi) => { const sc = g.scene as THREE.Object3D; sc.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(sc), c = box.getCenter(new THREE.Vector3()), h = box.max.y - box.min.y;
    const H = vi === 4 ? 4.2 : 3.4; const fix = new THREE.Matrix4().makeScale(H / h, H / h, H / h).multiply(new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z));
    const parts: { geo: THREE.BufferGeometry; mat: THREE.Material }[] = [];
    sc.traverse((o: any) => { if (!o.isMesh) return; const geo = (o.geometry as THREE.BufferGeometry).clone(); geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(fix, o.matrixWorld)); const m = (o.material as THREE.MeshStandardMaterial).clone(); m.roughness = 0.9; m.metalness = 0; m.flatShading = false; parts.push({ geo, mat: m }); });
    return parts; }), [gltfs]);
  return <group>{models.map((parts, vi) => groups[vi].length > 0 && parts.map((p, pi) => <TreePart key={`${vi}-${pi}-${groups[vi].length}`} geo={p.geo} mat={p.mat} at={groups[vi]} />))}</group>;
}
function TreePart({ geo, mat, at }: { geo: THREE.BufferGeometry; mat: THREE.Material; at: { x: number; z: number; k: number; r: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useEffect(() => { const m = ref.current; if (!m) return; const o = new THREE.Object3D(); at.forEach((t, i) => { o.position.set(t.x, 0.2, t.z); o.rotation.set(0, t.r, 0); o.scale.setScalar(t.k); o.updateMatrix(); m.setMatrixAt(i, o.matrix); }); m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); }, [at]);
  return <instancedMesh ref={ref} args={[geo, mat, at.length]} castShadow receiveShadow />;
}
TREE_URLS.forEach((u) => useGLTF.preload(u));

/* ---------- harbour: water with waves, quay, pier, Printful dock is drawn by the scene ---------- */
export function Water({ b }: { b: Bounds }) {
  const geo = useMemo(() => new THREE.PlaneGeometry(600, 260, 90, 40), []); const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo]);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => { const t = clock.elapsedTime, a = geo.attributes.position as THREE.BufferAttribute; for (let i = 0; i < a.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; a.setZ(i, Math.sin(x * 0.18 + t * 1.1) * 0.12 + Math.cos(y * 0.23 + t * 0.8) * 0.1); } a.needsUpdate = true; geo.computeVertexNormals();
    if (mat.current) { const n = ENV.night; mat.current.color.setRGB(0.05 + (1 - n) * 0.12, 0.12 + (1 - n) * 0.22, 0.2 + (1 - n) * 0.26); } });
  const x0 = b.kx0 * PITCH - 3, x1 = (b.kx1 + 1) * PITCH + 3;
  return <group>
    <mesh geometry={geo} rotation-x={-Math.PI / 2} position={[(x0 + x1) / 2, -0.35, SHORE + 130]} receiveShadow><meshStandardMaterial ref={mat} metalness={0.55} roughness={0.08} envMapIntensity={1.4} /></mesh>
    <mesh position={[(x0 + x1) / 2, -0.25, SHORE + 0.3]} receiveShadow><boxGeometry args={[x1 - x0 + 200, 0.9, 0.8]} /><meshStandardMaterial color="#7c7a74" roughness={0.9} /></mesh>
    <mesh position={[(x0 + x1) / 2, 0.45, SHORE + 0.2]}><boxGeometry args={[x1 - x0, 0.5, 0.08]} /><meshStandardMaterial color="#2c3036" metalness={0.8} roughness={0.3} /></mesh>
  </group>;
}

/* ---------- traffic: instanced cars with headlights + taillights driving the street grid ---------- */
type Car = { ax: 0 | 1; line: number; dir: number; p: number; v: number; lo: number; hi: number };
export function Traffic({ b, count }: { b: Bounds; count: number }) {
  const body = useRef<THREE.InstancedMesh>(null), cab = useRef<THREE.InstancedMesh>(null), hl = useRef<THREE.InstancedMesh>(null), tl = useRef<THREE.InstancedMesh>(null);
  const hlm = useRef<THREE.MeshBasicMaterial>(null), tlm = useRef<THREE.MeshBasicMaterial>(null);
  const cars = useMemo<Car[]>(() => { const xs: number[] = [], zs: number[] = []; for (let k = b.kx0; k <= b.kx1 + 1; k++) xs.push(k * PITCH); for (let k = b.kz0; k <= 2; k++) zs.push(k * PITCH);
    const zlo = b.kz0 * PITCH - 2, zhi = SHORE - 3, xlo = b.kx0 * PITCH - 2, xhi = (b.kx1 + 1) * PITCH + 2;
    return Array.from({ length: count }, (_, i) => { const ax = (i % 2) as 0 | 1; const line = ax ? zs[i % zs.length] : xs[i % xs.length]; const dir = hash(i * 3.3) > 0.5 ? 1 : -1; const lo = ax ? xlo : zlo, hi = ax ? xhi : zhi; return { ax, line, dir, p: lo + hash(i * 7.1) * (hi - lo), v: 3.5 + hash(i * 1.7) * 3.5, lo, hi }; }); }, [b.kx0, b.kx1, b.kz0, count]);
  const o = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => { const r = body.current; if (!r) return; cars.forEach((_, i) => r.setColorAt(i, new THREE.Color(['#c0392b', '#ecf0f1', '#2c3e50', '#16a085', '#f1c40f', '#7f8c8d', '#2980b9', '#111111', '#d35400'][i % 9]))); if (r.instanceColor) r.instanceColor.needsUpdate = true; }, [cars]);
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.1); const R = [body.current, cab.current, hl.current, tl.current]; if (R.some((r) => !r)) return;
    cars.forEach((c, i) => { c.p += c.v * c.dir * dt; if (c.p > c.hi) c.p = c.lo; if (c.p < c.lo) c.p = c.hi;
      // slow down crossing the roundabout
      const lane = c.line + c.dir * (c.ax ? 1.25 : -1.25); const x = c.ax ? c.p : lane, z = c.ax ? lane : c.p; const ry = c.ax ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
      const put = (r: THREE.InstancedMesh, y: number, fwd: number) => { o.position.set(x + Math.sin(ry) * fwd, y, z + Math.cos(ry) * fwd); o.rotation.set(0, ry, 0); o.updateMatrix(); r.setMatrixAt(i, o.matrix); };
      put(R[0]!, 0.42, 0); put(R[1]!, 0.88, -0.15); put(R[2]!, 0.45, 1.06); put(R[3]!, 0.5, -1.06); });
    R.forEach((r) => { r!.count = cars.length; r!.instanceMatrix.needsUpdate = true; });
    const n = ENV.night; if (hlm.current) hlm.current.color.setRGB(0.8 + n * 4, 0.8 + n * 3.8, 0.7 + n * 3); if (tlm.current) tlm.current.color.setRGB(0.6 + n * 3.5, 0.02, 0.04);
  });
  return <group>
    <instancedMesh ref={body} args={[undefined, undefined, count]} castShadow frustumCulled={false}><boxGeometry args={[0.95, 0.5, 2.1]} /><meshStandardMaterial metalness={0.6} roughness={0.25} /></instancedMesh>
    <instancedMesh ref={cab} args={[undefined, undefined, count]} frustumCulled={false}><boxGeometry args={[0.82, 0.42, 1.1]} /><meshStandardMaterial color="#1b2530" metalness={0.9} roughness={0.1} /></instancedMesh>
    <instancedMesh ref={hl} args={[undefined, undefined, count]} frustumCulled={false}><boxGeometry args={[0.8, 0.1, 0.04]} /><meshBasicMaterial ref={hlm} toneMapped={false} /></instancedMesh>
    <instancedMesh ref={tl} args={[undefined, undefined, count]} frustumCulled={false}><boxGeometry args={[0.8, 0.1, 0.04]} /><meshBasicMaterial ref={tlm} toneMapped={false} /></instancedMesh>
  </group>;
}

/* ---------- pedestrians with walk cycles; shoppers walk into a store when it makes a sale ---------- */
type Ped = { ax: 0 | 1; line: number; off: number; p: number; v: number; ph: number; lo: number; hi: number; shop?: { path: P[]; t0: number; dur: number } };
const SHOP_SLOTS = 24;
export function People({ b, count, shops }: { b: Bounds; count: number; shops: CityShop[] }) {
  const torso = useRef<THREE.InstancedMesh>(null), head = useRef<THREE.InstancedMesh>(null), legL = useRef<THREE.InstancedMesh>(null), legR = useRef<THREE.InstancedMesh>(null);
  const total = count + SHOP_SLOTS;
  const peds = useMemo<Ped[]>(() => { const xs: number[] = [], zs: number[] = []; for (let k = b.kx0; k <= b.kx1 + 1; k++) xs.push(k * PITCH); for (let k = b.kz0; k <= 2; k++) zs.push(k * PITCH);
    return Array.from({ length: total }, (_, i) => { const ax = (i % 2) as 0 | 1; const line = ax ? zs[(i * 7) % zs.length] : xs[(i * 5) % xs.length]; const lo = ax ? b.kx0 * PITCH : b.kz0 * PITCH, hi = ax ? (b.kx1 + 1) * PITCH : SHORE - 3.4;
      return { ax, line, off: (hash(i * 2.2) > 0.5 ? 1 : -1) * (3.25 + hash(i) * 0.5), p: lo + hash(i * 9.7) * (hi - lo), v: (0.9 + hash(i * 4.4) * 0.7) * (hash(i * 6.1) > 0.5 ? 1 : -1), ph: hash(i) * 6, lo, hi }; }); }, [b.kx0, b.kx1, b.kz0, total]);
  const byId = useRef(new Map<string, CityShop>()); useEffect(() => { byId.current = new Map(shops.map((s) => [s.id, s])); }, [shops]);
  const next = useRef(0);
  useEffect(() => on('shopper', ({ shopId, n = 3 }: { shopId: string; n?: number }) => { const s = byId.current.get(shopId); if (!s) return;
    for (let k = 0; k < n; k++) { const slot = peds[count + (next.current++ % SHOP_SLOTS)]; const door: P = [s.x + (k - 1) * 0.35, 0, s.z + s.face * 2.7], walk: P = [s.x + (k - 1) * 0.35, 0, s.z + s.face * 4.6];
      const from: P = [s.x + (hash(k + s.x) > 0.5 ? 1 : -1) * (6 + k * 1.4), 0, walk[2]]; slot.shop = { path: [from, walk, door, [door[0], 0, s.z + s.face * 2.2]], t0: performance.now() + k * 350, dur: 5200 }; } }), [peds, count]);
  useEffect(() => { const cols = ['#e74c3c', '#3498db', '#f1c40f', '#ecf0f1', '#9b59b6', '#1abc9c', '#e67e22', '#34495e', '#B98A7A']; const t = torso.current, h = head.current;
    peds.forEach((_, i) => { t?.setColorAt(i, new THREE.Color(cols[i % cols.length])); h?.setColorAt(i, new THREE.Color().setHSL(0.07, 0.45, 0.2 + hash(i * 3) * 0.45)); }); if (t?.instanceColor) t.instanceColor.needsUpdate = true; if (h?.instanceColor) h.instanceColor.needsUpdate = true; }, [peds]);
  const o = useMemo(() => new THREE.Object3D(), []); const tmp = useMemo<P>(() => [0, 0, 0], []); const tmp2 = useMemo<P>(() => [0, 0, 0], []);
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.1); const R = [torso.current, head.current, legL.current, legR.current]; if (R.some((r) => !r)) return; const now = performance.now();
    peds.forEach((p, i) => {
      let x: number, z: number, ry: number, sc = 1, moving = true;
      if (i >= count) { const s = p.shop; const t = s ? (now - s.t0) / s.dur : 2; if (!s || t < 0 || t > 1) { sc = 0; x = 0; z = 0; ry = 0; moving = false; } else { samplePath(s.path, t, tmp); samplePath(s.path, Math.min(1, t + 0.01), tmp2); x = tmp[0]; z = tmp[2]; ry = Math.atan2(tmp2[0] - tmp[0], tmp2[2] - tmp[2]); if (t > 0.86) sc = Math.max(0, (1 - t) / 0.14); } }
      else { p.p += p.v * dt; if (p.p > p.hi) p.p = p.lo; if (p.p < p.lo) p.p = p.hi; x = p.ax ? p.p : p.line + p.off; z = p.ax ? p.line + p.off : p.p; ry = p.ax ? (p.v > 0 ? Math.PI / 2 : -Math.PI / 2) : (p.v > 0 ? 0 : Math.PI); }
      p.ph += dt * (moving ? 7.5 : 0) * Math.abs(p.v || 1.2); const sw = Math.sin(p.ph) * 0.55, bob = Math.abs(Math.cos(p.ph)) * 0.04;
      const put = (r: THREE.InstancedMesh, dx: number, y: number, rx: number) => { o.position.set(x + Math.cos(ry) * dx, y * sc + 0.2, z - Math.sin(ry) * dx); o.rotation.set(rx, ry, 0); o.scale.setScalar(sc); o.updateMatrix(); r.setMatrixAt(i, o.matrix); };
      put(R[0]!, 0, 0.78 + bob, 0); put(R[1]!, 0, 1.18 + bob, 0); put(R[2]!, -0.07, 0.48 + bob, sw); put(R[3]!, 0.07, 0.48 + bob, -sw);
    });
    R.forEach((r) => { r!.count = total; r!.instanceMatrix.needsUpdate = true; });
  });
  const legGeo = useMemo(() => new THREE.BoxGeometry(0.08, 0.46, 0.09).translate(0, -0.23, 0), []);
  return <group>
    <instancedMesh ref={torso} args={[undefined, undefined, total]} castShadow frustumCulled={false}><capsuleGeometry args={[0.13, 0.32, 3, 8]} /><meshStandardMaterial roughness={0.8} /></instancedMesh>
    <instancedMesh ref={head} args={[undefined, undefined, total]} frustumCulled={false}><sphereGeometry args={[0.1, 10, 8]} /><meshStandardMaterial roughness={0.7} /></instancedMesh>
    <instancedMesh ref={legL} args={[undefined, undefined, total]} geometry={legGeo} frustumCulled={false}><meshStandardMaterial color="#2b2f3a" /></instancedMesh>
    <instancedMesh ref={legR} args={[undefined, undefined, total]} geometry={legGeo} frustumCulled={false}><meshStandardMaterial color="#2b2f3a" /></instancedMesh>
  </group>;
}
