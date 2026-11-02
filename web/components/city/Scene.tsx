'use client';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, Html, OrbitControls, Sparkles, Stars } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { BANK, DOCK, GUARDS, LOTS, STREETS, buildingHeight, bus, samplePath, type CityShop, type P, type Packet } from './layout';

const IRIS = '#8B7BFF', CYAN = '#5CE1FF', GOLD = '#FFC94D', LIME = '#5EF0A6', PINK = '#FF7AD9', RED = '#FF4D6D', ORANGE = '#FF9F43';
const glow = (c: string, k = 2.4) => new THREE.Color(c).multiplyScalar(k);
const on = (t: string, f: (d: any) => void) => { const h = (e: any) => f(e.detail); bus.addEventListener(t, h); return () => bus.removeEventListener(t, h); };

/* ---------- procedural window texture (shared image, per-building repeat) ---------- */
let winImg: HTMLCanvasElement | null = null;
function windowsCanvas() {
  if (winImg) return winImg; const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d')!;
  g.fillStyle = '#06060c'; g.fillRect(0, 0, 64, 256);
  for (let y = 4; y < 256; y += 10) for (let x = 4; x < 64; x += 10) {
    const r = Math.random(); if (r < 0.42) continue;
    g.fillStyle = r > 0.93 ? '#ffd38a' : r > 0.8 ? '#9fe9ff' : r > 0.62 ? '#7d70ff' : '#2a2a48'; g.fillRect(x, y, 6, 6);
  }
  return (winImg = c);
}
function useWindowTex(h: number) {
  return useMemo(() => { const t = new THREE.CanvasTexture(windowsCanvas()); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, h / 10); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }, [h]);
}
const texCache = new Map<string, THREE.Texture>();
function useLogo(url?: string) {
  const [t, setT] = useState<THREE.Texture | null>(url ? texCache.get(url) || null : null);
  useEffect(() => {
    if (!url || texCache.has(url)) return; const src = url.replace(/^https?:\/\/[^/]+\/assets\//, '/api/assets/');
    new THREE.TextureLoader().load(src, (tx) => { tx.colorSpace = THREE.SRGBColorSpace; texCache.set(url, tx); setT(tx); }, undefined, () => {});
  }, [url]);
  return t;
}

/* ---------- ground, streets, harbour ---------- */
const Ground = memo(function Ground() {
  const dash = useMemo(() => { const c = document.createElement('canvas'); c.width = 8; c.height = 64; const g = c.getContext('2d')!; g.fillStyle = '#000'; g.fillRect(0, 0, 8, 64); g.fillStyle = '#fff'; g.fillRect(3, 0, 2, 30); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 30); return t; }, []);
  return <group>
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, -4]} receiveShadow><planeGeometry args={[140, 120]} /><meshStandardMaterial color="#090913" roughness={0.95} /></mesh>
    {STREETS.map((s) => <group key={s}>
      <mesh rotation-x={-Math.PI / 2} position={[s, 0.005, -2]}><planeGeometry args={[1.6, 62]} /><meshStandardMaterial color="#10101d" roughness={0.6} metalness={0.3} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, s]}><planeGeometry args={[62, 1.6]} /><meshStandardMaterial color="#10101d" roughness={0.6} metalness={0.3} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[s, 0.012, -2]}><planeGeometry args={[0.07, 62]} /><meshBasicMaterial color={glow(IRIS, 0.5)} alphaMap={dash} transparent toneMapped={false} /></mesh>
      <mesh rotation-x={-Math.PI / 2} rotation-z={Math.PI / 2} position={[0, 0.012, s]}><planeGeometry args={[0.07, 62]} /><meshBasicMaterial color={glow(CYAN, 0.35)} alphaMap={dash} transparent toneMapped={false} /></mesh>
    </group>)}
    {/* plaza around the beacon */}
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}><ringGeometry args={[4.2, 4.45, 64]} /><meshBasicMaterial color={glow(IRIS, 1.6)} toneMapped={false} /></mesh>
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.015, 0]}><circleGeometry args={[4.2, 64]} /><meshStandardMaterial color="#121224" metalness={0.6} roughness={0.3} /></mesh>
  </group>;
});
function Harbour() {
  const water = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => { if (water.current) water.current.emissiveIntensity = 0.35 + Math.sin(clock.elapsedTime * 0.8) * 0.08; });
  return <group>
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.05, 50]}><planeGeometry args={[160, 34]} /><meshStandardMaterial ref={water} color="#05122a" emissive="#0a2a55" emissiveIntensity={0.35} metalness={0.9} roughness={0.15} /></mesh>
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.03, 32.6]}><planeGeometry args={[70, 0.08]} /><meshBasicMaterial color={glow(CYAN, 1.2)} toneMapped={false} /></mesh>
    {/* Printful dock */}
    <group position={[DOCK[0], 0, DOCK[1]]}>
      <mesh position={[0, 0.25, 1.6]}><boxGeometry args={[9, 0.5, 4]} /><meshStandardMaterial color="#1b1b2c" /></mesh>
      {[-3, -1.6, -0.2, 1.2].map((x, i) => <mesh key={i} position={[x, 0.95, 1.2 + (i % 2) * 0.9]}><boxGeometry args={[1.2, 0.9, 0.9]} /><meshStandardMaterial color={[ORANGE, '#c45a2a', '#e2b04a', '#3a6ea5'][i]} emissive={[ORANGE, '#c45a2a', '#e2b04a', '#3a6ea5'][i]} emissiveIntensity={0.25} /></mesh>)}
      <mesh position={[3.2, 3.2, 1.6]}><boxGeometry args={[0.3, 6, 0.3]} /><meshStandardMaterial color="#2b2b44" /></mesh>
      <mesh position={[1.6, 6.1, 1.6]}><boxGeometry args={[3.8, 0.25, 0.25]} /><meshStandardMaterial color={ORANGE} emissive={ORANGE} emissiveIntensity={0.6} /></mesh>
      <mesh position={[0.2, 6.4, 1.6]}><sphereGeometry args={[0.18]} /><meshBasicMaterial color={glow(RED, 3)} toneMapped={false} /></mesh>
      {/* cargo ship */}
      <group position={[0, 0, 7]}><mesh position={[0, 0.4, 0]}><boxGeometry args={[12, 1.1, 3]} /><meshStandardMaterial color="#14142a" /></mesh>
        <mesh position={[-3.5, 1.4, 0]}><boxGeometry args={[2.4, 1.6, 2.2]} /><meshStandardMaterial color="#20203a" emissive={CYAN} emissiveIntensity={0.12} /></mesh>
        {[-1, 0.6, 2.2, 3.8].map((x, i) => <mesh key={i} position={[x, 1.2, 0]}><boxGeometry args={[1.4, 0.7, 2.2]} /><meshStandardMaterial color={[ORANGE, '#3a6ea5', '#e2b04a', '#5a3fa0'][i]} /></mesh>)}</group>
      <Billboard position={[0, 8.2, 1.6]}><Html center distanceFactor={40} className="city-label" zIndexRange={[10, 0]}><div className="city-tag" style={{ borderColor: ORANGE + '88' }}><b style={{ color: ORANGE }}>⬡ Printful dock</b><span>physical goods ship here (drafts only)</span></div></Html></Billboard>
    </group>
  </group>;
}

