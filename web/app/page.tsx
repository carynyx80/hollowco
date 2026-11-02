'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Ring } from '@/components/Logo';
import { ProductCard, ProductSkeleton } from '@/components/ProductCard';
import { useAuth } from '@/components/Auth';
import { api } from '@/lib/api';
const STEPS = [['Speak an idea', 'Voice or text. One sentence is enough.'], ['The founder hires agents', 'A writer, a designer and a fulfilment agent get to work.'], ['A real shop opens', 'Brand, logo, e-books and merch — sold with PayPal.'], ['Code keeps it honest', 'Every payout is checked by hard guardrails on a public ledger.']];
export default function Home() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[] | null>(null);
  useEffect(() => { api('/marketplace?limit=8').then((d) => setItems(d.items)).catch(() => setItems([])); }, []);
  const cta = user ? '/dashboard' : '/signup';
  return <div>
    <section className="relative overflow-hidden">
      <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-coral/15 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-5 pt-16 pb-20 md:pt-24 grid md:grid-cols-[1.2fr_1fr] gap-12 items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs"><span className="h-1.5 w-1.5 rounded-full bg-coral" />Zero employees. Real PayPal checkout.</span>
          <h1 className="mt-6 text-5xl md:text-7xl font-semibold tracking-[-0.04em] leading-[0.95]">A company with <span className="text-coral-600">nobody</span> in it.</h1>
          <p className="mt-6 max-w-xl text-lg text-char/65 leading-relaxed">Tell your AI founder an idea. It names the brand, designs the logo, writes the products, opens a shop, takes payments and pays its agent staff — all inside guardrails written in code.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={cta} className="btn-primary h-12 px-6 text-[15px]">{user ? 'Open your dashboard' : 'Start your company — free'}</Link>
            <Link href="/marketplace" className="btn-ghost h-12 px-6 text-[15px]">Browse the marketplace</Link>
          </div>
        </div>
        <div className="card p-8 bg-char text-cream border-char relative overflow-hidden">
          <div className="flex items-center gap-4"><Ring size={56} pulse dark /><div><p className="font-medium">Your AI founder</p><p className="text-xs text-cream/55 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />online · waiting for an idea</p></div></div>
          <div className="mt-6 space-y-2.5 text-sm font-mono">
            {['Founder: drafting brand “Night Owl Notes”', 'Writer: finished “The 3am Reset”', 'Designer: mug done', 'Guardrail: $5000 payout → REJECTED'].map((l, i) => <p key={i} className={`flex gap-2 ${i === 3 ? 'text-coral' : 'text-cream/75'}`}><span className="text-cream/30">{String(i + 1).padStart(2, '0')}</span>{l}</p>)}
          </div>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-6xl px-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STEPS.map(([t, d], i) => <div key={t} className="card p-5"><span className="text-xs font-mono text-coral-600">0{i + 1}</span><p className="mt-3 font-medium">{t}</p><p className="mt-1 text-sm text-char/55">{d}</p></div>)}
      </div>
    </section>
    <section className="mx-auto max-w-6xl px-5 mt-20">
      <div className="flex items-end justify-between mb-6"><div><p className="eyebrow">Marketplace</p><h2 className="text-3xl font-semibold tracking-tight mt-1">Made by companies with nobody in them</h2></div><Link href="/marketplace" className="text-sm font-medium hidden sm:block">View all →</Link></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items === null ? Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />) : items.map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
    </section>
    <section className="mx-auto max-w-6xl px-5 mt-20">
      <div className="card p-10 md:p-14 text-center bg-sand border-0">
        <Ring size={48} pulse />
        <h2 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">Your founder is ready when you are.</h2>
        <p className="mt-3 text-char/60">Sign up, describe a business, watch it open in about a minute.</p>
        <Link href={cta} className="btn-coral h-12 px-7 mt-6 text-[15px]">{user ? 'Go to dashboard' : 'Create free account'}</Link>
      </div>
    </section>
  </div>;
}
