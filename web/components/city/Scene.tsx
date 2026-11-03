'use client';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, Environment, Html, Lightformer, OrbitControls, Sky, Sparkles, Stars } from '@react-three/drei';
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BANK, DISTRICT_INFO, DOCK, ENV, PITCH, QUALITY, SHORE, bounds, bus, samplePath, type CityShop, type P, type Packet, type Quality, type Site } from './layout';
import { Ground, Lamps, People, Traffic, Trees, Water } from './world';
import { Buildings } from './buildings';
import { facadeBox, facadeLit, facadeMap, TILE } from './tex';

const IRIS = '#B8975A', CYAN = '#A9B4A6', GOLD = '#D9B56E', RED = '#C0624A', ORANGE = '#D2A066';
const MAXP = 60, TRAIL = 7;
const glow = (c: string, k = 2.4) => new THREE.Color(c).multiplyScalar(k);
const on = (t: string, f: (d: any) => void) => { const h = (e: any) => f(e.detail); bus.addEventListener(t, h); return () => bus.removeEventListener(t, h); };

/* ---------- sky + sun/moon tied to the hour (Lagos) ---------- */
function Daylight({ hour, q }: { hour: number; q: Quality }) {
  const sun = useRef<THREE.DirectionalLight>(null); const hemi = useRef<THREE.HemisphereLight>(null); const { scene, controls } = useThree() as any;
  const e = Math.sin(((hour - 6) / 12) * Math.PI); // sun elevation -1..1
  const day = THREE.MathUtils.smoothstep(e, -0.12, 0.3); const az = ((hour - 6) / 12) * Math.PI;
  const sunDir = useMemo(() => new THREE.Vector3(Math.cos(az) * 0.8, Math.max(e, 0.05), 0.45 - Math.sin(az) * 0.2).normalize(), [az, e]);
  const moonDir = useMemo(() => new THREE.Vector3(-0.4, 0.7, -0.5).normalize(), []);
  const fogC = useMemo(() => new THREE.Color('#0f0d0a').lerp(new THREE.Color(e < 0.25 ? '#e9b38a' : '#b9cde2'), day), [day, e]);
  useEffect(() => { ENV.night = 1 - day; scene.fog = new THREE.Fog(fogC, 90 + day * 40, 330 + day * 120); scene.background = day > 0.04 ? null : new THREE.Color('#0a0907'); }, [day, fogC, scene]);
  useFrame(() => { const t: THREE.Vector3 = controls?.target || new THREE.Vector3(); const L = sun.current; if (!L) return; const dir = day > 0.02 ? sunDir : moonDir;
    L.position.set(t.x + dir.x * 90, dir.y * 90, t.z + dir.z * 90); L.target.position.copy(t); L.target.updateMatrixWorld(); });
  const warm = new THREE.Color('#ffd2a1').lerp(new THREE.Color('#fff6e8'), THREE.MathUtils.clamp(e * 2, 0, 1));
  const sh = QUALITY[q].shadows;
  return <>
    {day > 0.04 && <Sky distance={4500} sunPosition={[sunDir.x * 100, sunDir.y * 100, sunDir.z * 100]} turbidity={5 + (1 - e) * 4} rayleigh={1.2 + (1 - e) * 1.5} mieCoefficient={0.006} mieDirectionalG={0.85} />}
    <Stars radius={300} depth={60} count={q === 'low' ? 800 : 2600} factor={5} fade speed={0.3} saturation={0} />
    <hemisphereLight ref={hemi} args={[day > 0.04 ? '#cfe1ff' : '#4a4234', '#3a3328', 0.25 + day * 0.85]} />
    <ambientLight intensity={0.12 + (1 - day) * 0.18} color={day > 0.04 ? '#ffffff' : '#b8a07a'} />
    <directionalLight ref={sun} intensity={day > 0.02 ? 0.4 + day * 2.6 : 0.45} color={day > 0.02 ? warm : '#c9bfa8'} castShadow={sh > 0}
      shadow-mapSize={[sh || 512, sh || 512]} shadow-camera-left={-70} shadow-camera-right={70} shadow-camera-top={70} shadow-camera-bottom={-70} shadow-camera-far={260} shadow-bias={-0.0004} shadow-normalBias={0.04} />
  </>;
}