/* ---------- beacon tower: the HollowCo ring + dot ---------- */
function Beacon({ onPick }: { onPick: () => void }) {
  const ring = useRef<THREE.Group>(null); const dot = useRef<THREE.Mesh>(null); const beam = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => { const t = clock.elapsedTime; if (ring.current) ring.current.rotation.y = t * 0.35; if (dot.current) dot.current.position.y = -1.2 + Math.abs(Math.sin(t * 1.6)) * 0.5; if (beam.current) beam.current.opacity = 0.09 + Math.sin(t * 2) * 0.03; });
  return <group onClick={(e) => { e.stopPropagation(); onPick(); }}>
    <mesh position={[0, 7, 0]}><cylinderGeometry args={[0.55, 1.5, 14, 6]} /><meshStandardMaterial color="#17172b" metalness={0.8} roughness={0.25} emissive={IRIS} emissiveIntensity={0.08} /></mesh>
    {[2, 5, 8, 11].map((y) => <mesh key={y} position={[0, y, 0]}><torusGeometry args={[1.5 - y * 0.07, 0.04, 6, 32]} /><meshBasicMaterial color={glow(CYAN, 1.5)} toneMapped={false} /></mesh>)}
    <group ref={ring} position={[0, 18, 0]}>
      <mesh><torusGeometry args={[3, 0.62, 24, 96]} /><meshStandardMaterial color="#ffffff" emissive="#C9C1FF" emissiveIntensity={2.2} toneMapped={false} metalness={0.2} roughness={0.2} /></mesh>
      <mesh ref={dot} position={[1.15, -1.2, 0]}><sphereGeometry args={[0.6, 32, 32]} /><meshBasicMaterial color={glow(CYAN, 4)} toneMapped={false} /></mesh>
    </group>
    <pointLight position={[0, 18, 0]} color={IRIS} intensity={260} distance={60} decay={2} />
    <mesh position={[0, 40, 0]}><cylinderGeometry args={[0.4, 2.4, 44, 24, 1, true]} /><meshBasicMaterial ref={beam} color={IRIS} transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <Sparkles count={60} scale={[10, 22, 10]} position={[0, 11, 0]} size={3} speed={0.4} color={CYAN} />
  </group>;
}

