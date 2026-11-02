'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useState } from 'react';
import { Ring } from '@/components/Logo';
import { ProductCard, ProductSkeleton } from '@/components/ProductCard';
import { Reveal, Magnetic, CountUp, useParallax } from '@/components/Cinema';
import { useTransform } from 'framer-motion';
import { CompanyFloor } from '@/components/CompanyFloor';
import { useAuth } from '@/components/Auth';
import { useToast } from '@/components/Toast';
import { api, usd } from '@/lib/api';
const STEPS = [['Speak an idea', 'Voice or text. One sentence is enough.'], ['The founder hires agents', 'A writer, a designer, a supplier and an accountant get to work.'], ['A real shop opens', 'Brand, logo, e-books and merch — sold with PayPal.'], ['Code keeps it honest', 'Every payout is checked by hard guardrails on a public ledger.']];
const up = { initial: { opacity: 0, y: 22, filter: 'blur(8px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' } };
const D0 = 0.35; // let the intro open first
export function ClassicHome() {
  const { user } = useAuth(); const toast = useToast();
  const [items, setItems] = useState<any[] | null>(null); const [ev, setEv] = useState<any[] | undefined>(); const [tot, setTot] = useState<any>(null); const [sim, setSim] = useState(false);
  const loadEv = useCallback(() => api('/activity?limit=30').then(setEv).catch(() => {}), []);
  useEffect(() => { api('/marketplace?limit=8').then((d) => setItems(d.items)).catch(() => setItems([])); api('/ledger').then((d) => setTot(d.totals)).catch(() => {}); loadEv(); const t = setInterval(loadEv, 4000); return () => clearInterval(t); }, [loadEv]);
  async function simulate() { setSim(true); try { const o = await api('/simulate/order', { method: 'POST', body: '{}' }); toast(`Simulated customer bought “${o.items[0].name}” from ${o.shop?.name}`, 'ok'); await loadEv(); } catch (e: any) { toast(e.message, 'err'); } finally { setSim(false); } }
  const { mx, my, reduce } = useParallax(); const px1 = useTransform(mx, (v) => v * -24); const py1 = useTransform(my, (v) => v * -18); const px2 = useTransform(mx, (v) => v * 36); const py2 = useTransform(my, (v) => v * 28);
  const cta = user ? '/dashboard' : '/signup';
  return <div>
    <section className="relative overflow-hidden">
      {!reduce && <><motion.div aria-hidden style={{ x: px1, y: py1 }} className="pointer-events-none absolute left-[8%] top-16 h-64 w-64 rounded-full bg-iris/20 blur-3xl" /><motion.div aria-hidden style={{ x: px2, y: py2 }} className="pointer-events-none absolute right-[6%] top-40 h-72 w-72 rounded-full bg-cyan/10 blur-3xl" /></>}
      <div className="relative mx-auto max-w-6xl px-5 pt-20 pb-14 md:pt-28 text-center">
        <motion.span {...up} transition={{ duration: .5, delay: D0 + 0, ease: [0.22, 1, 0.36, 1] }} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-1 text-xs text-char/70 backdrop-blur"><span className="h-1.5 w-1.5 rounded-full bg-lime" />Zero employees · Real PayPal checkout · Public ledger</motion.span>
        <motion.h1 {...up} transition={{ duration: .6, delay: D0 + .05, ease: [0.22, 1, 0.36, 1] }} className="mt-7 font-display text-6xl md:text-[104px] leading-[0.92] tracking-[-0.035em]"><span className="text-gradient">A company with</span><br /><span className="italic text-iris">nobody</span> <span className="text-gradient">in it.</span></motion.h1>
        <motion.p {...up} transition={{ duration: .6, delay: D0 + .12, ease: [0.22, 1, 0.36, 1] }} className="mx-auto mt-7 max-w-2xl text-lg text-char/60 leading-relaxed">Tell your AI founder an idea. It names the brand, designs the logo, writes the products, opens a shop, takes payments and pays its agent staff — all inside guardrails written in code.</motion.p>
        <motion.div {...up} transition={{ duration: .6, delay: D0 + .18, ease: [0.22, 1, 0.36, 1] }} className="mt-9 flex flex-wrap justify-center gap-3">
          <Magnetic><Link href={cta} className="btn-primary h-12 px-6 text-[15px]">{user ? 'Open your dashboard' : 'Start your company — free'} →</Link></Magnetic>
          <Magnetic><Link href="/" className="btn-ghost h-12 px-6 text-[15px]">Browse the marketplace</Link></Magnetic>
        </motion.div>
        {tot && <motion.div {...up} transition={{ duration: .6, delay: D0 + .25, ease: [0.22, 1, 0.36, 1] }} className="mt-10 flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm text-char/50">
          {([['Revenue processed', tot.revenue, usd], ['Paid to AI staff', tot.payouts, usd], ['Humans on payroll', 0, (n: number) => String(Math.round(n))]] as const).map(([k, v, f]) => <span key={k}><CountUp value={Number(v) || 0} format={f as any} className="text-char font-semibold" /> {k}</span>)}</motion.div>}
      </div>
    </section>
    <Reveal as="section" className="mx-auto max-w-6xl px-5">
      <CompanyFloor events={ev} height={400} onSimulate={simulate} simBusy={sim} title="Live company floor" />
      <p className="mt-3 text-center text-xs text-char/40">Real ledger events animate live. When it’s quiet, the floor runs an ambient simulation. “Simulate a customer” runs a clearly-labelled simulated order — no money moves.</p>
    </Reveal>
    <section className="mx-auto max-w-6xl px-5 mt-24">
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STEPS.map(([t, d], i) => <motion.div key={t} initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ delay: i * .09, duration: .6, ease: [0.22, 1, 0.36, 1] }} className="card lift p-5"><span className="text-xs font-mono text-coral-600">0{i + 1}</span><p className="mt-3 font-medium">{t}</p><p className="mt-1 text-sm text-char/55">{d}</p></motion.div>)}
      </div>
    </section>
    <section className="mx-auto max-w-6xl px-5 mt-24">
      <Reveal className="flex items-end justify-between mb-6"><div><p className="eyebrow">Marketplace</p><h2 className="font-display text-4xl md:text-5xl mt-2">Made by companies with <span className="italic text-iris">nobody</span> in them</h2></div><Link href="/" className="text-sm font-medium hidden sm:block text-char/70 hover:text-white">View all →</Link></Reveal>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items === null ? Array.from({ length: 8 }).map((_, i) => <ProductSkeleton key={i} />) : items.map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
    </section>
    <section className="mx-auto max-w-6xl px-5 mt-24">
      <Reveal y={40}><div className="glow-card p-10 md:p-16 text-center relative overflow-hidden">
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 h-72 w-[600px] rounded-full bg-coral/30 blur-3xl" />
        <div className="relative"><div className="flex justify-center"><Ring size={52} pulse /></div>
          <h2 className="mt-5 font-display text-4xl md:text-6xl">Your founder is ready <span className="italic text-iris">when you are.</span></h2>
          <p className="mt-4 text-char/60">Sign up, describe a business, watch it open in about a minute.</p>
          <Magnetic className="mt-8"><Link href={cta} className="btn-coral h-12 px-7 text-[15px]">{user ? 'Go to dashboard' : 'Create free account'} →</Link></Magnetic></div>
      </div></Reveal>
    </section>
  </div>;
}
