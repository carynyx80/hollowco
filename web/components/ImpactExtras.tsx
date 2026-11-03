'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
const m = (n: any) => `$${Number(n || 0).toFixed(2)}`;
const pc = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : '—');
const when = (v: string) => new Date(v).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/* Everything here is derived from /ledger rows (real sandbox captures only). No illustrative or invented figures. */
export function ImpactExtras() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api('/ledger').then(setD).catch(() => {}); }, []);
  if (!d) return <div className="card h-[420px] animate-pulse" aria-hidden />;
  const orders = (d.orders || []).filter((o: any) => !o.test && !o.sim && o.revenue > 0);
  const ev = (d.events || []).filter((e: any) => !e.sim && !e.test);
  const t = d.totals || {};
  const last = [...orders].sort((a: any, b: any) => String(b.at).localeCompare(String(a.at)))[0];
  const of = (k: string) => ev.filter((e: any) => e.orderId === last?.orderId && e.kind === k);
  const cap = of('revenue')[0]; const memo = of('decision')[0]; const pays = of('payout'); const blocked = of('rejected'); const refund = of('refund')[0];
  const shopEv = ev.find((e: any) => e.kind === 'shop_created' && e.shopId === last?.shopId);
  const steps: [string, string, string?][] = last ? [
    ['Describe the business', shopEv ? `“${last.shop || cap?.shop}” was created ${when(shopEv.at)} from a one-line description; the founder planned only product types it can really make.` : `The seller describes the business in a sentence; the founder plans only product types it can really make.`],
    ['A buyer pays with PayPal', `${m(last.revenue)} captured ${when(last.at)}${cap?.detail ? ` — ${cap.detail}` : ''}. PayPal’s own fee breakdown reported ${m(last.fees)}.`, cap?.detail?.match(/[A-Z0-9]{17}/)?.[0]],
    ['The founder writes a memo', memo?.detail ? String(memo.detail).replace(/ Paid .*$/, '') : `Revenue ${m(last.revenue)} − fee ${m(last.fees)} − supplier ${m(last.supplierCost)} is the margin; staff budget is capped at 30% of it.`],
    ['Code enforces the caps', blocked.length ? `${blocked.length} proposal${blocked.length > 1 ? 's were' : ' was'} blocked or clamped: ${(blocked[0].reasons || []).join('; ')}.` : 'Every proposed payout passed the per-task, 30%-of-margin and daily caps.'],
    ['Staff are paid by PayPal Payouts', pays.length ? pays.map((p: any) => `${p.agent} ${m(p.amount)} (batch ${p.batchId || '—'}, ${p.status || 'sent'})`).join(' · ') : 'No staff payout was needed on this order.'],
    ['If something goes wrong, refund', refund ? `${m(refund.amount)} refunded from the dashboard; PayPal’s PAYMENT.CAPTURE.REFUNDED webhook re-synced the order.` : 'The seller can refund from the dashboard; the PayPal webhook re-syncs the order.'],
  ] : [];
  const dig = orders.filter((o: any) => !o.supplierCost); const phy = orders.filter((o: any) => o.supplierCost > 0);
  const sum = (a: any[], k: string) => a.reduce((s, o) => s + Number(o[k] || 0), 0);
  const row = (name: string, a: any[]) => { const r = sum(a, 'revenue'), f = sum(a, 'fees'), s = sum(a, 'supplierCost'), p = sum(a, 'payouts'); return { name, n: a.length, r, f, s, p, keep: r - f - s - p }; };
  const rows = [row('Digital (e-books, guides)', dig), row('Print-on-demand (tees, mugs)', phy)];
  const rev = Number(t.revenue || 0);
  const split: [string, number, string][] = [['PayPal fees', t.fees, '#8C6F3C'], ['Supplier (Printful)', t.supplierCost, '#6B675E'], ['AI staff payouts', t.payouts, '#A9B4A6'], ['Refunds', t.refunds, '#A6452F'], ['Kept by the business', t.profit, '#0E0D0B']];
  return <>
    <section aria-labelledby="walk" className="grid lg:grid-cols-[1fr_1.4fr] gap-8">
      <div><p className="eyebrow">How a real seller would use this</p><h2 id="walk" className="font-display text-3xl mt-1">The latest real sandbox order, step by step</h2>
        <p className="text-sm text-char/60 mt-3 leading-relaxed">Not a mock-up: each step is read from the ledger rows of the most recent real PayPal sandbox order{last ? ` (${last.orderId})` : ''}. A seller would do steps 1 and 6; HollowCo does the rest.</p>
        <Link href="/ledger" className="mt-4 inline-block text-sm underline">Check these rows in the ledger</Link></div>
      <ol className="space-y-3" data-testid="walkthrough">{steps.map(([h, b, id], i) => <li key={h} className="card p-4 flex gap-4"><span className="font-mono text-xs text-[#8C6F3C] pt-0.5 w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span><div className="min-w-0"><p className="font-medium text-sm">{h}{(i === 0 || i === 5) && <span className="ml-2 font-mono text-[11px] text-char/60">seller</span>}</p><p className="text-sm text-char/70 mt-0.5 break-words">{b}</p>{id && <p className="sr-only">Capture id {id}</p>}</div></li>)}</ol>
    </section>
    <section aria-labelledby="fees" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">Fees &amp; sustainability</p><h2 id="fees" className="font-display text-3xl mt-1">Where each dollar of sales went</h2></div>
        <p className="text-xs text-char/60 max-w-md">{t.orders} real sandbox orders, {m(rev)} revenue. Percentages are of revenue, computed live from the ledger.</p></div>
      <div className="card p-5">
        <div className="flex h-3 w-full overflow-hidden rounded-sm" role="img" aria-label={split.map(([k, v]) => `${k} ${pc(Number(v || 0), rev)}`).join(', ')}>{split.map(([k, v, c]) => <span key={k} style={{ width: `${Math.max(0, (Number(v || 0) / rev) * 100)}%`, background: c }} />)}</div>
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">{split.map(([k, v, c]) => <div key={k}><dt className="flex items-center gap-1.5 text-xs text-char/60"><span className="h-2 w-2 rounded-sm" style={{ background: c }} />{k}</dt><dd className="font-mono tabular-nums mt-0.5">{pc(Number(v || 0), rev)} <span className="text-char/60 text-xs">{m(v)}</span></dd></div>)}</dl>
      </div>
      <div className="card overflow-x-auto"><table className="w-full text-sm min-w-[560px]" data-testid="fee-table"><caption className="sr-only">Digital versus print-on-demand orders</caption>
        <thead><tr className="text-left text-xs text-char/60 border-b border-black/[.08]">{['Product type', 'Orders', 'Revenue', 'PayPal fee', 'Supplier', 'Staff', 'Kept'].map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r.name} className="border-b border-black/[.06] last:border-0"><th scope="row" className="px-4 py-3 text-left font-medium">{r.name}</th><td className="px-4 font-mono tabular-nums">{r.n}</td><td className="px-4 font-mono tabular-nums">{m(r.r)}</td><td className="px-4 font-mono tabular-nums">{pc(r.f, r.r)}</td><td className="px-4 font-mono tabular-nums">{pc(r.s, r.r)}</td><td className="px-4 font-mono tabular-nums">{pc(r.p, r.r)}</td><td className="px-4 font-mono tabular-nums">{pc(r.keep, r.r)}</td></tr>)}</tbody></table></div>
      <p className="text-sm text-char/70 max-w-3xl">What this shows, honestly: on these orders PayPal’s fee was {pc(Number(t.fees || 0), rev)} of revenue (small tickets carry a fixed per-transaction part, so the share is higher on cheap items). Digital products have no supplier cost and no stock; physical items are printed by Printful only after a buyer has paid ({phy.length} such order{phy.length === 1 ? '' : 's'}), so nothing is made that wasn’t sold. Before refunds, the business kept {pc(Number(t.profit || 0) + Number(t.refunds || 0), rev)}. Sandbox data, small sample — not a forecast.</p>
    </section>
  </>;
}