/* ---------- landmarks ---------- */
function Bank({ onPick, hot }: { onPick: () => void; hot: number }) {
  const crown = useRef<THREE.Mesh>(null); const side = useMemo(() => new THREE.MeshStandardMaterial({ map: facadeMap('glass'), emissiveMap: facadeLit('glass'), emissive: '#ffd38a', color: '#e8d6a8', metalness: 0.85, roughness: 0.15, envMapIntensity: 1.6 }), []);
  useFrame(({ clock }) => { side.emissiveIntensity = 0.1 + ENV.night * 1.1; if (crown.current) { crown.current.rotation.y = clock.elapsedTime * 0.6; const k = Math.max(0, 1 - (performance.now() - hot) / 1500); (crown.current.material as any).color = glow(GOLD, 2 + k * 5); } });
  const stone = <meshStandardMaterial color="#e6dcc6" roughness={0.7} />;
  return <group position={[BANK[0], 0.2, BANK[1]]} onClick={(e) => { e.stopPropagation(); onPick(); }} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
    {[0, 1, 2].map((i) => <mesh key={i} position={[0, 0.15 + i * 0.3, 3.6 - i * 0.4]} receiveShadow><boxGeometry args={[10 - i * 0.6, 0.3, 3.2]} />{stone}</mesh>)}
    <mesh position={[0, 2.6, 0.2]} castShadow receiveShadow><boxGeometry args={[9, 4.4, 6.4]} />{stone}</mesh>
    {[-3.6, -2.2, -0.75, 0.75, 2.2, 3.6].map((x) => <mesh key={x} position={[x, 2.75, 3.8]} castShadow><cylinderGeometry args={[0.28, 0.32, 4.1, 16]} />{stone}</mesh>)}
    <mesh position={[0, 5.15, 3.8]} castShadow><boxGeometry args={[9.6, 0.6, 1.4]} />{stone}</mesh>
    <mesh position={[0, 6.1, 3.6]} rotation={[0, Math.PI / 4, 0]} scale={[1, 1, 0.12]} castShadow><coneGeometry args={[6.7, 1.3, 4]} />{stone}</mesh>
    <mesh position={[0, 15.2, -0.8]} geometry={facadeBox(5, 21, 5, TILE.glass[0], TILE.glass[1])} material={side} castShadow />
    <mesh position={[0, 26.7, -0.8]} castShadow><cylinderGeometry args={[0, 3.2, 2.2, 4]} /><meshStandardMaterial color="#b8975a" metalness={0.9} roughness={0.2} /></mesh>
    <mesh ref={crown} position={[0, 28.8, -0.8]}><torusGeometry args={[1.3, 0.16, 12, 48]} /><meshBasicMaterial color={glow(GOLD, 2)} toneMapped={false} /></mesh>
    <pointLight position={[0, 27, -0.8]} color={GOLD} intensity={70} distance={26} />
    <Billboard position={[0, 31.5, -0.8]}><Html center zIndexRange={[10, 0]}><button className="city-tag" style={{ borderColor: GOLD + '99' }} onClick={onPick} data-testid="bank-tag"><b style={{ color: GOLD }}>§ HollowCo Bank</b><span>public ledger · click to audit</span></button></Html></Billboard>
  </group>;
}
function Dock() {
  const ship = useRef<THREE.Group>(null); useFrame(({ clock }) => { if (ship.current) { ship.current.position.y = Math.sin(clock.elapsedTime * 0.9) * 0.12; ship.current.rotation.z = Math.sin(clock.elapsedTime * 0.7) * 0.015; } });
  const cont = ['#d35400', '#2980b9', '#e2b04a', '#5a3fa0', '#16a085', '#c0392b'];
  return <group position={[DOCK[0], 0, DOCK[1]]}>
    <mesh position={[0, 0.2, -2.5]} castShadow receiveShadow><boxGeometry args={[14, 0.8, 11]} /><meshStandardMaterial color="#6d5a45" roughness={0.95} /></mesh>
    {[-6, -2, 2, 6].map((x) => [-7, 2].map((z) => <mesh key={x + ':' + z} position={[x, -1, z]}><cylinderGeometry args={[0.25, 0.25, 2.4, 8]} /><meshStandardMaterial color="#3b3026" /></mesh>))}
    <group position={[-3, 0.6, -4]}><mesh position={[0, 1.8, 0]} castShadow><boxGeometry args={[6, 3.6, 4]} /><meshStandardMaterial color="#c9cfd6" metalness={0.5} roughness={0.5} /></mesh><mesh position={[0, 3.9, 0]} rotation={[Math.PI / 2, 0, Math.PI / 2]}><cylinderGeometry args={[0.9, 0.9, 4, 3]} /><meshStandardMaterial color="#8d9399" metalness={0.6} /></mesh>
      <mesh position={[0, 2.6, 2.02]}><planeGeometry args={[4.8, 0.9]} /><meshBasicMaterial color={glow(ORANGE, 1.6)} toneMapped={false} /></mesh></group>
    {Array.from({ length: 10 }, (_, i) => <mesh key={i} position={[2 + (i % 3) * 1.6, 0.6 + 0.45 + Math.floor(i / 6) * 0.9, -5 + (Math.floor(i / 3) % 2) * 2.4]} castShadow><boxGeometry args={[1.5, 0.9, 2.3]} /><meshStandardMaterial color={cont[i % 6]} roughness={0.6} /></mesh>)}
    <group position={[5.5, 0.6, 1.5]}><mesh position={[0, 4.5, 0]} castShadow><boxGeometry args={[0.4, 9, 0.4]} /><meshStandardMaterial color={ORANGE} /></mesh><mesh position={[0, 9, 2]} castShadow><boxGeometry args={[0.35, 0.35, 8]} /><meshStandardMaterial color={ORANGE} /></mesh><mesh position={[0, 9.4, 5.8]}><sphereGeometry args={[0.16]} /><meshBasicMaterial color={glow(RED, 3)} toneMapped={false} /></mesh></group>
    <group ref={ship} position={[-1, 0, 8]}><mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[16, 1.6, 4]} /><meshStandardMaterial color="#1f2a3a" metalness={0.4} roughness={0.5} /></mesh><mesh position={[0, -0.25, 0]}><boxGeometry args={[16.1, 0.4, 4.1]} /><meshStandardMaterial color="#8b1e1e" /></mesh>
      <mesh position={[-5.5, 2.2, 0]} castShadow><boxGeometry args={[3, 2.4, 3.4]} /><meshStandardMaterial color="#eeeeee" /></mesh>
      {[-2.5, -0.8, 0.9, 2.6, 4.3].map((x, i) => <mesh key={i} position={[x, 1.6, 0]} castShadow><boxGeometry args={[1.6, 1, 3.4]} /><meshStandardMaterial color={cont[i % 6]} /></mesh>)}</group>
    <Billboard position={[-3, 8.5, -4]}><Html center zIndexRange={[10, 0]} className="city-label"><div className="city-tag" style={{ borderColor: ORANGE + '88' }}><b style={{ color: ORANGE }}>⬡ Printful dock</b><span>physical goods ship here (drafts only)</span></div></Html></Billboard>
  </group>;
}
function ConstructionSite({ s }: { s: Site }) {
  const frame = useRef<THREE.Group>(null); const crane = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { const t = clock.elapsedTime; if (frame.current) frame.current.scale.y = 0.3 + ((t * 0.1) % 1) * 0.7; if (crane.current) crane.current.rotation.y = Math.sin(t * 0.7) * 1.2; });
  return <group position={[s.x, 0.2, s.z]} rotation-y={s.face > 0 ? 0 : Math.PI}>
    <mesh position={[0, 0.5, 0]}><boxGeometry args={[6.4, 1, 6]} /><meshStandardMaterial color="#c9a227" transparent opacity={0.35} /></mesh>
    {[-3.2, 3.2].map((x) => <mesh key={x} position={[x, 0.6, 3]}><boxGeometry args={[0.1, 1.2, 0.1]} /><meshStandardMaterial color="#ff8c1a" /></mesh>)}
    <group ref={frame}><mesh position={[0, 4, 0]}><boxGeometry args={[4.6, 8, 4.6, 3, 6, 3]} /><meshBasicMaterial color={glow(GOLD, 1.6)} wireframe toneMapped={false} /></mesh></group>
    <group ref={crane} position={[2.6, 0, -2.4]}><mesh position={[0, 7, 0]}><boxGeometry args={[0.3, 14, 0.3]} /><meshStandardMaterial color={ORANGE} emissive={ORANGE} emissiveIntensity={0.4} /></mesh>
      <mesh position={[-2.6, 14, 0]}><boxGeometry args={[6.5, 0.25, 0.25]} /><meshStandardMaterial color={ORANGE} emissive={ORANGE} emissiveIntensity={0.4} /></mesh>
      <mesh position={[-5.4, 14.3, 0]}><sphereGeometry args={[0.18]} /><meshBasicMaterial color={glow(RED, 3)} toneMapped={false} /></mesh></group>
    <Sparkles count={70} scale={[6, 9, 6]} position={[0, 4, 0]} size={4} speed={1.6} color={GOLD} />
    <pointLight position={[0, 3, 0]} color={GOLD} intensity={70} distance={14} />
    <Billboard position={[0, 16, 0]}><Html center zIndexRange={[20, 0]}><div className="city-bubble" data-testid="construction-bubble"><b>{s.name || 'New store'} · by {s.owner}</b><span>{s.log}</span></div></Html></Billboard>
  </group>;
}
function DistrictLabels({ shops, hl, onPick }: { shops: CityShop[]; hl: string | null; onPick: (d: string) => void }) {
  const { camera } = useThree(); const [fade, setFade] = useState(1);
  // Labels sit well above the skyline and fade out as you zoom in, so they never cover shop signs.
  useFrame(() => { const f = Math.round(Math.max(0, Math.min(1, (camera.position.y - 58) / 30)) * 10) / 10; if (f !== fade) setFade(f); });
  const c = useMemo(() => { const m: Record<string, { x: number; z: number; n: number; h?: number }> = {}; shops.forEach((s) => { const d = (m[s.plot.district] ||= { x: 0, z: 0, n: 0 }); d.x += s.x; d.z += s.z; d.n++; d.h = Math.max(d.h || 0, s.h); }); return m; }, [shops]);
  if (fade <= 0) return null;
  return <>{Object.entries(c).map(([k, v]) => { const info = DISTRICT_INFO[k]; if (!info) return null; return <Billboard key={k} position={[v.x / v.n, (v.h || 10) + 16, v.z / v.n]}><Html center zIndexRange={[9, 0]} className="city-label"><button className="city-district" style={{ borderColor: info.color, color: info.color, opacity: fade * (hl && hl !== k ? 0.35 : 0.92), pointerEvents: fade < 0.4 ? 'none' : 'auto' }} onClick={() => onPick(k)} data-testid={`district-${k}`}>{info.icon} {info.label}<small>{v.n} stores</small></button></Html></Billboard>; })}</>;
}
function Beacon({ onPick }: { onPick: () => void }) {
  const ring = useRef<THREE.Group>(null); const dot = useRef<THREE.Mesh>(null); const beam = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => { const t = clock.elapsedTime; if (ring.current) ring.current.rotation.y = t * 0.35; if (dot.current) dot.current.position.y = -1.2 + Math.abs(Math.sin(t * 1.6)) * 0.5; if (beam.current) beam.current.opacity = 0.09 + Math.sin(t * 2) * 0.03; });
  return <group onClick={(e) => { e.stopPropagation(); onPick(); }}>
    <mesh position={[0, 7, 0]}><cylinderGeometry args={[0.45, 1.0, 14, 8]} /><meshStandardMaterial color="#17172b" metalness={0.8} roughness={0.25} emissive={IRIS} emissiveIntensity={0.08} /></mesh>
    {[2, 5, 8, 11].map((y) => <mesh key={y} position={[0, y, 0]}><torusGeometry args={[1.02 - y * 0.045, 0.04, 6, 32]} /><meshBasicMaterial color={glow(CYAN, 1.5)} toneMapped={false} /></mesh>)}
    <group ref={ring} position={[0, 18, 0]}>
      <mesh><torusGeometry args={[3, 0.62, 24, 96]} /><meshStandardMaterial color="#ffffff" emissive="#D4B98A" emissiveIntensity={2.2} toneMapped={false} metalness={0.2} roughness={0.2} /></mesh>
      <mesh ref={dot} position={[1.15, -1.2, 0]}><sphereGeometry args={[0.6, 32, 32]} /><meshBasicMaterial color={glow(CYAN, 4)} toneMapped={false} /></mesh>
    </group>
    <pointLight position={[0, 18, 0]} color={IRIS} intensity={260} distance={60} decay={2} />
    <mesh position={[0, 40, 0]}><cylinderGeometry args={[0.4, 2.4, 44, 24, 1, true]} /><meshBasicMaterial ref={beam} color={IRIS} transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <Sparkles count={60} scale={[10, 22, 10]} position={[0, 11, 0]} size={3} speed={0.4} color={CYAN} />
  </group>;
}