/* ---------- bank tower (ledger) ---------- */
function Bank({ onPick, hot }: { onPick: () => void; hot: number }) {
  const crown = useRef<THREE.Mesh>(null); const tex = useWindowTex(20);
  useFrame(({ clock }) => { if (crown.current) { crown.current.rotation.y = clock.elapsedTime * 0.6; const k = Math.max(0, 1 - (performance.now() - hot) / 1500); (crown.current.material as any).color = glow(GOLD, 2 + k * 5); } });
  return <group position={[BANK[0], 0, BANK[1]]} onClick={(e) => { e.stopPropagation(); onPick(); }} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
    <mesh position={[0, 0.3, 0]}><boxGeometry args={[5.6, 0.6, 5.6]} /><meshStandardMaterial color="#1d1a10" /></mesh>
    {[-2, -0.7, 0.7, 2].map((x) => <mesh key={x} position={[x, 2, 2.2]}><cylinderGeometry args={[0.22, 0.22, 3, 12]} /><meshStandardMaterial color="#d9c08a" emissive={GOLD} emissiveIntensity={0.15} /></mesh>)}
    <mesh position={[0, 11, 0]}><boxGeometry args={[4, 19, 4]} /><meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffd38a" emissiveIntensity={0.9} color="#3a3220" metalness={0.6} roughness={0.35} /></mesh>
    <mesh position={[0, 21.2, 0]}><cylinderGeometry args={[0, 2.6, 3, 4]} /><meshStandardMaterial color="#3a3220" metalness={0.8} roughness={0.2} /></mesh>
    <mesh ref={crown} position={[0, 24.2, 0]}><torusGeometry args={[1.3, 0.16, 12, 48]} /><meshBasicMaterial color={glow(GOLD, 2)} toneMapped={false} /></mesh>
    <pointLight position={[0, 23, 0]} color={GOLD} intensity={70} distance={26} />
    <Billboard position={[0, 26.6, 0]}><Html center distanceFactor={44} zIndexRange={[10, 0]}><button className="city-tag" style={{ borderColor: GOLD + '99' }} onClick={onPick} data-testid="bank-tag"><b style={{ color: GOLD }}>§ Bank tower</b><span>public ledger · click to audit</span></button></Html></Billboard>
  </group>;
}

