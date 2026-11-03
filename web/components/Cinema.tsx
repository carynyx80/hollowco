'use client';
// Cinematic motion system: first-visit intro, sign-out outro, reveals, magnetic buttons, count-ups.
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useInView } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

/* ---- Intro / outro: ring draws, dot drops, page opens out of the ring ---- */
const EASE = [0.22, 1, 0.36, 1] as const;
export function playOutro(): Promise<void> { return new Promise((res) => window.dispatchEvent(new CustomEvent('hc:outro', { detail: res }))); }
export function Intro() {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<'full' | 'short' | 'open' | 'done' | 'outro'>('full');
  const timers = useRef<any[]>([]);
  const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  const at = (ms: number, f: () => void) => timers.current.push(setTimeout(f, ms));
  useEffect(() => {
    const seen = sessionStorage.getItem('hc_intro'); sessionStorage.setItem('hc_intro', '1');
    const m = reduce ? 'short' : seen ? 'short' : 'full'; setMode(m);
    const openAt = m === 'full' ? 1500 : reduce ? 150 : 380; at(openAt, () => setMode('open')); at(openAt + (reduce ? 250 : 750), () => setMode('done'));
    const skip = () => { if (timers.current.length) { clear(); setMode('open'); at(reduce ? 200 : 600, () => setMode('done')); } };
    window.addEventListener('keydown', skip, { once: true });
    const onOut = (e: any) => { clear(); setMode('outro'); at(reduce ? 200 : 900, () => { e.detail?.(); at(250, () => { setMode('open'); at(reduce ? 250 : 750, () => setMode('done')); }); }); };
    window.addEventListener('hc:outro', onOut);
    (window as any).__hcSkip = skip;
    return () => { clear(); window.removeEventListener('keydown', skip); window.removeEventListener('hc:outro', onOut); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (mode === 'done') return null;
  const full = mode === 'full'; const closing = mode === 'outro'; const opening = mode === 'open';
  // overlay: ink with a circular hole that grows (opening) or shrinks (outro)
  const holeTo = opening ? '110vmax' : '0vmax';
  return <motion.div aria-hidden data-testid="intro" onClick={() => (window as any).__hcSkip?.()} className="fixed inset-0 z-[100] grid place-items-center cursor-pointer"
    initial={{ ['--hole' as any]: closing ? '110vmax' : '0vmax', opacity: 1 }}
    style={{ background: '#F9F8F5', WebkitMaskImage: 'radial-gradient(circle at 50% 50%, transparent var(--hole), #000 calc(var(--hole) + 1px))', maskImage: 'radial-gradient(circle at 50% 50%, transparent var(--hole), #000 calc(var(--hole) + 1px))', ['--hole' as any]: closing ? '110vmax' : '0vmax' }}
    animate={{ ['--hole' as any]: holeTo, opacity: closing ? 1 : opening && reduce ? 0 : 1 }}
    transition={{ duration: reduce ? 0.25 : opening ? 0.75 : closing ? 0.7 : 0, ease: EASE }}>
    <motion.svg width="140" height="140" viewBox="0 0 512 512" initial={false} animate={{ scale: opening ? 6 : 1, opacity: opening ? 0 : 1 }} transition={{ duration: reduce ? 0.2 : 0.75, ease: EASE }}>
      <defs><linearGradient id="inR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" /><stop offset=".55" stopColor="#D4B98A" /><stop offset="1" stopColor="#B8975A" /></linearGradient>
        <linearGradient id="inD" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#A9B4A6" /><stop offset="1" stopColor="#B8975A" /></linearGradient>
        <filter id="inG" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="14" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      <motion.circle cx="256" cy="256" r="158" fill="none" stroke="url(#inR)" strokeWidth="64" strokeLinecap="round" transform="rotate(-90 256 256)"
        initial={{ pathLength: full ? 0 : 1 }} animate={{ pathLength: 1 }} transition={{ duration: full ? 0.9 : 0, ease: [0.65, 0, 0.35, 1] }} />
      <motion.circle cx="318" cy="306" r="24" fill="url(#inD)" filter="url(#inG)"
        initial={{ y: full ? -260 : 0, opacity: full ? 0 : 1 }} animate={{ y: 0, opacity: 1 }} transition={full ? { delay: 0.85, type: 'spring', stiffness: 520, damping: 13 } : { duration: 0 }} />
    </motion.svg>
    {full && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} transition={{ delay: 0.6 }} className="absolute bottom-8 text-[11px] tracking-[.2em] uppercase text-char">click or press any key to skip</motion.p>}
  </motion.div>;
}

/* ---- Scroll reveal ---- */
export function Reveal({ children, delay = 0, y = 24, className, as = 'div' }: { children: React.ReactNode; delay?: number; y?: number; className?: string; as?: 'div' | 'section' }) {
  const reduce = useReducedMotion(); const M = as === 'section' ? motion.section : motion.div;
  return <M className={className} initial={reduce ? { opacity: 0 } : { opacity: 0, y, filter: 'blur(6px)' }} whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: reduce ? 0.2 : 0.7, delay: reduce ? 0 : delay, ease: EASE }}>{children}</M>;
}
/* ---- Staggered assembly ---- */
export const stagger = (gap = 0.08, d0 = 0.05) => ({ hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: d0 } } });
export const rise = { hidden: { opacity: 0, y: 26, scale: 0.98 }, show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.6, ease: EASE } } };
export const riseReduced = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2 } } };
export function useRise() { return useReducedMotion() ? riseReduced : rise; }

