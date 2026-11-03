'use client';
// Shop buildings. The nearest N are fully detailed (style geometry, signage, storefront, AI staff);
// the rest are instanced LOD boxes sharing the same facade textures, so the city scales to hundreds.
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Billboard, Html, Sparkles } from '@react-three/drei';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { DISTRICT_INFO, ENV, SETBACK, type CityShop, type Style } from './layout';
import { TILE, doorTex, facadeBox, facadeLit, facadeMap, roofTex, signTex, stripeTex } from './tex';

const GOLD = '#D9B56E';
export const DIMS: Record<Style, [number, number]> = { glass: [4.8, 4.8], brick: [5.6, 5.2], boutique: [5.6, 4.8], warehouse: [6.2, 5.8] };
const TK: Record<Style, keyof typeof TILE> = { glass: 'glass', brick: 'brick', boutique: 'stucco', warehouse: 'metal' };
const hashS = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0) / 4294967296; };
/* Facade materials: one per style + tint, shared by detail and LOD. Emissive (lit windows) follows ENV.night. */
const NIGHT = new Set<{ m: THREE.MeshStandardMaterial; d: number; n: number }>();
export function NightDriver() { useFrame(() => { const k = ENV.night; NIGHT.forEach((e) => { e.m.emissiveIntensity = e.d + (e.n - e.d) * k; }); }); return null; }
const matCache = new Map<string, THREE.MeshStandardMaterial>();
export function facadeMat(style: Style, tint: string) {
  const key = style + tint; const hit = matCache.get(key); if (hit) return hit;
  const k = TK[style]; const glass = style === 'glass';
  const m = new THREE.MeshStandardMaterial({ map: facadeMap(k), emissiveMap: facadeLit(k), emissive: new THREE.Color('#ffffff'), color: new THREE.Color(tint), metalness: glass ? 0.85 : style === 'warehouse' ? 0.55 : 0.02, roughness: glass ? 0.12 : style === 'warehouse' ? 0.45 : 0.85, envMapIntensity: glass ? 1.6 : 0.6 });
  NIGHT.add({ m, d: 0.0, n: glass ? 1.25 : 1.1 }); matCache.set(key, m); return m;
}
let roofM: THREE.MeshStandardMaterial | null = null;
export const roofMat = () => (roofM ||= new THREE.MeshStandardMaterial({ map: roofTex(), color: '#8a8d92', roughness: 0.95 }));
/** Deterministic tint per shop: brick reds/browns, pastel boutiques, steel warehouses, blue/green glass. */
export function tintOf(s: CityShop) {
  const r = hashS(s.id), st = s.plot.style;
  if (st === 'glass') return ['#9fc4e8', '#a8e0d8', '#c9d4e6', '#b8c9ff'][Math.floor(r * 4)];
  if (st === 'brick') return ['#ffffff', '#e6c3a8', '#ffd7c2', '#c9a58f', '#f0e0d0'][Math.floor(r * 5)];
  if (st === 'warehouse') return ['#d7dde3', '#b9c7d6', '#c9d6c3', '#e0d2bf'][Math.floor(r * 4)];
  return '#' + new THREE.Color(s.colors?.[0] || s.plot.color || '#B98A7A').lerp(new THREE.Color('#ffffff'), 0.62).getHexString();
}
const accentOf = (s: CityShop) => s.colors?.[1] && s.colors[1].toLowerCase() !== '#ffffff' ? s.colors[1] : s.colors?.[0] || s.plot.color || GOLD;