/* ---------- guard towers + alarm beams ---------- */
function Guards({ onPick }: { onPick: () => void }) {
  const [alarm, setAlarm] = useState<{ until: number; text: string; idx: number | null } | null>(null);
  const beams = useRef<(THREE.Group | null)[]>([]); const lights = useRef<(THREE.PointLight | null)[]>([]);
  useEffect(() => on('alarm', (d) => setAlarm({ until: performance.now() + (d.ms || 7000), text: d.text, idx: d.idx ?? null })), []);
  useEffect(() => { if (!alarm) return; const t = setTimeout(() => setAlarm(null), alarm.until - performance.now()); return () => clearTimeout(t); }, [alarm]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime; const a = !!alarm;
    beams.current.forEach((b, i) => { if (!b) return; const active = a && (alarm!.idx == null || alarm!.idx === i); b.rotation.z = active ? Math.sin(t * 5 + i) * 0.55 : Math.sin(t * 0.5 + i) * 0.25; b.rotation.x = active ? Math.cos(t * 4 + i) * 0.4 : 0.2; (b.children[0] as any).material.color.set(active ? RED : CYAN); (b.children[0] as any).material.opacity = active ? 0.32 + Math.sin(t * 14) * 0.1 : 0.06; });
    lights.current.forEach((l, i) => { if (l) l.intensity = a && (alarm!.idx == null || alarm!.idx === i) ? 90 + Math.sin(t * 14) * 60 : 0; });
  });
  return <>{GUARDS.map(([x, z], i) => <group key={i} position={[x, 0, z]} onClick={(e) => { e.stopPropagation(); onPick(); }}>
    <mesh position={[0, 4, 0]}><cylinderGeometry args={[0.5, 0.9, 8, 6]} /><meshStandardMaterial color="#181826" metalness={0.7} roughness={0.3} /></mesh>
    <mesh position={[0, 8.4, 0]}><cylinderGeometry args={[1.2, 0.7, 1, 6]} /><meshStandardMaterial color="#20203a" emissive={alarm && (alarm.idx == null || alarm.idx === i) ? RED : CYAN} emissiveIntensity={1.2} /></mesh>
    <group ref={(r) => { beams.current[i] = r; }} position={[0, 9, 0]}>
      <mesh position={[0, 11, 0]}><cylinderGeometry args={[0.25, 1.8, 22, 16, 1, true]} /><meshBasicMaterial color={CYAN} transparent opacity={0.06} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    </group>
    <pointLight ref={(r) => { lights.current[i] = r; }} position={[0, 10, 0]} color={RED} intensity={0} distance={40} />
    {alarm && (alarm.idx == null ? i === 0 || i === 1 : alarm.idx === i) && <Billboard position={[0, 13, 0]}><Html center distanceFactor={38} zIndexRange={[20, 0]}><div className="city-bubble city-bubble-red" data-testid="guard-bubble"><b>✋ GUARDRAIL BLOCKED</b><span>{alarm.text}</span></div></Html></Billboard>}
  </group>)}</>;
}

/* ---------- shop buildings ---------- */
function Building({ s, onPick, focus, pulse, quiet }: { s: CityShop; onPick: (s: CityShop) => void; focus: boolean; pulse: number; quiet?: boolean }) {
  const target = buildingHeight(s.revenue); const tex = useWindowTex(Math.round(target)); const logo = useLogo(s.logo);
  const g = useRef<THREE.Group>(null); const sign = useRef<THREE.Group>(null); const body = useRef<THREE.MeshStandardMaterial>(null); const rise = useRef(s.fresh ? 0.001 : 1); const born = useRef(performance.now());
  const [hover, setHover] = useState(false);
  const c = s.colors?.[0] || IRIS; const accent = s.colors?.[1] || CYAN;
  useFrame((_, dt) => {
    if (!g.current) return; rise.current = Math.min(1, rise.current + dt / 3.2); const e = 1 - Math.pow(1 - rise.current, 3);
    g.current.scale.y = Math.max(0.001, e); if (sign.current) sign.current.position.y = target * e + 2.1;
    const k = Math.max(0, 1 - (performance.now() - pulse) / 1600);
    if (body.current) body.current.emissiveIntensity = 0.75 + k * 2.2 + (hover || focus ? 0.5 : 0);
  });
  const w = 3.4; const fresh = s.fresh && performance.now() - born.current < 6000;
  return <group position={[s.lot[0], 0, s.lot[1]]} onClick={(e) => { e.stopPropagation(); onPick(s); }} onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { setHover(false); document.body.style.cursor = ''; }}>
    <mesh position={[0, 0.06, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[4.6, 4.6]} /><meshStandardMaterial color="#13131f" /></mesh>
    <mesh position={[0, 0.07, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[2.25, 2.33, 4, 1, Math.PI / 4]} /><meshBasicMaterial color={glow(s.mine ? LIME : c, s.mine ? 2 : 1)} toneMapped={false} /></mesh>
    <group ref={g}>
      <mesh position={[0, target / 2, 0]} castShadow><boxGeometry args={[w, target, w]} /><meshStandardMaterial ref={body} map={tex} emissiveMap={tex} emissive={'#ffffff'} emissiveIntensity={0.8} color={new THREE.Color(c).lerp(new THREE.Color('#1a1a2e'), 0.55)} metalness={0.5} roughness={0.4} /></mesh>
      <mesh position={[0, target + 0.08, 0]}><boxGeometry args={[w + 0.12, 0.16, w + 0.12]} /><meshBasicMaterial color={glow(accent, 2.2)} toneMapped={false} /></mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b], i) => <mesh key={i} position={[a * w / 2, target / 2, b * w / 2]}><boxGeometry args={[0.06, target, 0.06]} /><meshBasicMaterial color={glow(c, 1.4)} toneMapped={false} /></mesh>)}
    </group>
    {/* neon sign: the shop's own logo */}
    <group ref={sign} position={[0, target + 2.1, 0]}><Billboard follow>
      <mesh><planeGeometry args={[2.7, 2.7]} /><meshBasicMaterial color={glow(accent, 2.5)} toneMapped={false} /></mesh>
      <mesh position={[0, 0, 0.01]}><planeGeometry args={[2.45, 2.45]} />{logo ? <meshBasicMaterial map={logo} toneMapped={false} color={new THREE.Color(1.25, 1.25, 1.25)} /> : <meshBasicMaterial color="#111" />}</mesh>
    </Billboard></group>
    {!quiet && (hover || focus || s.mine) && <Billboard position={[0, target + 4.2, 0]}><Html center zIndexRange={[15, 0]}><div className="city-tag" style={{ borderColor: (s.mine ? LIME : c) + '99' }}><b>{s.mine ? '★ My HQ · ' : ''}{s.name}</b><span>${s.revenue.toFixed(2)} revenue · {s.orders} orders</span></div></Html></Billboard>}
    {fresh && <><Sparkles count={50} scale={[5, 3, 5]} position={[0, 1, 0]} size={5} speed={2} color={GOLD} /><pointLight position={[0, 2, 0]} color={GOLD} intensity={60} distance={12} /></>}
  </group>;
}

