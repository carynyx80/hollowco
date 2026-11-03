'use client';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CountUp, stagger, useRise } from '@/components/Cinema';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Ring } from '@/components/Logo';
import { Composer } from '@/components/Composer';
import { HollowOffice } from '@/components/HollowOffice';
import { useToast } from '@/components/Toast';
import { api, usd } from '@/lib/api';
import { useAuth } from '@/components/Auth';
const ago = (s: string) => { const m = Math.round((Date.now() - new Date(s).getTime()) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
const KIND: Record<string, string> = { shop_created: 'Opened shop', revenue: 'Sale', supplier_cost: 'Supplier order', payout: 'Agent payout', rejected: 'Guardrail blocked', capture_failed: 'Capture failed', payout_reversed: 'Payout reversed' };
const cityEmit = (type: string, detail: any) => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(type, { detail })); };
export function DashboardView({ embedded = false }: { embedded?: boolean }) {
  const [built, setBuiltS] = useState<{ shopId: string; notices: string[] } | null>(() => { try { return JSON.parse(sessionStorage.getItem('hc:built') || 'null'); } catch { return null; } });
  const setBuilt = (v: any) => { setBuiltS(v); try { v ? sessionStorage.setItem('hc:built', JSON.stringify(v)) : sessionStorage.removeItem('hc:built'); } catch {} }; const [d, setD] = useState<any>(null); const [job, setJob] = useState<{ log: string[] } | null>(null);
  const riseV = useRise();
  const toast = useToast(); const router = useRouter();
  const load = useCallback(() => api('/me/dashboard').then(setD).catch((e) => { if (e.status === 401) { if (embedded) cityEmit('city:need-auth', {}); else router.replace('/signin?next=/dashboard'); } }), [router]);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  async function build(idea: string) {
    setBuilt(null); setJob({ log: ['Founder agent: reading your idea'] }); cityEmit('city:build', { active: true, log: 'Founder agent: reading your idea', idea });
    try {
      const { id } = await api('/shops/jobs', { method: 'POST', body: JSON.stringify({ idea }) });
      for (;;) {
        await new Promise((r) => setTimeout(r, 1500));
        const j = await api(`/shops/jobs/${id}`); setJob({ log: j.log?.length ? j.log : ['Founder agent: reading your idea'] }); cityEmit('city:build', { active: true, log: j.log?.[j.log.length - 1] || 'Founder agent: reading your idea' });
        if (j.status === 'done') { toast('Your new shop is open', 'ok'); for (const n of j.notices || []) toast(n, 'err'); setJob(null); setBuilt({ shopId: j.shopId, notices: j.notices || [] }); cityEmit('city:build', { active: false, shopId: j.shopId, stay: true }); await load(); return; }
        if (j.status === 'error') throw new Error(j.error || 'Build failed');
      }
    } catch (e: any) { toast(e.message, 'err'); setJob(null); cityEmit('city:build', { active: false }); }
  }
  const [sim, setSim] = useState(false);
  const [quota, setQuota] = useState<any>(null);
  useEffect(() => { api('/limits').then((l) => setQuota(l.mine)).catch(() => {}); }, [d]);
  const [jail, setJail] = useState<any[]>([]);
  const loadJail = useCallback(() => api('/activity?limit=40').then((a: any[]) => setJail(a.filter((e) => e.kind === 'rejected' && !e.orderId))).catch(() => {}), []);
  useEffect(() => { loadJail(); const t = setInterval(loadJail, 5000); return () => clearInterval(t); }, [loadJail]);
  const officeEvents = d?.events ? [...d.events, ...jail] : undefined;
  async function jailbreak(message: string) { try { await api('/jailbreak', { method: 'POST', body: JSON.stringify({ message }) }); await loadJail(); } catch (e: any) { toast(e.message, 'err'); } }
  async function simulate() { setSim(true); try { const o = await api('/simulate/order', { method: 'POST', body: '{}' }); toast(`Simulated customer bought “${o.items[0].name}” — watch the office`, 'ok'); await load(); } catch (e: any) { toast(e.message, 'err'); } finally { setSim(false); } }
  const t = d?.totals; const name = d?.user?.name;
  const status = job ? 'working' : 'idle';
  return <motion.div className={embedded ? 'px-5 py-6 space-y-6' : 'mx-auto max-w-7xl px-5 py-10 space-y-8'} variants={stagger(0.09, 0.1)} initial="hidden" animate="show" data-testid="dash">
    <motion.div variants={riseV} className="flex flex-col md:flex-row md:items-end gap-2 justify-between">
      <div><p className="eyebrow">Founder HQ · above HollowCo City</p><h1 className="font-display text-4xl md:text-5xl mt-1">{d ? <>Hi {name}, <span className="italic text-coral-600">let’s build.</span></> : <span className="skeleton inline-block h-8 w-48" />}</h1>{d && <ProfileName initial={name || ''} />}</div>
      <Link href="/" className="text-sm text-char/60 hover:text-char">Fly to your buildings in the city →</Link>
    </motion.div>
    <motion.div variants={riseV}><HollowOffice events={officeEvents} shopId={d?.shops?.[0]?.id} totals={t} jobLog={job?.log} pending={sim} onSimulate={simulate} simBusy={sim} onJailbreak={jailbreak} title="The Hollow Office" scope="your HQ · live" /></motion.div>
    <motion.p variants={riseV} className="text-xs text-char/45 -mt-5">Public view for sharing: <Link className="underline" href={d?.shops?.[0]?.id ? `/office/${d.shops[0].id}` : '/office'}>{d?.shops?.[0]?.id ? `/office/${d.shops[0].id}` : '/office'}</Link></motion.p>
    <motion.section variants={riseV} className="grid lg:grid-cols-[1fr_1.35fr] gap-5 items-stretch">
      <div className="card p-6 flex flex-col gap-5" data-testid="founder">
        <div className="flex items-center gap-4"><Ring size={60} pulse /><div><p className="text-lg font-medium">Your AI founder</p>
          <p className="text-xs text-char/60 flex items-center gap-1.5 mt-0.5"><span className={`h-1.5 w-1.5 rounded-full ${status === 'working' ? 'bg-coral animate-pulse' : 'bg-lime'}`} />{status === 'working' ? 'building a company…' : 'online · ready for instructions'}</p></div></div>
        <div className="grid grid-cols-3 gap-2.5 text-center">
          {[['Companies', d?.shops?.length], ['Orders', t?.orders], ['Profit', t && usd(t.profit)]].map(([k, v]) => <div key={k as string} className="rounded-xl bg-black/25 border border-white/[.06] p-3"><p className="text-lg font-semibold tabular-nums">{v ?? '–'}</p><p className="text-[11px] text-char/50">{k}</p></div>)}
        </div>
        <div><p className="text-[10px] uppercase tracking-[.16em] text-char/40 mb-2">Staff · 0 humans</p>
          <ul className="grid grid-cols-2 gap-2 text-xs">{[['W', 'Writer', 'e-books', '#A9B4A6'], ['D', 'Designer', 'logos & merch', '#B98A7A'], ['⬡', 'Supplier', 'Printful drafts', '#D2A066'], ['§', 'Accountant', 'guardrails', '#8FAE84']].map(([i, n, r, c]) =>
            <li key={n} className="flex items-center gap-2 rounded-xl bg-black/20 border border-white/[.05] px-2.5 py-2"><span className="grid h-7 w-7 place-items-center rounded-full border" style={{ borderColor: c + '70', color: c }}>{i}</span><span><span className="font-medium">{n}</span><br /><span className="text-char/45">{r}</span></span></li>)}</ul></div>
        <p className="mt-auto text-xs text-char/50 leading-relaxed border-t border-white/[.06] pt-4">The founder can propose any payout — code only executes ones within $5/task, 30% of revenue and $50/day.</p>
      </div>
      <div className="card p-6 flex flex-col">
        <p className="font-medium">Instruct your founder</p><p className="text-sm text-char/55 mb-4">Describe a business — by voice or text. It’ll be live in about a minute.</p>
        {built && <div className="mb-4 rounded-xl border border-lime/40 bg-lime/10 p-4" data-testid="build-success"><p className="font-medium">✓ Your shop is built and open.</p>{built.notices.map((n, i) => <p key={i} className="mt-1 text-xs text-char/65">{n}</p>)}<a href={`/s/${built.shopId}`} className="btn-primary mt-3 inline-flex" data-testid="visit-building">Visit your building</a></div>}
        <label htmlFor="build-prompt" className="block text-sm font-medium mb-1.5">Describe your store</label>
        <Composer onSubmit={build} busy={!!job} />
        {job && <ol className="mt-4 space-y-1.5 text-sm" data-testid="job-log">{job.log.map((l, i) => <li key={i} className={`flex gap-2 ${i === job.log.length - 1 ? 'text-char font-medium' : 'text-char/50'}`}><span>{i === job.log.length - 1 ? <span className="inline-block h-2 w-2 rounded-full bg-coral animate-pulse" /> : '✓'}</span>{l}</li>)}</ol>}
        {quota && <p data-testid="shop-quota" className="mt-3 text-xs opacity-70">{quota.blocked ? quota.blocked : `${quota.used} of ${quota.limit} shops built in the last 24 hours`}</p>}
        {!job && <div className="mt-4 flex flex-wrap gap-2">{['Sleep guides for new parents', 'Retro synthwave merch for coders', 'Plant care e-books for apartments'].map((s) => <button key={s} onClick={() => build(s)} className="chip">{s}</button>)}</div>}
        {!job && <div className="mt-auto pt-6 grid grid-cols-3 gap-3 text-xs text-char/50">{[['01', 'Brand + logo'], ['02', 'E-books & merch'], ['03', 'PayPal shop live']].map(([n, l]) => <div key={n} className="rounded-xl border border-white/[.06] px-3 py-2.5"><span className="font-mono text-coral-600">{n}</span><p className="mt-1 text-char/70">{l}</p></div>)}</div>}
      </div>
    </motion.section>
    
    <motion.section variants={riseV} className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[['Revenue', t?.revenue], ['Supplier cost', t?.supplierCost], ['Agent payouts', t?.payouts], ['Profit', t?.profit]].map(([k, v]) => <div key={k as string} className="card lift p-5" data-testid="stat"><p className="text-xs text-char/55">{k}</p>{d ? <p className={`text-2xl font-semibold mt-1 ${k === 'Profit' && (v as number) < 0 ? 'text-red-400' : ''}`}><CountUp value={(v as number) || 0} format={(n) => usd(n)} /></p> : <div className="skeleton h-7 w-24 mt-2" />}</div>)}
    </motion.section>
    <motion.section variants={riseV}>
      <h2 className="font-medium mb-3">Your companies</h2>
      {!d ? <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-28" />)}</div>
        : d.shops.length === 0 ? <div className="card p-10 text-center border-dashed"><Ring size={40} /><p className="mt-3 font-medium">No companies yet</p><p className="text-sm text-char/55">Give your founder an idea above to open your first shop.</p></div>
        : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="shops">{d.shops.map((s: any) => <Link key={s.id} href={`/s/${s.id}`} className="card lift p-5 flex gap-4 items-center">
          <img src={s.logo} alt="" className="h-14 w-14 rounded-xl object-cover bg-sand" style={{ outline: `3px solid ${s.colors?.[1]}33` }} />
          <div className="min-w-0"><p className="font-medium truncate">{s.name}</p><p className="text-xs text-char/55 truncate">{s.tagline}</p><p className="text-xs mt-1 text-char/45">{s.products} products · {usd(s.revenue)} sales</p></div></Link>)}</div>}
    </motion.section>
    <motion.section variants={riseV} className="grid lg:grid-cols-2 gap-5">
      <div className="card p-5"><h2 className="font-medium mb-3">Sales</h2>
        {!d ? <div className="skeleton h-24" /> : d.orders.length === 0 ? <p className="text-sm text-char/50 py-6 text-center">No sales yet — share a product link from the marketplace.</p>
          : <table className="w-full text-sm"><thead><tr className="text-left text-xs text-char/45"><th className="pb-2 font-normal">Shop</th><th className="font-normal">When</th><th className="font-normal text-right">Revenue</th><th className="font-normal text-right">Profit</th></tr></thead>
            <tbody>{d.orders.slice(0, 8).map((o: any) => <tr key={o.orderId} className="border-t border-line"><td className="py-2">{o.shop}{o.sim ? <span className="ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 bg-cyan/10 text-cyan">simulated</span> : o.test && <span className="ml-1 text-[10px] text-char/40">test</span>}</td><td className="text-char/50">{ago(o.at)}</td><td className="text-right tabular-nums">{usd(o.revenue)}</td><td className={`text-right tabular-nums font-medium ${o.profit < 0 ? 'text-red-400' : 'text-lime'}`}>{usd(o.profit)}</td></tr>)}</tbody></table>}
      </div>
      <div className="card p-5"><h2 className="font-medium mb-3">Agent payouts</h2>
        {!d ? <div className="skeleton h-24" /> : d.payouts.length === 0 ? <p className="text-sm text-char/50 py-6 text-center">Payouts appear here after your first sale.</p>
          : <ul className="space-y-2 text-sm">{d.payouts.slice(0, 8).map((p: any, i: number) => <li key={i} className="flex items-center gap-3 border-t border-line pt-2 first:border-0 first:pt-0">
            <span className={`h-2 w-2 rounded-full ${p.kind === 'payout' ? 'bg-lime' : 'bg-red-500'}`} /><span className="flex-1">{p.kind === 'payout' ? `${p.agent} agent` : 'Blocked proposal'} <span className="text-char/45">· {p.shop}</span></span><span className="tabular-nums">{p.kind === 'payout' ? usd(p.amount) : ''}</span></li>)}</ul>}
      </div>
    </motion.section>
    <motion.section variants={riseV} className="card p-5"><div className="flex items-center justify-between mb-3"><h2 className="font-semibold">Agent activity</h2><Link href="/ledger" className="text-xs text-char/55">Full public ledger →</Link></div>
      {!d ? <div className="skeleton h-32" /> : d.events.length === 0 ? <p className="text-sm text-char/50 py-6 text-center">Your agents haven’t done anything yet.</p>
        : <ul className="divide-y divide-line text-sm" data-testid="activity">{d.events.slice(0, 15).map((e: any, i: number) => <li key={i} className="py-2.5 flex gap-3 items-baseline">
          <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 shrink-0 ${e.kind === 'rejected' ? 'bg-red-400/10 text-red-300' : e.kind === 'revenue' ? 'bg-lime/10 text-lime' : 'bg-white/[.06]'}`}>{KIND[e.kind] || e.kind}</span>
          <span className="flex-1 min-w-0 truncate text-char/70">{e.shop}{e.amount != null && ` · ${usd(e.amount)}`}{e.reasons ? ` — ${e.reasons.join('; ')}` : e.detail ? ` — ${e.detail}` : ''}</span><span className="text-xs text-char/40 shrink-0">{ago(e.at)}</span></li>)}</ul>}
    </motion.section>
  </motion.div>;
}

function ProfileName({ initial }: { initial: string }) {
  const { setUser } = useAuth(); const [v, setV] = useState(initial); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); setMsg(''); try { const r = await api('/me/profile', { method: 'PATCH', body: JSON.stringify({ name: v }) }); setUser(r.user); setMsg('Saved — your buildings now read “by ' + r.user.name + '”.'); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); } };
  return <form onSubmit={(e) => { e.preventDefault(); save(); }} className="mt-3 flex flex-wrap items-center gap-2 text-sm" data-testid="profile-name">
    <label htmlFor="dn" className="text-char/60">Display name on your buildings</label>
    <input id="dn" className="input h-9 w-56" value={v} maxLength={40} onChange={(e) => setV(e.target.value)} />
    <button className="btn-ghost h-9" disabled={busy || v.trim() === initial}>{busy ? 'Saving…' : 'Save'}</button>{msg && <span className="text-char/60">{msg}</span>}</form>;
}