function Sign({ s, w, y, z }: { s: CityShop; w: number; y: number; z: number }) {
  const t = useMemo(() => signTex(s.id, s.name, s.owner, accentOf(s), s.logo), [s.id, s.name, s.owner, s.logo, s.colors]);
  return <mesh position={[0, y, z]}><planeGeometry args={[w, w * 0.3125]} /><meshBasicMaterial map={t} toneMapped={false} transparent /></mesh>;
}
function Billboard3({ s, y, w = 5.2 }: { s: CityShop; y: number; w?: number }) {
  return <group position={[0, y, 0]}>
    {[-w * 0.38, w * 0.38].map((x) => <mesh key={x} position={[x, -0.95, -0.1]}><boxGeometry args={[0.12, 1.5, 0.12]} /><meshStandardMaterial color="#25282e" metalness={0.8} roughness={0.4} /></mesh>)}
    <mesh position={[0, 0, -0.08]}><boxGeometry args={[w + 0.2, w * 0.3125 + 0.2, 0.1]} /><meshStandardMaterial color="#14161b" metalness={0.6} roughness={0.5} /></mesh>
    <Sign s={s} w={w} y={0} z={0} />
  </group>;
}
function Storefront({ s, w, h, y, z, glow }: { s: CityShop; w: number; h: number; y: number; z: number; glow: React.MutableRefObject<THREE.MeshStandardMaterial | null> }) {
  return <group position={[0, y, z]}>
    <mesh><planeGeometry args={[w, h]} /><meshStandardMaterial ref={glow} color="#1a2230" emissive={accentOf(s)} emissiveIntensity={0.5} metalness={0.6} roughness={0.1} /></mesh>
    <mesh position={[0, -h / 2 + 0.6, 0.01]}><planeGeometry args={[0.9, 1.2]} /><meshStandardMaterial color="#0c0f14" emissive="#ffe2b0" emissiveIntensity={0.25} /></mesh>
    {[-w / 2, w / 2].map((x) => <mesh key={x} position={[x, 0, 0.04]}><boxGeometry args={[0.12, h + 0.1, 0.1]} /><meshStandardMaterial color="#20242b" /></mesh>)}
  </group>;
}
function Body({ s, h, glow }: { s: CityShop; h: number; glow: React.MutableRefObject<THREE.MeshStandardMaterial | null> }) {
  const st = s.plot.style; const [w, d] = DIMS[st]; const tile = TILE[TK[st]]; const side = facadeMat(st, tintOf(s)); const roof = roofMat();
  const mats = [side, side, roof, roof, side, side];
  const accent = accentOf(s);
  if (st === 'glass') { const th = h - 1.6; return <>
    <mesh position={[0, 0.8, 0]} castShadow receiveShadow><boxGeometry args={[w + 0.7, 1.6, d + 0.7]} /><meshStandardMaterial color="#2a2f38" metalness={0.5} roughness={0.4} /></mesh>
    <Storefront s={s} w={w} h={1.3} y={0.75} z={d / 2 + 0.36} glow={glow} />
    <mesh position={[0, 1.6 + th / 2, 0]} geometry={facadeBox(w, th, d, tile[0], tile[1])} material={mats} castShadow receiveShadow />
    {[-1, 1].map((sx) => <mesh key={sx} position={[sx * (w / 2 + 0.03), 1.6 + th / 2, d / 2 + 0.03]}><boxGeometry args={[0.14, th, 0.14]} /><meshStandardMaterial color="#cfd6de" metalness={0.9} roughness={0.2} /></mesh>)}
    <mesh position={[0, h + 0.9, 0]} geometry={facadeBox(w * 0.72, 1.8, d * 0.72, tile[0], tile[1])} material={mats} castShadow />
    <mesh position={[0, h + 3.4, -0.6]}><cylinderGeometry args={[0.05, 0.08, 3.2, 6]} /><meshStandardMaterial color="#c0c6cc" metalness={0.9} /></mesh>
    <Blinker y={h + 5.1} z={-0.6} />
    <Sign s={s} w={4.2} y={2.55} z={d / 2 + 0.02} />
    <Billboard3 s={s} y={h + 1.8 + 1.15} w={4.6} />
  </>; }
  if (st === 'brick') return <>
    <mesh position={[0, h / 2, 0]} geometry={facadeBox(w, h, d, tile[0], tile[1])} material={mats} castShadow receiveShadow />
    <Storefront s={s} w={w - 0.8} h={1.9} y={1.05} z={d / 2 + 0.02} glow={glow} />
    <mesh position={[0, 2.3, 0]}><boxGeometry args={[w + 0.15, 0.2, d + 0.15]} /><meshStandardMaterial color="#d8cfc0" roughness={0.8} /></mesh>
    <mesh position={[0, h + 0.17, 0]} castShadow><boxGeometry args={[w + 0.35, 0.35, d + 0.35]} /><meshStandardMaterial color="#d8cfc0" roughness={0.8} /></mesh>
    <group position={[-w / 2 + 1, h + 0.35, -d / 2 + 1]}><mesh position={[0, 1.3, 0]} castShadow><cylinderGeometry args={[0.55, 0.55, 1.2, 12]} /><meshStandardMaterial color="#6b4a32" roughness={0.9} /></mesh><mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.04, 0.04, 0.8]} /><meshStandardMaterial color="#222" /></mesh><mesh position={[0, 2.05, 0]}><coneGeometry args={[0.6, 0.35, 12]} /><meshStandardMaterial color="#4b3423" /></mesh></group>
    <Sign s={s} w={4.6} y={3.0} z={d / 2 + 0.02} />
    <Billboard3 s={s} y={h + 0.35 + 1.55} />
  </>;
  if (st === 'boutique') { const aw = stripeTex(accent, '#ffffff'); return <>
    <mesh position={[0, h / 2, 0]} geometry={facadeBox(w, h, d, tile[0], tile[1])} material={mats} castShadow receiveShadow />
    <Storefront s={s} w={w - 1} h={1.9} y={1.05} z={d / 2 + 0.02} glow={glow} />
    <mesh position={[0, 2.25, d / 2 + 0.55]} rotation-x={0.38} castShadow><boxGeometry args={[w - 0.6, 0.06, 1.25]} /><meshStandardMaterial map={aw} roughness={0.8} /></mesh>
    {[-1, 1].map((sx) => <group key={sx} position={[sx * (w / 2 - 0.4), 0, d / 2 + 0.45]}><mesh position={[0, 0.25, 0]}><boxGeometry args={[0.6, 0.5, 0.5]} /><meshStandardMaterial color="#3b3f46" /></mesh><mesh position={[0, 0.65, 0]}><icosahedronGeometry args={[0.35, 1]} /><meshStandardMaterial color="#4f8a3c" flatShading /></mesh></group>)}
    <mesh position={[0, h + 0.12, 0]}><boxGeometry args={[w + 0.2, 0.25, d + 0.2]} /><meshStandardMaterial color="#ffffff" roughness={0.7} /></mesh>
    <Sign s={s} w={4.4} y={Math.min(h - 0.75, 3.35)} z={d / 2 + 0.02} />
    <Billboard3 s={s} y={h + 1.5} w={4.6} />
  </>; }
  return <>
    <mesh position={[0, h / 2, 0]} geometry={facadeBox(w, h, d, tile[0], tile[1])} material={mats} castShadow receiveShadow />
    {[-2.05, 0, 2.05].map((x) => <mesh key={x} position={[x, h + 0.5, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[1.05, 1.05, d, 3]} /><meshStandardMaterial color="#8d9399" metalness={0.6} roughness={0.4} /></mesh>)}
    <mesh position={[-1, 1.45, d / 2 + 0.02]}><planeGeometry args={[3, 2.9]} /><meshStandardMaterial map={doorTex()} metalness={0.4} roughness={0.5} /></mesh>
    <mesh position={[-1, 0.3, d / 2 + 0.8]} castShadow><boxGeometry args={[3.6, 0.6, 1.5]} /><meshStandardMaterial color="#6f6a63" /></mesh>
    <Storefront s={s} w={1.9} h={2} y={1.1} z={d / 2 + 0.02} glow={glow} />
    <group position={[1.9, 0, 0]}><Sign s={s} w={3} y={h - 0.9} z={d / 2 + 0.02} /></group>
    <Billboard3 s={s} y={h + 1.5 + 1.25} w={5.4} />
  </>;
}
function Blinker({ y, z }: { y: number; z: number }) { const m = useRef<THREE.MeshBasicMaterial>(null); useFrame(({ clock }) => { if (m.current) m.current.color.setRGB(Math.sin(clock.elapsedTime * 3) > 0.6 ? 6 : 0.4, 0, 0); }); return <mesh position={[0, y, z]}><sphereGeometry args={[0.14, 8, 8]} /><meshBasicMaterial ref={m} toneMapped={false} /></mesh>; }