/* ---------- construction site while the founder builds a shop ---------- */
function Construction({ lot, log }: { lot: [number, number]; log: string }) {
  const frame = useRef<THREE.Group>(null); const crane = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { const t = clock.elapsedTime; if (frame.current) frame.current.scale.y = 0.4 + ((t * 0.12) % 1) * 0.6; if (crane.current) crane.current.rotation.y = Math.sin(t * 0.7) * 1.2; });
  return <group position={[lot[0], 0, lot[1]]}>
    <group ref={frame}><mesh position={[0, 4, 0]}><boxGeometry args={[3.4, 8, 3.4, 3, 6, 3]} /><meshBasicMaterial color={glow(GOLD, 1.6)} wireframe toneMapped={false} /></mesh></group>
    <group ref={crane} position={[2.4, 0, -2.4]}><mesh position={[0, 6, 0]}><boxGeometry args={[0.25, 12, 0.25]} /><meshStandardMaterial color={ORANGE} emissive={ORANGE} emissiveIntensity={0.5} /></mesh>
      <mesh position={[-2.2, 12, 0]}><boxGeometry args={[5.5, 0.22, 0.22]} /><meshStandardMaterial color={ORANGE} emissive={ORANGE} emissiveIntensity={0.5} /></mesh>
      <mesh position={[-4.4, 12.3, 0]}><sphereGeometry args={[0.18]} /><meshBasicMaterial color={glow(RED, 3)} toneMapped={false} /></mesh></group>
    <Sparkles count={80} scale={[5, 9, 5]} position={[0, 4, 0]} size={4} speed={1.6} color={GOLD} />
    <pointLight position={[0, 3, 0]} color={GOLD} intensity={70} distance={14} />
    <Billboard position={[0, 14, 0]}><Html center distanceFactor={34} zIndexRange={[20, 0]}><div className="city-bubble" data-testid="construction-bubble"><b>🏗 Founder is building…</b><span>{log}</span></div></Html></Billboard>
  </group>;
}