/* ---- Magnetic button wrapper ---- */
export function Magnetic({ children, strength = 0.28, className }: { children: React.ReactNode; strength?: number; className?: string }) {
  const reduce = useReducedMotion(); const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 260, damping: 18, mass: 0.4 }); const y = useSpring(useMotionValue(0), { stiffness: 260, damping: 18, mass: 0.4 });
  if (reduce) return <span className={className}>{children}</span>;
  return <motion.span ref={ref} className={`inline-block ${className || ''}`} style={{ x, y }}
    onPointerMove={(e) => { if (e.pointerType !== 'mouse') return; const r = ref.current!.getBoundingClientRect(); x.set((e.clientX - r.left - r.width / 2) * strength); y.set((e.clientY - r.top - r.height / 2) * strength); }}
    onPointerLeave={() => { x.set(0); y.set(0); }} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}>{children}</motion.span>;
}

/* ---- Count-up number ---- */
export function CountUp({ value, format = (n: number) => String(Math.round(n)), className }: { value: number | undefined | null; format?: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion(); const ref = useRef<HTMLSpanElement>(null); const inView = useInView(ref, { once: true }); const last = useRef(0);
  useEffect(() => {
    if (value == null || !ref.current) return; const el = ref.current;
    if (reduce || !inView) { if (!inView) return; el.textContent = format(value); last.current = value; return; }
    const c = animate(last.current, value, { duration: last.current === 0 ? 1.1 : 0.6, ease: EASE, onUpdate: (v) => { el.textContent = format(v); } }); last.current = value; return () => c.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView, reduce]);
  return <span ref={ref} className={`tabular-nums ${className || ''}`}>{format(0)}</span>;
}

/* ---- Parallax depth ---- */
export function useParallax() {
  const reduce = useReducedMotion(); const mx = useSpring(0, { stiffness: 60, damping: 20 }); const my = useSpring(0, { stiffness: 60, damping: 20 });
  useEffect(() => { if (reduce) return; const f = (e: PointerEvent) => { mx.set(e.clientX / innerWidth - 0.5); my.set(e.clientY / innerHeight - 0.5); }; addEventListener('pointermove', f, { passive: true }); return () => removeEventListener('pointermove', f); }, [reduce, mx, my]);
  return { mx, my, reduce };
}