function Guards({ onPick, at }: { onPick: () => void; at: [number, number][] }) {
  const [alarm, setAlarm] = useState<{ until: number; text: string; idx: number | null } | null>(null);
  const beams = useRef<(THREE.Group | null)[]>([]); const lights = useRef<(THREE.PointLight | null)[]>([]);
  useEffect(() => on('alarm', (d) => setAlarm({ until: performance.now() + (d.ms || 7000), text: d.text, idx: d.idx ?? null })), []);
  useEffect(() => { if (!alarm) return; const t = setTimeout(() => setAlarm(null), alarm.until - performance.now()); return () => clearTimeout(t); }, [alarm]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime; const a = !!alarm;
    beams.current.forEach((b, i) => { if (!b) return; const active = a && (alarm!.idx == null || alarm!.idx === i); b.rotation.z = active ? Math.sin(t * 5 + i) * 0.55 : Math.sin(t * 0.5 + i) * 0.25; b.rotation.x = active ? Math.cos(t * 4 + i) * 0.4 : 0.2; (b.children[0] as any).material.color.set(active ? RED : CYAN); (b.children[0] as any).material.opacity = active ? 0.32 + Math.sin(t * 14) * 0.1 : 0.06; });
    lights.current.forEach((l, i) => { if (l) l.intensity = a && (alarm!.idx == null || alarm!.idx === i) ? 90 + Math.sin(t * 14) * 60 : 0; });
  });
  return <>{at.map(([x, z], i) => <group key={i} position={[x, 0, z]} onClick={(e) => { e.stopPropagation(); onPick(); }}>
    <mesh position={[0, 4, 0]}><cylinderGeometry args={[0.5, 0.9, 8, 6]} /><meshStandardMaterial color="#181826" metalness={0.7} roughness={0.3} /></mesh>
    <mesh position={[0, 8.4, 0]}><cylinderGeometry args={[1.2, 0.7, 1, 6]} /><meshStandardMaterial color="#20203a" emissive={alarm && (alarm.idx == null || alarm.idx === i) ? RED : CYAN} emissiveIntensity={1.2} /></mesh>
    <group ref={(r) => { beams.current[i] = r; }} position={[0, 9, 0]}>
      <mesh position={[0, 11, 0]}><cylinderGeometry args={[0.25, 1.8, 22, 16, 1, true]} /><meshBasicMaterial color={CYAN} transparent opacity={0.06} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    </group>
    <pointLight ref={(r) => { lights.current[i] = r; }} position={[0, 10, 0]} color={RED} intensity={0} distance={40} />
    {alarm && (alarm.idx == null ? i === 0 || i === 1 : alarm.idx === i) && <Billboard position={[0, 13, 0]}><Html center distanceFactor={38} zIndexRange={[20, 0]}><div className="city-bubble city-bubble-red" data-testid="guard-bubble"><b>GUARDRAIL BLOCKED</b><span>{alarm.text}</span></div></Html></Billboard>}
  </group>)}</>;
}

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

