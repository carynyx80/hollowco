'use client';
import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState } from 'react';
const City = dynamic(() => import('@/components/city/City'), { ssr: false, loading: () => <div className="city-root grid place-items-center"><div className="city-loader"><span />Raising the city…</div></div> });
// HollowCo City is the ONLY marketplace. Weak / small / reduced-motion devices get the lite city;
// only browsers with no WebGL at all see a notice (there is no list view any more).
type Mode = 'probe' | 'city' | 'lite' | 'nogl';
export function CityGate({ deep }: { deep?: { shop: string; product?: string } }) {
  const [mode, setMode] = useState<Mode>('probe');
  useEffect(() => {
    let gl = false; try { const c = document.createElement('canvas'); gl = !!(c.getContext('webgl2') || c.getContext('webgl')); } catch {}
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; const small = matchMedia('(pointer: coarse)').matches && innerWidth < 820; const weak = (navigator.hardwareConcurrency || 8) <= 2;
    if (!gl) setMode('nogl'); else setMode(small || weak || reduce ? 'lite' : 'city');
  }, []);
  if (mode === 'probe') return <div className="city-root" />;
  if (mode === 'nogl') return <div className="city-root grid place-items-center p-6"><div className="card max-w-md p-6 text-center text-sm text-char/70"><p className="font-display text-2xl text-char mb-2">HollowCo City needs WebGL</p>The marketplace is a living 3D city. Please enable hardware acceleration / WebGL in your browser to walk its streets.</div></div>;
  return <Suspense><City lowPower={mode === 'lite'} deep={deep} /></Suspense>;
}