export type BProps = { s: CityShop; onPick: (s: CityShop) => void; focus: boolean; pulse: number; quiet?: boolean; hl: string | null };
export const Building = memo(function Building({ s, onPick, focus, pulse, quiet, hl }: BProps) {
  const g = useRef<THREE.Group>(null); const glow = useRef<THREE.MeshStandardMaterial | null>(null); const [hover, setHover] = useState(false);
  const born = useRef(s.fresh ? performance.now() : 0); const [rising, setRising] = useState(!!s.fresh); const light = useRef<THREE.PointLight>(null);
  useFrame(() => { const now = performance.now(); if (g.current && born.current) { const t = Math.min(1, (now - born.current) / 4200); g.current.scale.y = 0.02 + (1 - Math.pow(1 - t, 3)) * 0.98; if (t >= 1) { born.current = 0; setRising(false); } }
    const p = Math.max(0, 1 - (now - pulse) / 1600); if (glow.current) glow.current.emissiveIntensity = 0.35 + ENV.night * 0.7 + p * 4 + (focus || hover ? 0.6 : 0); if (light.current) light.current.intensity = p * 60; });
  const [, d] = DIMS[s.plot.style]; const dist = DISTRICT_INFO[s.plot.district]; const lit = hl === s.plot.district;
  return <group position={[s.x, 0.2, s.z - s.face * SETBACK]} rotation-y={s.face > 0 ? 0 : Math.PI}
    onClick={(e) => { e.stopPropagation(); onPick(s); }} onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}>
    <group ref={g}><Body s={s} h={s.h} glow={glow} /></group>
    <pointLight ref={light} position={[0, 2, d / 2 + 2]} color={GOLD} intensity={0} distance={10} />
    {rising && <><Sparkles count={70} scale={[7, s.h + 2, 7]} position={[0, s.h / 2, 0]} size={5} speed={2} color={GOLD} />
      <mesh position={[0, s.h / 2, 0]}><boxGeometry args={[DIMS[s.plot.style][0] + 0.8, s.h + 1, d + 0.8, 4, 8, 4]} /><meshBasicMaterial color={new THREE.Color(GOLD).multiplyScalar(1.6)} wireframe toneMapped={false} /></mesh></>}
    {lit && <><mesh position={[0, 0.06, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[4.1, 4.5, 4, 1, Math.PI / 4]} /><meshBasicMaterial color={new THREE.Color(dist?.color || GOLD).multiplyScalar(3)} toneMapped={false} /></mesh>
      <mesh position={[0, s.h + 14, 0]}><cylinderGeometry args={[0.3, 1.4, 28, 12, 1, true]} /><meshBasicMaterial color={dist?.color || GOLD} transparent opacity={0.13} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} /></mesh></>}
    {!quiet && (focus || hover || s.mine) && <Billboard position={[0, s.h + (s.plot.style === 'glass' ? 6.5 : 4.6), 0]}><Html center zIndexRange={[10, 0]} className="city-label">
      <button className={`city-tag ${focus ? 'city-tag-on' : ''}`} style={{ borderColor: (s.colors?.[0] || GOLD) + '99' }} onClick={() => onPick(s)} data-testid={`tag-${s.id}`}>
        {s.mine && <span className="text-[9px] tracking-widest" style={{ color: GOLD }}>YOUR STORE</span>}
        <b>{s.name}</b><span>by {s.owner} · {dist?.label}</span>
        <span>{s.products} products{s.minPrice ? ` · from $${s.minPrice.toFixed(2)}` : ''} · <span style={{ color: GOLD }}>${s.revenue.toFixed(2)}</span> sales</span>
        {hover && <span style={{ color: '#8FAE84' }}>Click to walk in &amp; shop →</span>}
      </button></Html></Billboard>}
  </group>;
});