function Rig({ paused }: { paused: boolean }) {
  const ctl = useRef<any>(null); const { camera } = useThree(); const fly = useRef<{ pos: THREE.Vector3; look: THREE.Vector3; until: number } | null>(null); const idle = useRef(0);
  useEffect(() => on('fly', (d: { pos: P; look: P; ms?: number }) => { fly.current = { pos: new THREE.Vector3(...d.pos), look: new THREE.Vector3(...d.look), until: performance.now() + (d.ms || 2200) }; }), []);
  useFrame((_, dt) => {
    const c = ctl.current; if (!c) return;
    if (fly.current) { const k = 1 - Math.pow(0.0025, dt); camera.position.lerp(fly.current.pos, k); c.target.lerp(fly.current.look, k); if (performance.now() > fly.current.until) fly.current = null; }
    idle.current += dt; c.autoRotate = !paused && !fly.current && idle.current > 2.5; c.update();
  });
  return <OrbitControls ref={ctl} makeDefault enableDamping dampingFactor={0.08} autoRotateSpeed={0.35} minDistance={6} maxDistance={240} maxPolarAngle={1.38} target={[0, 3, 6]} onStart={() => { idle.current = 0; fly.current = null; }} />;
}

export type SceneProps = { shops: CityShop[]; sites: Site[]; focus?: string | null; pulses: Record<string, number>; bankHot: number; paused: boolean; hour: number; quality: Quality; hl: string | null;
  onShop: (s: CityShop) => void; onBank: () => void; onBeacon: () => void; onGuard: () => void; onDistrict: (d: string) => void };