/* ---------- AI staff (instanced): founder, writer, designer orbit their building ---------- */
function Staff({ shops }: { shops: CityShop[] }) {
  const ref = useRef<THREE.InstancedMesh>(null); const n = shops.length * 3; const m = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => { const r = ref.current; if (!r) return; const cols = [IRIS, CYAN, PINK]; for (let i = 0; i < n; i++) r.setColorAt(i, glow(cols[i % 3], 1.6)); if (r.instanceColor) r.instanceColor.needsUpdate = true; }, [n]);
  useFrame(({ clock }) => {
    const r = ref.current; if (!r) return; const t = clock.elapsedTime;
    shops.forEach((s, si) => { for (let k = 0; k < 3; k++) { const i = si * 3 + k; const a = t * (0.25 + k * 0.07) + k * 2.1 + si; const rad = 2.55; m.position.set(s.lot[0] + Math.cos(a) * rad, 0.32 + Math.abs(Math.sin(t * 6 + i)) * 0.07, s.lot[1] + Math.sin(a) * rad); m.rotation.y = -a; m.scale.setScalar(k === 0 ? 1.15 : 1); m.updateMatrix(); r.setMatrixAt(i, m.matrix); } });
    r.instanceMatrix.needsUpdate = true;
  });
  if (!n) return null;
  return <instancedMesh key={n} ref={ref} args={[undefined, undefined, n]}><capsuleGeometry args={[0.13, 0.28, 4, 8]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>;
}

