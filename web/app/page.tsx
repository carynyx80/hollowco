'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
const STEPS = ['Founder agent is naming the company…', 'Picking brand colours…', 'Designer agent is drawing the logo…', 'Writer agent is writing e-books…', 'Designer agent is making merch…', 'Opening the shop…'];
export default function Home() {
  const [idea, setIdea] = useState('');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState('');
  const [shops, setShops] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const rec = useRef<any>(null);
  const router = useRouter();
  useEffect(() => { api('/shops').then(setShops).catch(() => {}); api('/health').then(setHealth).catch(() => {}); }, []);
  const SR = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  function talk() {
    if (!SR) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new SR(); r.lang = 'en-US'; r.interimResults = true; r.continuous = false;
    r.onresult = (e: any) => setIdea(Array.from(e.results).map((x: any) => x[0].transcript).join(' '));
    r.onend = () => setListening(false); r.onerror = () => setListening(false);
    rec.current = r; r.start(); setListening(true);
  }
  async function build() {
    setBusy(true); setErr(''); setStep(0);
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2500);
    try { const s = await api('/shops', { method: 'POST', body: JSON.stringify({ idea }) }); router.push(`/shop/${s.id}`); }
    catch (e: any) { setErr(e.message); setBusy(false); } finally { clearInterval(t); }
  }
  return (
    <div className="space-y-12">
      <section className="grid md:grid-cols-2 gap-10 items-center pt-6">
        <div>
          <img src="/logo.svg" alt="HollowCo" className="h-16 w-16 mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">A company with <span className="text-coral">nobody</span> in it.</h1>
          <p className="mt-4 text-lg text-char/70">Say a business idea. An AI founder hires AI staff, builds a brand and a shop, takes PayPal payments, fulfils orders and pays its agents — inside hard-coded guardrails, on a public ledger.</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-char/10 p-6">
          <label className="text-sm font-medium">Your idea</label>
          <textarea value={idea} onChange={(e) => setIdea(e.target.value)} rows={4} placeholder="e.g. Calm productivity for night-shift nurses" className="mt-2 w-full rounded-xl border border-char/20 p-3 focus:outline-coral" />
          <div className="mt-4 flex gap-3">
            <button onClick={talk} disabled={!SR || busy} title={SR ? '' : 'Voice not supported in this browser — type instead'} className={`rounded-full px-5 py-3 border border-char/20 ${listening ? 'bg-coral text-white' : ''} disabled:opacity-40`}>{listening ? '● Listening… tap to stop' : '🎙 Speak'}</button>
            <button onClick={build} disabled={busy || idea.trim().length < 3} className="flex-1 rounded-full px-5 py-3 bg-char text-cream font-medium disabled:opacity-40">{busy ? 'Building…' : 'Build my company'}</button>
          </div>
          {busy && <p className="mt-4 text-sm text-char/70 animate-pulse">{STEPS[step]}</p>}
          {err && <p className="mt-4 text-sm text-red-600">{err}</p>}
          {health && <p className="mt-4 text-xs text-char/50">AI: {health.ai}{health.ai === 'mock' ? ' (deterministic demo mode)' : ''} · Supplier: {health.supplier} · PayPal: {health.paypalEnv}</p>}
        </div>
      </section>
      {shops.length > 0 && <section>
        <h2 className="font-semibold mb-4">Companies with nobody in them</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {shops.slice(0, 12).map((s) => <Link key={s.id} href={`/shop/${s.id}`} className="rounded-xl p-4 border border-char/10 bg-white hover:shadow" style={{ borderTop: `4px solid ${s.colors?.[1]}` }}>
            <img src={s.logo} alt="" className="h-12 w-12 rounded" /><div className="mt-2 font-medium">{s.name}</div><div className="text-xs text-char/60">{s.tagline}</div></Link>)}
        </div></section>}
    </div>
  );
}
