'use client';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, Environment, Html, OrbitControls, PerformanceMonitor, Sky, Sparkles, Stars, useProgress } from '@react-three/drei';
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, Vignette } from '@react-three/postprocessing';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { HDRI, preloadImages } from './assets';
import { Cars, FillerCity, Pedestrians, StreetProps, fillerLots } from './actors';
import { isCartLot, isPark } from './world';
import { useCart } from '@/lib/cart';
import { api } from '@/lib/api';
import { BANK, CART_AT, DISTRICT_INFO, DOCK, ENV, PITCH, QUALITY, SHORE, bounds, bus, samplePath, type CityShop, type P, type Packet, type Quality, type Site } from './layout';
import { Ground, Lamps, Trees, Water } from './world';
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
  const fogC = useMemo(() => new THREE.Color('#14110d').lerp(new THREE.Color(e < 0.25 ? '#d9a27a' : '#c2c4bf'), day), [day, e]);
  useEffect(() => { ENV.night = 1 - day; scene.fog = new THREE.Fog(fogC, 45 + day * 25, 220 + day * 90); scene.background = day > 0.04 ? null : new THREE.Color('#0a0907'); }, [day, fogC, scene]);
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
  return <group position={[BANK[0], 0.2, BANK[1]]} onClick={(e) => { e.stopPropagation(); if (e.delta > 6) return; onPick(); }} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
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
/* ---------- the Cart: a department store on the plaza. One building for everyone; the badge is drawn client-side from
   THIS viewer's own cart (account cart from the server, or this browser's guest cart), so no one sees another account's items. */
