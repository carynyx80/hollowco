'use client';
import { useEffect, useState } from 'react';
import { api, usd } from '@/lib/api';
const Check = () => <svg viewBox="0 0 24 24" aria-hidden><path d="M5 12l5 5 9-10" /></svg>;
// Order progress, driven by the real order record (GET /orders/:id). A global-cart checkout has one block of steps per store.
export function Progress({ orderId, ppId, onDone }: { orderId: string; ppId?: string; onDone: () => void }) {
  const [o, setO] = useState<any>(null); const [err, setErr] = useState(''); const [shown, setShown] = useState(0);
  useEffect(() => {
    let stop = false;
    (async () => {
      for (let i = 0; i < 40 && !stop; i++) {
        try {
          let x = await api(`/orders/${orderId}`);
          if (x.status !== 'COMPLETED' && (ppId || x.paypalOrderId)) x = await api(`/orders/pp/${ppId || x.paypalOrderId}?capture=1`).catch((e) => ({ ...x, failure: e.message }));
          if (!stop) setO(x);
          const paid = (x.payouts || []).length > 0 && x.payouts.every((p: any) => ['SUCCESS', 'SIMULATED', 'DRAFT'].includes(p.status) || p.reversed);
          if (x.status === 'COMPLETED' && Array.isArray(x.payouts) && (paid || i > 12)) return;
          if (x.failure && x.status !== 'COMPLETED' && i > 2) return;
        } catch (e: any) { if (!stop) setErr(e.message); return; }
        await new Promise((r) => setTimeout(r, 3000));
      }
    })();
    return () => { stop = true; };
  }, [orderId, ppId]);
  const stores: any[] = o ? (o.stores || [o]) : [];
  const caps = o ? (o.captureIds || [o.captureId]).filter(Boolean) : [];
  const groups: { head?: any; steps: { t: string; d: React.ReactNode; done: boolean }[] }[] = [{ steps: [{ t: 'Payment received', d: o?.captureStatus ? <>One PayPal capture{stores.length > 1 ? ` · ${stores.length} stores` : ''} · <code data-testid="capture-status">CAPTURE {o.captureStatus}</code></> : o?.status === 'COMPLETED' ? 'Captured via PayPal' : 'Waiting for PayPal…', done: o?.status === 'COMPLETED' }] }];
  for (const s of stores) {
    const physical = (s.items || []).filter((i: any) => !i.digital), digital = (s.items || []).filter((i: any) => i.digital), sup = s.supplier || [], pays = s.payouts || [];
    groups.push({ head: s.shop, steps: [
      { t: 'Order created', d: [...physical.map((i: any) => `${i.name} → Printful`), ...digital.map((i: any) => `${i.name} → PDF ready`)].join(' · ') + ` · ${usd(s.total)}`, done: s.status === 'COMPLETED' && Array.isArray(s.supplier) },
      { t: 'AI staff fulfilling', d: sup.length ? sup.map((x: any) => `${x.mode === 'simulated' ? 'Simulated supplier' : 'Printful draft'} #${x.id ?? '—'} (${x.status})`).join(' · ') + (digital.length ? ' · e-book delivered' : '') : digital.length ? 'Writer agent delivered your e-book' : 'Staff are packing your order…', done: Array.isArray(s.payouts) },
      { t: 'Staff paid via PayPal Payouts', d: pays.length ? pays.map((p: any) => `${p.agent} ${usd(p.amount)} · ${p.method} ${p.status}`).join(' · ') : Array.isArray(s.payouts) ? 'No payout — blocked by guardrails (see ledger)' : 'Wages released once fulfilment completes', done: Array.isArray(s.payouts) && (pays.length === 0 || pays.some((p: any) => p.ok !== false)) },
    ] });
  }
  const flat = groups.flatMap((g) => g.steps);
  const real = flat.findIndex((s) => !s.done); const target = !o ? 0 : real === -1 ? flat.length : real;
  useEffect(() => { if (shown >= target) return; const t = setTimeout(() => setShown((s) => s + 1), 700); return () => clearTimeout(t); }, [shown, target]);
  if (err) return <div className="cat-empty">We couldn’t load that order. <span>{err}</span></div>;
  let n = 0;
  return <div className="cat-pad" data-testid="cat-progress">
    <div className="cat-thanks"><p className="cat-eyebrow">Thank you</p><h1 className="cat-h2">{o?.status === 'COMPLETED' ? <>Your order is<br />on its way.</> : o?.failure ? 'Payment didn’t complete.' : <>Confirming your<br />payment…</>}</h1>
      <p className="cat-ord">Order #{orderId.slice(2, 10).toUpperCase()} · {o ? usd(o.total) : '…'}{caps.length ? ` · capture ${caps[0]}` : ''}</p></div>
    <div className="cat-progh"><h2>Progress</h2><span>{shown < flat.length || !o ? 'Live' : 'Complete'}</span></div>
    {groups.map((g, gi) => <div key={gi} data-testid={g.head ? 'store-progress' : undefined}>
      {g.head && <p className="cat-store-h">{g.head.logo && <img src={g.head.logo} alt="" />}<b>{g.head.name}</b></p>}
      <ol className="cat-steps">{g.steps.map((s) => { const i = n++; const st = i < shown ? 'done' : i === shown ? 'now' : 'todo'; return <li key={i} className={st} data-testid={`step-${i}`} data-state={st}><span className="dot">{st === 'done' ? <Check /> : null}</span><div><p>{s.t}</p><small>{s.d}</small></div></li>; })}</ol></div>)}
    {o?.failure && o.status !== 'COMPLETED' && <p className="cat-err">{o.failure}</p>}
    {shown >= 2 && o?.downloads?.map((d: any) => <a key={d.pdf} className="cat-cta brass" href={'/api' + d.pdf} data-testid="cat-download">Download {d.title}</a>)}
    {o && shown >= flat.length && <button className="cat-cta ghost" onClick={onDone} data-testid="cat-done">Done</button>}
    <a className="cat-link" href={`/order/${orderId}`}>Receipt</a> <a className="cat-link" href="/ledger">See it on the public ledger →</a>
  </div>;
}
