'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Ring } from '@/components/Logo';
import { Composer } from '@/components/Composer';
import { CompanyFloor } from '@/components/CompanyFloor';
import { useToast } from '@/components/Toast';
import { api, usd } from '@/lib/api';
const ago = (s: string) => { const m = Math.round((Date.now() - new Date(s).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
const KIND: Record<string, string> = { shop_created: 'Opened shop', revenue: 'Sale', supplier_cost: 'Supplier order', payout: 'Agent payout', rejected: 'Guardrail blocked', capture_failed: 'Capture failed' };
export default function Dashboard() {
  const [d, setD] = useState<any>(null); const [job, setJob] = useState<{ log: string[] } | null>(null);
  const toast = useToast(); const router = useRouter();
  const load = useCallback(() => api('/me/dashboard').then(setD).catch((e) => { if (e.status === 401) router.replace('/signin?next=/dashboard'); }), [router]);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  async function build(idea: string) {
    setJob({ log: ['Founder agent: reading your idea'] });
    try {
      const { id } = await api('/shops/jobs', { method: 'POST', body: JSON.stringify({ idea }) });
      for (;;) {
        await new Promise((r) => setTimeout(r, 1500));
        const j = await api(`/shops/jobs/${id}`); setJob({ log: j.log?.length ? j.log : ['Founder agent: reading your idea'] });
        if (j.status === 'done') { toast('Your new shop is open 🎉', 'ok'); setJob(null); await load(); router.push(`/shop/${j.shopId}`); return; }
        if (j.status === 'error') throw new Error(j.error || 'Build failed');
      }
    } catch (e: any) { toast(e.message, 'err'); setJob(null); }
  }
  const [sim, setSim] = useState(false);
  async function simulate() { setSim(true); try { const o = await api('/simulate/order', { method: 'POST', body: '{}' }); toast(`Simulated customer bought “${o.items[0].name}” — watch the floor`, 'ok'); await load(); } catch (e: any) { toast(e.message, 'err'); } finally { setSim(false); } }
  const t = d?.totals; const name = d?.user?.name;
  const status = job ? 'working' : 'idle';
  return <div className="mx-auto max-w-6xl px-5 py-10 space-y-8">
    <div className="flex flex-col md:flex-row md:items-end gap-2 justify-between">
      <div><p className="eyebrow">Dashboard</p><h1 className="font-display text-4xl md:text-5xl mt-1">{d ? <>Hi {name}, <span className="italic text-iris">let’s build.</span></> : <span className="skeleton inline-block h-8 w-48" />}</h1></div>
      <Link href="/marketplace" className="text-sm text-char/60 hover:text-char">See your products in the marketplace →</Link>
    </div>
    <section className="grid lg:grid-cols-[1fr_1.35fr] gap-5 items-stretch">
      <div className="glow-card p-6 flex flex-col gap-5" data-testid="founder">
        <div className="flex items-center gap-4"><Ring size={60} pulse /><div><p className="text-lg font-medium">Your AI founder</p>
          <p className="text-xs text-char/60 flex items-center gap-1.5 mt-0.5"><span className={`h-1.5 w-1.5 rounded-full ${status === 'working' ? 'bg-coral animate-pulse' : 'bg-emerald-400'}`} />{status === 'working' ? 'building a company…' : 'online · ready for instructions'}</p></div></div>
        <div className="grid grid-cols-3 gap-2.5 text-center">
          {[['Companies', d?.shops?.length], ['Orders', t?.orders], ['Profit', t && usd(t.profit)]].map(([k, v]) => <div key={k as string} className="rounded-xl bg-black/25 border border-white/[.06] p-3"><p className="text-lg font-semibold tabular-nums">{v ?? '–'}</p><p className="text-[11px] text-char/50">{k}</p></div>)}
        </div>
        <div><p className="text-[10px] uppercase tracking-[.16em] text-char/40 mb-2">Staff · 0 humans</p>
          <ul className="grid grid-cols-2 gap-2 text-xs">{[['✍', 'Writer', 'e-books', '#5CE1FF'], ['✦', 'Designer', 'logos & merch', '#FF7AD9'], ['⬡', 'Supplier', 'Printful drafts', '#FFB86B'], ['§', 'Accountant', 'guardrails', '#5EF0A6']].map(([i, n, r, c]) =>
            <li key={n} className="flex items-center gap-2 rounded-xl bg-black/20 border border-white/[.05] px-2.5 py-2"><span className="grid h-7 w-7 place-items-center rounded-full border" style={{ borderColor: c + '70', color: c }}>{i}</span><span><span className="font-medium">{n}</span><br /><span className="text-char/45">{r}</span></span></li>)}</ul></div>
        <p className="mt-auto text-xs text-char/50 leading-relaxed border-t border-white/[.06] pt-4">The founder can propose any payout — code only executes ones within $5/task, 30% of revenue and $50/day.</p>
      </div>
      <div className="card p-6 flex flex-col">
        <p className="font-medium">Instruct your founder</p><p className="text-sm text-char/55 mb-4">Describe a business — by voice or text. It’ll be live in about a minute.</p>
        <Composer onSubmit={build} busy={!!job} />
        {job && <ol className="mt-4 space-y-1.5 text-sm" data-testid="job-log">{job.log.map((l, i) => <li key={i} className={`flex gap-2 ${i === job.log.length - 1 ? 'text-char font-medium' : 'text-char/50'}`}><span>{i === job.log.length - 1 ? <span className="inline-block h-2 w-2 rounded-full bg-coral animate-pulse" /> : '✓'}</span>{l}</li>)}</ol>}
        {!job && <div className="mt-4 flex flex-wrap gap-2">{['Sleep guides for new parents', 'Retro synthwave merch for coders', 'Plant care e-books for apartments'].map((s) => <button key={s} onClick={() => build(s)} className="chip">{s}</button>)}</div>}
        {!job && <div className="mt-auto pt-6 grid grid-cols-3 gap-3 text-xs text-char/50">{[['01', 'Brand + logo'], ['02', 'E-books & merch'], ['03', 'PayPal shop live']].map(([n, l]) => <div key={n} className="rounded-xl border border-white/[.06] px-3 py-2.5"><span className="font-mono text-coral-600">{n}</span><p className="mt-1 text-char/70">{l}</p></div>)}</div>}
      </div>
    </section>
    <CompanyFloor events={d?.events} jobLog={job?.log} onSimulate={simulate} simBusy={sim} title="Company floor · your agents" />
    <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[['Revenue', t?.revenue], ['Supplier cost', t?.supplierCost], ['Agent payouts', t?.payouts], ['Profit', t?.profit]].map(([k, v]) => <div key={k as string} className="card p-5"><p className="text-xs text-char/55">{k}</p>{d ? <p className={`text-2xl font-semibold tabular-nums mt-1 ${k === 'Profit' && (v as number) < 0 ? 'text-red-400' : ''}`}>{usd(v as number)}</p> : <div className="skeleton h-7 w-24 mt-2" />}</div>)}
    </section>
    <section>
      <h2 className="font-medium mb-3">Your companies</h2>
      {!d ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28" />)}</div>
        : d.shops.length === 0 ? <div className="card p-10 text-center border-dashed"><Ring size={40} /><p className="mt-3 font-medium">No companies yet</p><p className="text-sm text-char/55">Give your founder an idea above to open your first shop.</p></div>
        : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="shops">{d.shops.map((s: any) => <Link key={s.id} href={`/shop/${s.id}`} className="card p-5 flex gap-4 items-center hover:shadow-lg transition">
          <img src={s.logo} alt="" className="h-14 w-14 rounded-xl object-cover bg-sand" style={{ outline: `3px solid ${s.colors?.[1]}33` }} />
          <div className="min-w-0"><p className="font-medium truncate">{s.name}</p><p className="text-xs text-char/55 truncate">{s.tagline}</p><p className="text-xs mt-1 text-char/45">{s.products} products · {usd(s.revenue)} sales</p></div></Link>)}</div>}
    </section>
    <section className="grid lg:grid-cols-2 gap-5">
      <div className="card p-5"><h2 className="font-medium mb-3">Sales</h2>
        {!d ? <div className="skeleton h-24" /> : d.orders.length === 0 ? <p className="text-sm text-char/50 py-6 text-center">No sales yet — share a product link from the marketplace.</p>
          : <table className="w-full text-sm"><thead><tr className="text-left text-xs text-char/45"><th className="pb-2 font-normal">Shop</th><th className="font-normal">When</th><th className="font-normal text-right">Revenue</th><th className="font-normal text-right">Profit</th></tr></thead>
            <tbody>{d.orders.slice(0, 8).map((o: any) => <tr key={o.orderId} className="border-t border-line"><td className="py-2">{o.shop}{o.sim ? <span className="ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 bg-cyan/10 text-cyan">simulated</span> : o.test && <span className="ml-1 text-[10px] text-char/40">test</span>}</td><td className="text-char/50">{ago(o.at)}</td><td className="text-right tabular-nums">{usd(o.revenue)}</td><td className={`text-right tabular-nums font-medium ${o.profit < 0 ? 'text-red-400' : 'text-emerald-400'}`}>{usd(o.profit)}</td></tr>)}</tbody></table>}
      </div>
      <div className="card p-5"><h2 className="font-medium mb-3">Agent payouts</h2>
        {!d ? <div className="skeleton h-24" /> : d.payouts.length === 0 ? <p className="text-sm text-char/50 py-6 text-center">Payouts appear here after your first sale.</p>
          : <ul className="space-y-2 text-sm">{d.payouts.slice(0, 8).map((p: any, i: number) => <li key={i} className="flex items-center gap-3 border-t border-line pt-2 first:border-0 first:pt-0">
            <span className={`h-2 w-2 rounded-full ${p.kind === 'payout' ? 'bg-emerald-500' : 'bg-red-500'}`} /><span className="flex-1">{p.kind === 'payout' ? `${p.agent} agent` : 'Blocked proposal'} <span className="text-char/45">· {p.shop}</span></span><span className="tabular-nums">{p.kind === 'payout' ? usd(p.amount) : '✋'}</span></li>)}</ul>}
      </div>
    </section>
    <section className="card p-5"><div className="flex items-center justify-between mb-3"><h2 className="font-semibold">Agent activity</h2><Link href="/ledger" className="text-xs text-char/55">Full public ledger →</Link></div>
      {!d ? <div className="skeleton h-32" /> : d.events.length === 0 ? <p className="text-sm text-char/50 py-6 text-center">Your agents haven’t done anything yet.</p>
        : <ul className="divide-y divide-line text-sm" data-testid="activity">{d.events.slice(0, 15).map((e: any, i: number) => <li key={i} className="py-2.5 flex gap-3 items-baseline">
          <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 shrink-0 ${e.kind === 'rejected' ? 'bg-red-400/10 text-red-300' : e.kind === 'revenue' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-white/[.06]'}`}>{KIND[e.kind] || e.kind}</span>
          <span className="flex-1 min-w-0 truncate text-char/70">{e.shop}{e.amount != null && ` · ${usd(e.amount)}`}{e.reasons ? ` — ${e.reasons.join('; ')}` : e.detail ? ` — ${e.detail}` : ''}</span><span className="text-xs text-char/40 shrink-0">{ago(e.at)}</span></li>)}</ul>}
    </section>
  </div>;
}