/* ---------- customers wandering the street grid (instanced) ---------- */
function Crowd({ count }: { count: number }) {
  const ref = useRef<THREE.InstancedMesh>(null); const m = useMemo(() => new THREE.Object3D(), []);
  const walkers = useMemo(() => Array.from({ length: count }, () => { const vert = Math.random() < 0.5; const s = STREETS[(Math.random() * STREETS.length) | 0]; return { vert, s, p: (Math.random() - 0.5) * 56, v: (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 1.2), off: (Math.random() < 0.5 ? -0.55 : 0.55), cd: 0 }; }), [count]);
  useEffect(() => { const r = ref.current; if (!r) return; const pal = ['#ffd38a', '#9fe9ff', '#ffffff', '#ff9ccf', '#b9b0ff']; for (let i = 0; i < count; i++) r.setColorAt(i, glow(pal[i % pal.length], 0.9)); if (r.instanceColor) r.instanceColor.needsUpdate = true; }, [count]);
  useFrame((_, dt) => {
    const r = ref.current; if (!r) return; const d = Math.min(dt, 0.05);
    walkers.forEach((w, i) => {
      w.p += w.v * d; if (Math.abs(w.p) > 29) { w.v *= -1; }
      // at intersections occasionally turn
      w.cd -= d; const near = w.cd > 0 ? undefined : STREETS.find((s) => Math.abs(s - w.p) < 0.06); if (near !== undefined) w.cd = 0.5; if (near !== undefined && Math.random() < 0.3) { const ns = near; w.p = w.s; w.s = ns; w.vert = !w.vert; }
      if (w.vert) m.position.set(w.s + w.off, 0.25, w.p); else m.position.set(w.p, 0.25, w.s + w.off);
      m.scale.set(1, 1, 1); m.updateMatrix(); r.setMatrixAt(i, m.matrix);
    });
    r.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, count]}><capsuleGeometry args={[0.1, 0.22, 3, 6]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>;
}

/* ---------- money: light packets with trails along the streets (instanced) ---------- */
const TRAIL = 10, MAXP = 80;
function Packets() {
  const ref = useRef<THREE.InstancedMesh>(null); const list = useRef<Packet[]>([]); const m = useMemo(() => new THREE.Object3D(), []); const tmp = useMemo<P>(() => [0, 0, 0], []); const col = useMemo(() => new THREE.Color(), []);
  useEffect(() => on('packet', (p: Packet) => { list.current.push(p); if (list.current.length > MAXP) list.current.shift(); }), []);
  useFrame(() => {
    const r = ref.current; if (!r) return; const now = performance.now(); let i = 0;
    list.current = list.current.filter((p) => now - p.t0 < p.dur + 600);
    for (const p of list.current) {
      const t = (now - p.t0) / p.dur; if (t < 0) continue;
      for (let k = 0; k < TRAIL; k++) {
        const tt = t - k * 0.018; if (tt < 0 || tt > 1) continue; samplePath(p.path, tt, tmp);
        m.position.set(tmp[0], tmp[1], tmp[2]); const sc = (k === 0 ? 1.6 : 1.1 - k / TRAIL) * (p.replay ? 0.7 : 1); m.scale.setScalar(Math.max(0.05, sc)); m.updateMatrix();
        r.setMatrixAt(i, m.matrix); col.set(p.color).multiplyScalar(k === 0 ? 5 : 3 - k * 0.2); r.setColorAt(i, col); i++;
      }
    }
    r.count = i; r.instanceMatrix.needsUpdate = true; if (r.instanceColor) r.instanceColor.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[undefined, undefined, MAXP * TRAIL]} frustumCulled={false}><sphereGeometry args={[0.16, 10, 10]} /><meshBasicMaterial toneMapped={false} /></instancedMesh>;
}

/* ---------- camera rig: slow orbit + fly-to ---------- */
function Rig({ paused }: { paused: boolean }) {
  const ctl = useRef<any>(null); const { camera } = useThree(); const fly = useRef<{ pos: THREE.Vector3; look: THREE.Vector3; until: number } | null>(null); const idle = useRef(0);
  useEffect(() => on('fly', (d: { pos: P; look: P; ms?: number }) => { fly.current = { pos: new THREE.Vector3(...d.pos), look: new THREE.Vector3(...d.look), until: performance.now() + (d.ms || 2200) }; }), []);
  useFrame((_, dt) => {
    const c = ctl.current; if (!c) return;
    if (fly.current) { const k = 1 - Math.pow(0.0025, dt); camera.position.lerp(fly.current.pos, k); c.target.lerp(fly.current.look, k); if (performance.now() > fly.current.until) fly.current = null; }
    idle.current += dt; c.autoRotate = !paused && !fly.current && idle.current > 2.5; c.update();
  });
  return <OrbitControls ref={ctl} makeDefault enableDamping dampingFactor={0.08} autoRotateSpeed={0.35} minDistance={8} maxDistance={95} maxPolarAngle={1.38} target={[0, 4, 4]} onStart={() => { idle.current = 0; fly.current = null; }} />;
}

/* ---------- scene root ---------- */
export type SceneProps = { shops: CityShop[]; build: { lot: [number, number]; log: string } | null; focus?: string | null; pulses: Record<string, number>; bankHot: number; paused: boolean; night: number; lowPower?: boolean;
  onShop: (s: CityShop) => void; onBank: () => void; onBeacon: () => void; onGuard: () => void };
export default function CityScene(p: SceneProps) {
  const bg = new THREE.Color('#05050b').lerp(new THREE.Color('#141634'), 1 - p.night);
  return <Canvas dpr={p.lowPower ? 1 : [1, 1.75]} gl={{ antialias: false, powerPreference: 'high-performance' }} camera={{ position: [46, 34, 54], fov: 42, near: 0.5, far: 400 }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; }} data-testid="city-canvas">
    <color attach="background" args={[bg]} />
    <fog attach="fog" args={[bg, 60, 150]} />
    <ambientLight intensity={0.25 + (1 - p.night) * 0.35} color="#8f8cff" />
    <hemisphereLight args={['#5a5aff', '#0a0a14', 0.35]} />
    <directionalLight position={[-30, 50, -20]} intensity={0.5 + (1 - p.night) * 0.8} color="#b9c4ff" />
    <Stars radius={160} depth={40} count={p.lowPower ? 800 : 2500} factor={4} fade speed={0.4} saturation={0} />
    <Ground /><Harbour />
    <Beacon onPick={p.onBeacon} /><Bank onPick={p.onBank} hot={p.bankHot} /><Guards onPick={p.onGuard} />
    {p.shops.map((s) => <Building key={s.id} s={s} onPick={p.onShop} focus={p.focus === s.id} pulse={p.pulses[s.id] || 0} quiet={p.paused} />)}
    {p.build && <Construction lot={p.build.lot} log={p.build.log} />}
    <Staff shops={p.shops} /><Crowd count={p.lowPower ? 80 : 180} /><Packets />
    <Rig paused={p.paused} />
    {!p.lowPower && <EffectComposer multisampling={0}><Bloom mipmapBlur intensity={1.15} luminanceThreshold={0.85} luminanceSmoothing={0.2} radius={0.75} /><Vignette offset={0.25} darkness={0.75} /></EffectComposer>}
  </Canvas>;
}
