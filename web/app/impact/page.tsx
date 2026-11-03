'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PnLBar } from '@/components/StorePnL';
import { REPLAY_SHOP } from '@/lib/replay';
const m = (n: any) => `$${Number(n || 0).toFixed(2)}`;
const when = (v: string) => new Date(v).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
export default function Impact() {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => { api('/economics').then(setD).catch((e) => setErr(e.message || 'Could not load')); }, []);
  const t = d?.totals;
  return <div className="mx-auto max-w-6xl px-5 py-12 space-y-16">
    <section className="grid md:grid-cols-[1.2fr_1fr] gap-10 items-end">
      <div><p className="eyebrow">Who it’s for</p>
        <h1 className="font-display text-5xl leading-[1.05] mt-2">A shop for people who can’t afford a team.</h1>
        <p className="mt-4 text-char/70 max-w-xl">Solo creators, tutors, illustrators and small sellers — especially in emerging markets — lose weeks and money on the work around selling: a storefront, product copy, design, checkout, fulfilment, bookkeeping. HollowCo’s AI founder does that work. You describe the business in a sentence (or say it out loud); a minute later it has a store, a catalogue, PayPal checkout, a supplier, and AI staff who are paid per task — with every cent on a public ledger.</p>
        <div className="mt-6 flex flex-wrap gap-2"><Link href="/?panel=signup" className="btn-primary h-10">Launch a store</Link><Link href={`/office/${REPLAY_SHOP}?replay=1`} className="btn h-10 hover:bg-black/[.04]">Watch one get built</Link></div></div>
      <ol className="card p-6 space-y-4 text-sm" aria-label="How it works">
        {[['1 · Say the idea', 'Text or voice. The founder plans products it can really make (e-books, tees, mugs); anything else is shown as “coming soon”, never faked.'], ['2 · Get paid via PayPal', 'One cart across stores, one PayPal order with a purchase unit per store. Cards or PayPal balance.'], ['3 · AI staff fulfil', 'Writer and designer agents deliver; Printful prints physical goods. Staff are paid by PayPal Payouts from margin, inside hard code-level caps.']].map(([h, b]) =>
          <li key={h}><p className="font-medium">{h}</p><p className="text-char/60 mt-0.5">{b}</p></li>)}
      </ol>
    </section>

    <section aria-labelledby="ue"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Unit economics · live</p><h2 id="ue" className="font-display text-3xl mt-1">What a sale actually leaves behind</h2></div>
      <p className="text-xs text-char/55 max-w-md">Computed from the ledger: real PayPal sandbox captures only. PayPal fees come from each capture’s seller_receivable_breakdown; simulated and test orders are excluded. Sandbox money, real arithmetic.</p></div>
      {err ? <p className="card p-5 mt-5 text-sm text-[#A6452F]" role="alert">Couldn’t load the ledger ({err}). <button className="underline" onClick={() => location.reload()}>Retry</button></p>
        : !t ? <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="card h-[78px] animate-pulse" />)}</div>
        : <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-5" data-testid="econ-totals">
          {[['Orders', String(t.orders)], ['Revenue', m(t.revenue)], ['PayPal fees', m(t.fees)], ['Supplier', m(t.supplierCost)], ['AI staff', m(t.payouts)], ['Profit', `${m(t.profit)} · ${t.margin}%`]].map(([k, v]) =>
            <div key={k} className="card p-4"><div className="text-[11px] uppercase tracking-[.14em] text-char/55">{k}</div><div className="font-mono text-lg mt-1 tabular-nums">{v}</div></div>)}</div>}
      {d && <div className="mt-6 grid md:grid-cols-2 gap-4" data-testid="econ-stores">
        {d.stores.length === 0 ? <p className="text-sm text-char/55">No real sales yet.</p> : d.stores.slice(0, 6).map((s: any) =>
          <article key={s.shopId || s.shop} className="card p-5"><div className="flex justify-between gap-3"><h3 className="font-medium truncate">{s.shop}</h3><span className="text-xs text-char/55 shrink-0">{s.orders} order{s.orders === 1 ? '' : 's'} · AOV {m(s.aov)} · <b className={s.margin >= 0 ? 'text-[#4F7A47]' : 'text-[#A6452F]'}>{s.margin}% margin</b></span></div>
            <div className="mt-3"><PnLBar s={s} /></div></article>)}</div>}
    </section>

    {d?.decisions?.length > 0 && <section aria-labelledby="dm"><p className="eyebrow">Founder decisions</p><h2 id="dm" className="font-display text-3xl mt-1">The founder shows its working</h2>
      <p className="text-sm text-char/60 mt-2 max-w-2xl">After every sale the founder writes a memo: margin after PayPal fees and supplier cost, the staff budget the guardrail allows, what it paid, and what the company keeps. Code enforces the caps; the memo is on the public ledger.</p>
      <ul className="mt-5 space-y-2">{d.decisions.map((x: any, i: number) => <li key={i} className="card p-4 text-sm"><div className="flex justify-between text-xs text-char/55"><span className="font-medium text-char">{x.shop}</span><span>{when(x.at)}</span></div><p className="mt-1 font-mono text-[12px] text-char/75">{x.detail}</p>
        {x.payouts?.length > 0 && <ul className="mt-2 text-xs text-char/65 space-y-0.5">{x.payouts.map((p: string, j: number) => <li key={j}>↳ paid {p}</li>)}</ul>}
        {x.blocked?.length > 0 && <p className="mt-1 text-xs text-[#A6452F]">Guardrail adjusted: {x.blocked.join(' · ').slice(0, 220)}</p>}
        {!x.live && <p className="mt-1 text-[10px] uppercase tracking-[.14em] text-char/40">Recomputed from this order’s ledger rows</p>}</li>)}</ul></section>}

    <section aria-labelledby="why" className="grid md:grid-cols-3 gap-4"><h2 id="why" className="sr-only">Why this can work in the real world</h2>
      {[['Works where PayPal works', 'PayPal checkout and Payouts operate across 200+ markets, so a seller in Lagos or Manila can take card payments from buyers abroad without building a payments stack.'], ['Digital first, no inventory', 'E-books and guides are written on demand and delivered instantly as PDF — zero stock, near-100% gross margin before fees. Print-on-demand covers physical goods with no upfront cost.'], ['Guardrails before autonomy', 'The AI only proposes. Prices, payout recipients, per-task and daily caps, and a 30%-of-margin staff budget are checked in code, and every blocked attempt is logged.']].map(([h, b]) =>
        <div key={h} className="card p-5"><h3 className="font-medium">{h}</h3><p className="text-sm text-char/60 mt-1">{b}</p></div>)}
    </section>
    <p className="text-xs text-char/55">Honest limits: this is a PayPal sandbox deployment — no real money moves; Printful orders are drafts. <Link href="/ledger" className="underline">Full ledger</Link> · <Link href="/judges" className="underline">For judges</Link></p>
  </div>;
}