/* ---------- far LOD: one instanced box per style ---------- */
function FarStyle({ style, shops }: { style: Style; shops: CityShop[] }) {
  const ref = useRef<THREE.InstancedMesh>(null); const roofRef = useRef<THREE.InstancedMesh>(null);
  const mat = useMemo(() => { const m = facadeMat(style, '#ffffff').clone(); m.map = m.map!.clone(); m.emissiveMap = m.emissiveMap!.clone(); m.map.repeat.set(1, 2); m.emissiveMap.repeat.set(1, 2); m.map.needsUpdate = m.emissiveMap.needsUpdate = true; NIGHT.add({ m, d: 0, n: 1.1 }); return m; }, [style]);
  useEffect(() => { const r = ref.current, rr = roofRef.current; if (!r || !rr) return; const o = new THREE.Object3D(); const [w, d] = DIMS[style];
    shops.forEach((s, i) => { o.position.set(s.x, 0.2 + s.h / 2, s.z - s.face * SETBACK); o.rotation.set(0, 0, 0); o.scale.set(w, s.h, d); o.updateMatrix(); r.setMatrixAt(i, o.matrix); r.setColorAt(i, new THREE.Color(tintOf(s)));
      o.position.set(s.x, 0.2 + s.h + 1.2, s.z - s.face * SETBACK + s.face * 0.3); o.scale.set(w * 0.85, 1.4, 0.12); o.updateMatrix(); rr.setMatrixAt(i, o.matrix); rr.setColorAt(i, new THREE.Color(accentOf(s)).multiplyScalar(1.8)); });
    r.count = rr.count = shops.length; r.instanceMatrix.needsUpdate = rr.instanceMatrix.needsUpdate = true; if (r.instanceColor) r.instanceColor.needsUpdate = true; if (rr.instanceColor) rr.instanceColor.needsUpdate = true; r.computeBoundingSphere(); rr.computeBoundingSphere(); }, [shops, style]);
  const cap = Math.max(4, shops.length);
  return <><instancedMesh key={cap} ref={ref} args={[undefined, undefined, cap]} material={mat} castShadow receiveShadow><boxGeometry /></instancedMesh>
    <instancedMesh key={'r' + cap} ref={roofRef} args={[undefined, undefined, cap]}><boxGeometry /><meshBasicMaterial toneMapped={false} /></instancedMesh></>;
}