export default function CityScene(p: SceneProps) {
  const Q = QUALITY[p.quality];
  const b = useMemo(() => bounds(p.shops), [p.shops]);
  const guards = useMemo<[number, number][]>(() => [[b.kx0 * PITCH - 4, b.kz0 * PITCH - 4], [(b.kx1 + 1) * PITCH + 4, b.kz0 * PITCH - 4], [b.kx0 * PITCH - 4, SHORE - 2], [(b.kx1 + 1) * PITCH + 4, SHORE - 2]], [b]);
  const night = 1 - THREE.MathUtils.smoothstep(Math.sin(((p.hour - 6) / 12) * Math.PI), -0.12, 0.3);
  return <Canvas shadows={Q.shadows > 0 ? 'soft' : false} dpr={[1, Q.dpr]} gl={{ antialias: !Q.bloom, powerPreference: 'high-performance' }} camera={{ position: [70, 55, 95], fov: 42, near: 0.5, far: 900 }}
    onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.0; }} data-testid="city-canvas">
    <Daylight hour={p.hour} q={p.quality} />
    {Q.env && <Environment frames={1} resolution={128} background={false}>
      <Lightformer form="rect" intensity={night > 0.5 ? 0.6 : 2.2} color={night > 0.5 ? '#5a6cff' : '#ffffff'} scale={[60, 20, 1]} position={[0, 30, -60]} />
      <Lightformer form="rect" intensity={night > 0.5 ? 0.4 : 1.4} color={night > 0.5 ? '#D2A066' : '#cfe1ff'} scale={[60, 12, 1]} position={[-60, 10, 0]} rotation-y={Math.PI / 2} />
      <Lightformer form="ring" intensity={night > 0.5 ? 1.2 : 3} color={night > 0.5 ? '#B8975A' : '#fff6e8'} scale={14} position={[40, 40, 40]} />
      <mesh scale={200}><sphereGeometry /><meshBasicMaterial color={night > 0.5 ? '#0f0d0a' : '#8fb0d6'} side={THREE.BackSide} /></mesh>
    </Environment>}
    <Ground b={b} shops={p.shops} /><Water b={b} /><Lamps b={b} /><Trees b={b} shops={p.shops} density={Q.trees} />
    <Traffic b={b} count={Q.cars} /><People b={b} count={Q.peds} shops={p.shops} />
    <Beacon onPick={p.onBeacon} /><Bank onPick={p.onBank} hot={p.bankHot} /><Guards onPick={p.onGuard} at={guards} /><Dock />
    <Buildings shops={p.shops} detail={Q.detail} focus={p.focus} pulses={p.pulses} onPick={p.onShop} quiet={p.paused} hl={p.hl} />
    {p.sites.map((s) => <ConstructionSite key={s.shopId} s={s} />)}
    <DistrictLabels shops={p.shops} hl={p.hl} onPick={p.onDistrict} />
    <Packets />
    <Rig paused={p.paused} />
    {Q.bloom && <EffectComposer multisampling={Q.ms}><Bloom mipmapBlur intensity={0.25 + night * 0.35} luminanceThreshold={0.95 - night * 0.1} luminanceSmoothing={0.2} radius={0.7} /><Vignette offset={0.3} darkness={0.55 + night * 0.2} /></EffectComposer>}
  </Canvas>;
}
