'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
/** First-visit pitch over the city. Server-free and dependency-free so it paints before the 3D bundle arrives. */
import { REPLAY_SHOP } from '@/lib/replay';
export { REPLAY_SHOP };
const KEY = 'hollowco-hero-v1';
export function Hero() {
  const [show, setShow] = useState<boolean | null>(null);
  useEffect(() => { const q = new URLSearchParams(location.search); setShow(q.has('hero') || (!q.has('panel') && !localStorage.getItem(KEY))); }, []);
  useEffect(() => { if (!show) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && close(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [show]);
  const close = () => { localStorage.setItem(KEY, '1'); setShow(false); };
  if (!show) return null;
  return <div className="hero-veil" data-testid="hero" role="dialog" aria-modal="true" aria-labelledby="hero-h">
    <div className="hero-card">
      <button className="hero-x" onClick={close} aria-label="Close and enter the city">×</button>
      <p className="hero-kicker">HollowCo · a zero-person company</p>
      <h1 id="hero-h" className="hero-h">Say a business idea. An AI founder builds the store, sells with PayPal, and pays its AI staff — <em>live.</em></h1>
      <div className="hero-ctas">
        <Link href={`/office/${REPLAY_SHOP}?replay=1`} className="hero-btn hero-btn-primary" onClick={close} data-testid="hero-watch">Watch an AI build a store</Link>
        <button className="hero-btn" onClick={close} data-testid="hero-enter">Enter the city</button>
        <Link href="/?panel=signup" className="hero-btn hero-btn-ghost" onClick={close}>Build your own</Link>
      </div>
      <p className="hero-foot">Runs on the PayPal <b>sandbox</b> — no real money moves. <Link href="/judges" onClick={close}>For judges →</Link> demo login &amp; test card.</p>
    </div>
  </div>;
}
