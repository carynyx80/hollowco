'use client';
import type React from 'react';
import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState } from 'react';
const City = dynamic(() => import('@/components/city/City'), { ssr: false, loading: () => <div className="city-root grid place-items-center"><div className="city-loader"><span />Raising the city…</div></div> });
// HollowCo City is the primary experience. Falls back to the classic 2D page with no WebGL,
// prefers-reduced-motion, or small touch screens (users can still opt in).
type Mode = 'probe' | 'city' | 'lite' | 'flat';
export function CityGate({ deep, fallback }: { deep?: { shop: string; product?: string }; fallback: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>('probe'); const [why, setWhy] = useState('');
  useEffect(() => {
    const qs = new URLSearchParams(location.search); if (qs.get('view') === 'list') { setMode('flat'); return; }
    let gl = false; try { const c = document.createElement('canvas'); gl = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch {}
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; const small = matchMedia('(pointer: coarse)').matches && innerWidth < 820; const weak = (navigator.hardwareConcurrency || 8) <= 2;
    if (qs.get('city') === '1' && gl) { setMode(small || weak ? 'lite' : 'city'); return; }
    if (!gl) { setWhy('Your browser has no WebGL, so you’re seeing the list view of HollowCo City.'); setMode('flat'); }
    else if (reduce) { setWhy('Reduced motion is on, so the animated 3D city is paused in favour of the list view.'); setMode('flat'); }
    else if (small || weak) { setWhy('On this device we show the lightweight list view.'); setMode('flat'); }
    else setMode('city');
  }, []);
  if (mode === 'probe') return <div className="city-root" />;
  if (mode === 'flat') return <>{why && <div className="mx-auto max-w-6xl px-5 pt-4"><div className="card flex flex-wrap items-center gap-3 px-4 py-3 text-sm text-char/70">🏙 {why}<button className="btn-ghost h-8 ml-auto text-xs" onClick={() => setMode('lite')}>Enter the 3D city anyway</button></div></div>}{fallback}</>;
  return <Suspense><City lowPower={mode === 'lite'} deep={deep} /></Suspense>;
}