let cartSignT: THREE.CanvasTexture | null = null;
function cartSign() {
  if (cartSignT) return cartSignT;
  const c = document.createElement('canvas'); c.width = 1024; c.height = 320; const g = c.getContext('2d')!;
  g.fillStyle = '#0E0D0B'; g.beginPath(); g.roundRect(8, 8, 1008, 304, 40); g.fill();
  g.lineWidth = 12; g.strokeStyle = '#B8975A'; g.shadowColor = '#D9B56E'; g.shadowBlur = 30; g.beginPath(); g.roundRect(18, 18, 988, 284, 32); g.stroke();
  g.font = '700 220px "Iowan Old Style", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#F9F8F5'; g.shadowColor = '#F3DCA8'; g.shadowBlur = 36; g.fillText('Cart', 512, 172);
  cartSignT = new THREE.CanvasTexture(c); cartSignT.colorSpace = THREE.SRGBColorSpace; cartSignT.anisotropy = 8; return cartSignT;
}
function CartBuilding({ onPick }: { onPick: () => void }) {
  const { count, mode } = useCart(); const sign = useMemo(cartSign, []);
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ map: facadeMap('glass'), emissiveMap: facadeLit('glass'), emissive: '#ffd9a0', color: '#efe4cc', metalness: 0.6, roughness: 0.2 }), []);
  const signM = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => { glass.emissiveIntensity = 0.25 + ENV.night * 1.2; if (signM.current) signM.current.color.setScalar(1.15 + ENV.night * 0.9); });
  const stone = <meshStandardMaterial color="#ECEAE3" roughness={0.65} />; const ink = <meshStandardMaterial color="#2a2722" roughness={0.5} metalness={0.3} />;
  const brass = <meshStandardMaterial color="#B8975A" metalness={0.85} roughness={0.25} />;
  const pick = (e: any) => { e.stopPropagation(); if (e.delta > 6) return; onPick(); };
  return <group position={[CART_AT[0], 0.2, CART_AT[1]]} onClick={pick} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
    <mesh position={[0, 0.1, 0]} receiveShadow><boxGeometry args={[13.6, 0.2, 13.6]} /><meshStandardMaterial color="#d9d3c4" roughness={0.9} /></mesh>
    {/* plinth + two-storey arcade + glass upper floors */}
    <mesh position={[0, 2.4, -0.6]} castShadow receiveShadow><boxGeometry args={[12, 4.4, 9]} />{stone}</mesh>
    {[-4.8, -2.4, 0, 2.4, 4.8].map((x) => <mesh key={x} position={[x, 2.2, 3.95]} castShadow><boxGeometry args={[0.5, 4, 0.5]} />{stone}</mesh>)}
    {[-3.6, -1.2, 1.2, 3.6].map((x) => <mesh key={'w' + x} position={[x, 1.9, 3.75]}><boxGeometry args={[2, 3.2, 0.1]} /><meshStandardMaterial color="#1a1814" emissive="#ffcf86" emissiveIntensity={0.7} metalness={0.4} roughness={0.15} /></mesh>)}
    <mesh position={[0, 4.15, 4.6]} rotation={[0.32, 0, 0]} castShadow><boxGeometry args={[12.4, 0.12, 1.8]} /><meshStandardMaterial color="#0E0D0B" roughness={0.6} /></mesh>
    <mesh position={[0, 4.75, 3.95]} castShadow><boxGeometry args={[12.6, 0.5, 0.6]} />{brass}</mesh>
    <mesh position={[0, 9.4, -1.2]} geometry={facadeBox(11, 9, 7.6, TILE.glass[0], TILE.glass[1])} material={glass} castShadow />
    <mesh position={[0, 14.1, -1.2]} castShadow><boxGeometry args={[11.6, 0.5, 8.2]} />{ink}</mesh>
    {/* the illuminated sign: "Cart" */}
    <mesh position={[0, 16.6, 1.8]} castShadow><boxGeometry args={[10.6, 3.5, 0.4]} />{ink}</mesh>
    <mesh position={[0, 16.6, 2.02]}><planeGeometry args={[10.2, 3.19]} /><meshBasicMaterial ref={signM} map={sign} toneMapped={false} /></mesh>
    {[-4.2, 4.2].map((x) => <mesh key={'p' + x} position={[x, 14.8, 1.8]}><boxGeometry args={[0.25, 1.2, 0.25]} />{brass}</mesh>)}
    <pointLight position={[0, 16, 5]} color="#F3DCA8" intensity={60} distance={22} />
    <pointLight position={[0, 3.5, 7]} color="#ffcf86" intensity={25} distance={14} />
    {/* item-count badge — this viewer's own cart only */}
    <mesh position={[5.3, 18.3, 2.1]}><circleGeometry args={[1.1, 40]} /><meshBasicMaterial color={glow('#B8975A', 1.6)} toneMapped={false} /></mesh>
    <Html position={[5.3, 18.3, 2.3]} center transform scale={0.9} zIndexRange={[11, 0]}><span className="cart-badge-3d" data-testid="cart-building-badge" style={{ color: '#0E0D0B', font: '700 30px Inter, system-ui, sans-serif' }}>{count}</span></Html>
    <Billboard position={[0, 21, 0]}><Html center zIndexRange={[10, 0]}><button className="city-tag" style={{ borderColor: '#B8975A99' }} onClick={onPick} data-testid="cart-building-tag"><b style={{ color: '#B8975A' }}>Cart</b><span data-testid="cart-building-count">Your cart · {count} item{count === 1 ? '' : 's'}{mode === 'guest' ? ' · guest' : ''}</span></button></Html></Billboard>
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
/* Founder thinking: real, non-simulated ledger events (decision memos, payouts, blocked proposals) surfaced over the beacon. Nothing is generated client-side. */
function useFounderThoughts() {
  const [items, setItems] = useState<{ k: string; t: string; at: string; shop?: string }[]>([]); const [i, setI] = useState(0);
  useEffect(() => { let on = true; const load = () => api('/ledger').then((d: any) => { if (!on) return; const ev = (d?.events || []).filter((e: any) => !e.sim && !e.test && ['decision', 'payout', 'rejected', 'refund', 'revenue'].includes(e.kind)).sort((a: any, b: any) => String(b.at).localeCompare(String(a.at))).slice(0, 8);
    setItems(ev.map((e: any) => ({ k: e.kind, at: e.at, shop: e.shop, t: e.kind === 'decision' ? String(e.detail || '').split('. ').slice(0, 2).join('. ') : e.kind === 'payout' ? `Paid ${e.agent || 'staff'} $${Number(e.amount || 0).toFixed(2)}${e.reason ? ` — “${String(e.reason).slice(0, 60)}”` : ''}` : e.kind === 'revenue' ? `Sale captured: $${Number(e.amount || 0).toFixed(2)} via PayPal checkout` : e.kind === 'refund' ? `Refunded $${Number(e.amount || 0).toFixed(2)} via PayPal` : `Blocked: ${(e.reasons || []).join('; ').slice(0, 110)}` })).filter((x: any) => x.t)); }).catch(() => {});
    load(); const a = setInterval(load, 30000); const b = setInterval(() => setI((n) => n + 1), 7000); return () => { on = false; clearInterval(a); clearInterval(b); }; }, []);
  return items.length ? items[i % items.length] : null;
}
function Beacon({ onPick, quiet }: { onPick: () => void; quiet?: boolean }) {
  const th = useFounderThoughts();
  const ring = useRef<THREE.Group>(null); const dot = useRef<THREE.Mesh>(null); const beam = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => { const t = clock.elapsedTime; if (ring.current) ring.current.rotation.y = t * 0.35; if (dot.current) dot.current.position.y = -1.2 + Math.abs(Math.sin(t * 1.6)) * 0.5; if (beam.current) beam.current.opacity = 0.09 + Math.sin(t * 2) * 0.03; });
  return <group onClick={(e) => { e.stopPropagation(); if (e.delta > 6) return; onPick(); }}>
    <mesh position={[0, 7, 0]}><cylinderGeometry args={[0.45, 1.0, 14, 8]} /><meshStandardMaterial color="#17172b" metalness={0.8} roughness={0.25} emissive={IRIS} emissiveIntensity={0.08} /></mesh>
    {[2, 5, 8, 11].map((y) => <mesh key={y} position={[0, y, 0]}><torusGeometry args={[1.02 - y * 0.045, 0.04, 6, 32]} /><meshBasicMaterial color={glow(CYAN, 1.5)} toneMapped={false} /></mesh>)}
    <group ref={ring} position={[0, 18, 0]}>
      <mesh><torusGeometry args={[3, 0.62, 24, 96]} /><meshStandardMaterial color="#ffffff" emissive="#D4B98A" emissiveIntensity={2.2} toneMapped={false} metalness={0.2} roughness={0.2} /></mesh>
      <mesh ref={dot} position={[1.15, -1.2, 0]}><sphereGeometry args={[0.6, 32, 32]} /><meshBasicMaterial color={glow(CYAN, 4)} toneMapped={false} /></mesh>
    </group>
    <pointLight position={[0, 18, 0]} color={IRIS} intensity={260} distance={60} decay={2} />
    <mesh position={[0, 40, 0]}><cylinderGeometry args={[0.4, 2.4, 44, 24, 1, true]} /><meshBasicMaterial ref={beam} color={IRIS} transparent opacity={0.1} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} /></mesh>
    <Sparkles count={60} scale={[10, 22, 10]} position={[0, 11, 0]} size={3} speed={0.4} color={CYAN} />
    {th && !quiet && <Billboard position={[0, 24.5, 0]}><Html center zIndexRange={[9, 0]} className="city-label"><div key={th.at + th.k} className={`city-bubble founder-thought ${th.k === 'rejected' ? 'city-bubble-red' : ''}`} data-testid="founder-thought" role="status" aria-live="polite"><b>Founder · {th.k === 'decision' ? 'decision memo' : th.k === 'rejected' ? 'blocked by code' : th.k}{th.shop ? ` · ${th.shop}` : ''}</b><span>{th.t}</span><span className="founder-thought-at">{new Date(th.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · real ledger row</span></div></Html></Billboard>}
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
  return <>{at.map(([x, z], i) => <group key={i} position={[x, 0, z]} onClick={(e) => { e.stopPropagation(); if (e.delta > 6) return; onPick(); }}>
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

/* Cinematic camera: low drone cruise along the streets when idle, smooth fly-to on click/deeplink, optional street level. */
export type View = 'drone' | 'street';
function Rig({ paused, b }: { paused: boolean; b: { kx0: number; kx1: number; kz0: number } }) {
  const ctl = useRef<any>(null); const { camera } = useThree(); const fly = useRef<{ pos: THREE.Vector3; look: THREE.Vector3; until: number } | null>(null); const idle = useRef(0);
  const [view, setView] = useState<View>('drone'); const u = useRef(0); const resume = useRef(true);
  useEffect(() => on('fly', (d: { pos: P; look: P; ms?: number }) => { fly.current = { pos: new THREE.Vector3(...d.pos), look: new THREE.Vector3(...d.look), until: performance.now() + (d.ms || 2200) }; idle.current = -2; resume.current = true; }), []);
  useEffect(() => on('view', (v: View) => { setView(v); idle.current = 9; resume.current = true; }), []);
  // cruise route: a loop along the street grid, keeping to the right-hand lane
  const route = useMemo<P[]>(() => { const x0 = b.kx0 * PITCH, x1 = (b.kx1 + 1) * PITCH, z0 = b.kz0 * PITCH, z1 = PITCH, l = 1.25;
    return [[x0 + l, 0, z1 - l], [x0 + l, 0, z0 + l], [0 - l, 0, z0 + l], [0 - l, 0, 0 - l], [x1 - l, 0, 0 - l], [x1 - l, 0, z1 - l], [x0 + l, 0, z1 - l]]; }, [b.kx0, b.kx1, b.kz0]);
  const L = useMemo(() => { let s = 0; for (let i = 1; i < route.length; i++) s += Math.hypot(route[i][0] - route[i - 1][0], route[i][2] - route[i - 1][2]); return s; }, [route]);
  const a = useMemo<P>(() => [0, 0, 0], []), c = useMemo<P>(() => [0, 0, 0], []); const want = useMemo(() => new THREE.Vector3(), []), look = useMemo(() => new THREE.Vector3(), []); const dir = useMemo(() => new THREE.Vector2(), []);
  const smooth = useRef(new THREE.Vector2(0, -1));
  useFrame((_, dt) => {
    const k0 = ctl.current; if (!k0) return; dt = Math.min(dt, 0.1);
    if (fly.current) { const k = 1 - Math.pow(0.0025, dt); camera.position.lerp(fly.current.pos, k); k0.target.lerp(fly.current.look, k); if (performance.now() > fly.current.until) fly.current = null; }
    idle.current += dt;
    if (!paused && !fly.current && idle.current > 3.5) {
      if (resume.current) { // join the route at the point nearest to where we're looking
        let best = 0, bd = 1e9; for (let i = 0; i < 200; i++) { samplePath(route, i / 200, a); const d = (a[0] - k0.target.x) ** 2 + (a[2] - k0.target.z) ** 2; if (d < bd) { bd = d; best = i / 200; } } u.current = best; resume.current = false; }
      const street = view === 'street'; u.current = (u.current + (dt * (street ? 2.2 : 3.4)) / L) % 1;
      samplePath(route, u.current, a); samplePath(route, (u.current + 6 / L) % 1, c); dir.set(c[0] - a[0], c[2] - a[2]).normalize(); smooth.current.lerp(dir, Math.min(1, dt * 0.9)).normalize(); const f = smooth.current;
      if (street) { // camera rides the lane centreline itself, so it can never meet a lamp, tree or facade
        samplePath(route, (u.current + 1 - 3 / L) % 1, c); want.set(c[0], 1.3, c[2]); look.set(a[0] + f.x * 9, 1.45, a[2] + f.y * 9); }
      else { want.set(a[0] - f.x * 22 - f.y * 7, 12.5, a[2] - f.y * 22 + f.x * 7); look.set(a[0] + f.x * 8, 2.5, a[2] + f.y * 8); }
      const k = 1 - Math.pow(street ? 0.02 : 0.12, dt); camera.position.lerp(want, k); if (street) clampToRoad(camera.position); k0.target.lerp(look, k);
    } else if (idle.current <= 3.5) resume.current = true;
    k0.autoRotate = false; k0.update(); if (view === 'street') clampToRoad(camera.position);
  });
  const street = view === 'street';
  return <OrbitControls ref={ctl} makeDefault enableDamping dampingFactor={0.08} minDistance={street ? 1.5 : 4} maxDistance={240} maxPolarAngle={street ? 1.56 : 1.45} target={[0, 3, 6]} onStart={() => { idle.current = -6; fly.current = null; }} />;
}

/* keep a street-level camera inside the asphalt band (|offset from nearest street line| < 1.9) */
function clampToRoad(v: THREE.Vector3) {
  if (v.y > 3) return; const rx = v.x - Math.round(v.x / PITCH) * PITCH, rz = v.z - Math.round(v.z / PITCH) * PITCH, lim = 1.9;
  if (Math.abs(rx) <= lim || Math.abs(rz) <= lim) return;
  if (Math.abs(rx) < Math.abs(rz)) v.x -= rx - Math.sign(rx) * lim; else v.z -= rz - Math.sign(rz) * lim;
}

/* Ink & Brass loading screen (textures, HDRI, people and car models stream in lazily). */
function Loading({ ready }: { ready: number }) {
  const { active, progress } = useProgress(); const [gone, setGone] = useState(false); const pct = Math.round(ready < 1 ? ready * 90 : 100);
  // progressive: the veil lifts as soon as streets + buildings can draw; people, cars and the HDRI stream in afterwards
  const done = ready >= 1; useEffect(() => { if (!done) { setGone(false); return; } const t = setTimeout(() => setGone(true), 700); return () => clearTimeout(t); }, [done]);
  if (gone) return null;
  return <div className={`city-loading ${done ? 'city-loading-out' : ''}`} data-testid="city-loading"><div className="city-loading-inner">
    <p className="city-loading-eyebrow">HollowCo City</p><p className="city-loading-title">Raising the streets</p>
    <div className="city-loading-bar"><span style={{ width: `${pct}%` }} /></div>
    <p className="city-loading-meta">{ready < 1 ? 'Laying asphalt & brick' : progress < 100 ? 'Bringing in the people and traffic' : 'Lights on'} · {pct}%</p>
  </div></div>;
}

export type SceneProps = { shops: CityShop[]; sites: Site[]; focus?: string | null; pulses: Record<string, number>; bankHot: number; paused: boolean; frozen?: boolean; hour: number; quality: Quality; hl: string | null;
  onShop: (s: CityShop) => void; onBank: () => void; onCart: () => void; onBeacon: () => void; onGuard: () => void; onDistrict: (d: string) => void; onDecline?: () => void };
export default function CityScene(p: SceneProps) {
  const [ready, setReady] = useState(0); useEffect(() => { preloadImages((d, n) => setReady(d / n)).then(() => setReady(1)); }, []);
  return <>{ready >= 1 && <World {...p} />}<Loading ready={ready} /></>;
}
function World(p: SceneProps) {
  const Q = QUALITY[p.quality];
  const b = useMemo(() => bounds(p.shops), [p.shops]);
  const ob = useMemo(() => ({ ...b, kx0: b.kx0 - 2, kx1: b.kx1 + 2, kz0: b.kz0 - 2 }), [b]);
  const fill = useMemo(() => fillerLots(b, ob, p.shops, (kx: number, kz: number) => isPark(kx, kz) || isCartLot(kx, kz)), [b, ob, p.shops]);
  const filled = useMemo(() => new Set(fill.map((f) => f.key)), [fill]);
  const peds = p.quality === 'low' ? 8 : p.quality === 'med' ? 20 : 36; const cars = p.quality === 'low' ? 12 : p.quality === 'med' ? 24 : 40;
  const [stage, setStage] = useState(0); // 0 = streets & buildings, 1 = + traffic & HDRI, 2 = + pedestrians
  useEffect(() => { const a = setTimeout(() => setStage(1), 700), c = setTimeout(() => setStage(2), 2200); return () => { clearTimeout(a); clearTimeout(c); }; }, []);
  const guards = useMemo<[number, number][]>(() => [[b.kx0 * PITCH - 4, b.kz0 * PITCH - 4], [(b.kx1 + 1) * PITCH + 4, b.kz0 * PITCH - 4], [b.kx0 * PITCH - 4, SHORE - 2], [(b.kx1 + 1) * PITCH + 4, SHORE - 2]], [b]);
  const night = 1 - THREE.MathUtils.smoothstep(Math.sin(((p.hour - 6) / 12) * Math.PI), -0.12, 0.3);
  return <Canvas frameloop={p.frozen ? 'never' : 'always'} shadows={Q.shadows > 0 ? 'soft' : false} dpr={[1, Q.dpr]} gl={{ antialias: !Q.bloom, powerPreference: 'high-performance' }} camera={{ position: [38, 20, 62], fov: 50, near: 0.3, far: 700 }}
    onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 0.95; }} data-testid="city-canvas">
    <Daylight hour={p.hour} q={p.quality} />
    <PerformanceMonitor flipflops={2} onDecline={p.onDecline} />
    {Q.env && stage >= 1 && <Suspense fallback={null}><Environment files={HDRI} background={false} environmentIntensity={0.18 + (1 - night) * 0.75} /></Suspense>}
    <Ground b={ob} shops={p.shops} /><Water b={ob} /><Lamps b={ob} /><Trees b={ob} shops={p.shops} density={Q.trees} filled={filled} />
    <FillerCity items={fill} /><StreetProps b={ob} />
    {stage >= 1 && <Suspense fallback={null}><Cars b={ob} count={cars} /></Suspense>}
    {stage >= 2 && <Suspense fallback={null}><Pedestrians b={b} count={peds} shops={p.shops} kinds={p.quality === 'high' ? 8 : p.quality === 'med' ? 5 : 3} /></Suspense>}
    <Beacon onPick={p.onBeacon} quiet={p.paused} /><Bank onPick={p.onBank} hot={p.bankHot} /><CartBuilding onPick={p.onCart} /><Guards onPick={p.onGuard} at={guards} /><Dock />
    <Buildings shops={p.shops} detail={Q.detail} focus={p.focus} pulses={p.pulses} onPick={p.onShop} quiet={p.paused} hl={p.hl} />
    {p.sites.map((s) => <ConstructionSite key={s.shopId} s={s} />)}
    <DistrictLabels shops={p.shops} hl={p.hl} onPick={p.onDistrict} />
    <Packets />
    <Rig paused={p.paused} b={b} />
    {Q.bloom && <EffectComposer multisampling={Q.ms} enableNormalPass={false}>
      {p.quality === 'high' ? <N8AO halfRes aoRadius={2.2} intensity={2.2} distanceFalloff={1} quality="performance" /> : <></>}
      <Bloom mipmapBlur intensity={0.2 + night * 0.45} luminanceThreshold={0.92 - night * 0.12} luminanceSmoothing={0.2} radius={0.7} />
      <HueSaturation saturation={-0.12} /><BrightnessContrast contrast={0.08} />
      <Vignette offset={0.28} darkness={0.6 + night * 0.2} /></EffectComposer>}
  </Canvas>;
}