export function Buildings({ shops, detail, focus, pulses, onPick, quiet, hl }: { shops: CityShop[]; detail: number; focus?: string | null; pulses: Record<string, number>; onPick: (s: CityShop) => void; quiet?: boolean; hl: string | null }) {
  const { camera, controls } = useThree() as any; const [near, setNear] = useState<string>(''); const acc = useRef(9);
  useFrame((_, dt) => { acc.current += dt; if (acc.current < 0.45) return; acc.current = 0; const t: THREE.Vector3 = controls?.target || new THREE.Vector3(); const c = camera.position;
    const keep = shops.filter((s) => s.fresh || s.id === focus || s.mine).map((s) => s.id);
    const ranked = shops.map((s) => ({ id: s.id, d: Math.hypot(s.x - t.x, s.z - t.z) * 0.7 + Math.hypot(s.x - c.x, s.z - c.z) * 0.3 })).sort((a, b) => a.d - b.d).slice(0, detail).map((r) => r.id);
    const k = [...new Set([...keep, ...ranked])].sort().join(','); if (k !== near) setNear(k); });
  const set = useMemo(() => new Set(near.split(',')), [near]);
  const far = useMemo(() => { const by: Record<Style, CityShop[]> = { glass: [], brick: [], boutique: [], warehouse: [] }; shops.forEach((s) => { if (!set.has(s.id)) by[s.plot.style]?.push(s); }); return by; }, [shops, set]);
  return <>
    {shops.filter((s) => set.has(s.id)).map((s) => <Building key={s.id} s={s} onPick={onPick} focus={focus === s.id} pulse={pulses[s.id] || 0} quiet={quiet} hl={hl} />)}
    {(Object.keys(far) as Style[]).map((st) => <FarStyle key={st} style={st} shops={far[st]} />)}
    <NightDriver />
  </>;
}
