'use client';
import { useEffect, useRef, useState } from 'react';
import { loadScript } from '@paypal/paypal-js';
import { api, usd } from '@/lib/api';
type St = { kind: 'idle' } | { kind: 'processing' } | { kind: 'cancelled' } | { kind: 'declined'; msg: string } | { kind: 'error'; msg: string };
export function PayButton({ shopId, productId, items, color = 'white', onDone, onError }: { shopId: string; productId?: string; items?: { productId: string; qty: number }[]; color?: 'white' | 'gold' | 'black'; onDone: (o: any, recover?: { orderId: string; ppId: string }) => void; onError?: (m: string) => void }) {
  const ref = useRef<HTMLDivElement>(null); const ours = useRef<string>(''); const cb = useRef({ onDone, onError, items }); cb.current = { onDone, onError, items };
  const [ready, setReady] = useState(false); const [st, setSt] = useState<St>({ kind: 'idle' }); const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = await api('/config');
      const paypal = await loadScript({ clientId: cfg.paypalClientId, currency: 'USD', intent: 'capture', components: 'buttons', enableFunding: 'card',
        // Sandbox only: pin buyer country to US so the guest card option renders and test cards are evaluated as US cards
        // regardless of the visitor's IP (e.g. Lagos). PayPal rejects buyer-country in live, so it is never sent there.
        ...(cfg.paypalEnv !== 'live' ? { buyerCountry: 'US' } : {}) } as any);
      if (cancelled || !paypal?.Buttons || !ref.current) return;
      ref.current.innerHTML = '';
      await paypal.Buttons({
        style: { layout: 'vertical', height: 48, shape: 'pill', color, tagline: false },
        createOrder: async () => { setSt({ kind: 'idle' }); const o = await api('/orders', { method: 'POST', body: JSON.stringify({ shopId, items: cb.current.items?.length ? cb.current.items : [{ productId, qty: 1 }] }) }); ours.current = o.orderId; return o.paypalOrderId; },
        onApprove: async (d: any, actions: any) => {
          setSt({ kind: 'processing' });
          try { cb.current.onDone(await api(`/orders/${d.orderID}/capture`, { method: 'POST' })); }
          catch (e: any) {
            if (e.status === 422 && /DECLINED/.test(e.message + (e.issue || ''))) { setSt({ kind: 'declined', msg: e.message }); return actions.restart(); }
            if (e.status === 422) { setSt({ kind: 'error', msg: e.message }); cb.current.onError?.(e.message); return; }
            cb.current.onDone(null, { orderId: ours.current, ppId: d.orderID }); // network hiccup: let the receipt page recover from PayPal's state
          }
        },
        onCancel: () => setSt({ kind: 'cancelled' }),
        onError: (e: any) => { const m = String(e?.message || e); if (cancelled) return; setSt({ kind: 'error', msg: m }); cb.current.onError?.(m); },
      }).render(ref.current);
      setReady(true);
    })().catch((e) => { if (!cancelled) setSt({ kind: 'error', msg: e.message }); });
    return () => { cancelled = true; };
  }, [shopId, productId, nonce]);
  return <div>
    {st.kind === 'processing' && <div className="mb-3 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3 text-sm flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full border-2 border-coral border-t-transparent ring-spin" />Capturing payment and briefing your agents…</div>}
    {st.kind === 'cancelled' && <div className="mb-3 rounded-xl border border-white/10 bg-white/[.04] px-4 py-3 text-sm text-char/70">Checkout cancelled — nothing was charged. You can try again below.</div>}
    {(st.kind === 'declined' || st.kind === 'error') && <div className="mb-3 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200" role="alert" data-testid="pay-error"><b>Payment didn’t go through.</b> {st.msg}{st.kind === 'error' && <button onClick={() => { setReady(false); setSt({ kind: 'idle' }); setNonce((n) => n + 1); }} className="ml-2 underline">Retry</button>}</div>}
    <div className={`rounded-lg bg-white p-3 pb-1 transition-shadow duration-300 hover:shadow-[0_18px_50px_-20px_rgba(184,151,90,.6)] ${st.kind === 'processing' ? 'pay-pop ring-2 ring-iris/60' : ''} ${st.kind === 'declined' || st.kind === 'error' ? 'shake-x' : ''}`}>{!ready && <div className="h-[110px] animate-pulse rounded-xl bg-black/5" />}<div ref={ref} data-testid="paypal-buttons" /></div>
  </div>;
}
export function Receipt({ order }: { order: any }) {
  const ok = order.status === 'COMPLETED';
  return <div className={`card overflow-hidden ${ok ? 'border-lime/25' : 'border-red-400/25'}`} data-testid="receipt">
    <div className={`px-6 py-5 flex items-center gap-4 ${ok ? 'bg-lime/[.07]' : 'bg-red-500/[.07]'}`}>
      <span className={`grid h-11 w-11 place-items-center rounded-full text-lg ${ok ? 'bg-lime text-ink' : 'bg-red-400 text-ink'}`}>{ok ? '✓' : '!'}</span>
      <div className="min-w-0"><p className="font-display text-2xl">{ok ? 'Payment complete' : order.status === 'APPROVED' || order.status === 'CREATED' ? 'Payment pending' : 'Payment failed'}</p>
        <p className="text-xs text-char/55">{order.simulated ? 'SIMULATED order — no money moved' : `PayPal sandbox · ${order.paymentSource || 'paypal'}`}{order.payer?.email ? ` · ${order.payer.email}` : ''}</p></div>
      <span className="ml-auto text-2xl font-semibold tabular-nums">{usd(order.total)}</span>
    </div>
    <div className="p-6 space-y-5 text-sm">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
        {[['Order', order.id], ['Status', order.status], ['PayPal order', order.paypalOrderId], ['Capture', order.captureId && `${order.captureId} (${order.captureStatus})`], ['Shop', order.shop?.name], ['Date', order.createdAt && new Date(order.createdAt).toLocaleString()]].filter(([, v]) => v).map(([k, v]) =>
          <div key={k as string}><dt className="text-char/40">{k}</dt><dd className="font-mono text-char/85 break-all" data-testid={`rc-${String(k).toLowerCase().replace(' ', '-')}`}>{v}</dd></div>)}
      </dl>
      <div className="border-t border-white/[.06] pt-4">{order.items?.map((i: any) => <div key={i.productId} className="flex justify-between"><span>{i.qty} × {i.name}</span><span className="tabular-nums">{usd(i.price * i.qty)}</span></div>)}</div>
      {order.downloads?.length > 0 && <div className="space-y-2">{order.downloads.map((d: any) => <div key={d.pdf} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3"><span>Card</span><span className="flex-1 font-medium">{d.title}</span><a className="btn-coral h-8 px-3 text-xs" href={'/api' + d.pdf}>Download PDF</a><a className="btn-ghost h-8 px-3 text-xs" href={'/api' + d.md}>.md</a></div>)}</div>}
      {(order.supplier?.length > 0 || order.payouts?.length > 0) && <div className="rounded-xl bg-black/25 border border-white/[.06] p-4 space-y-1.5 text-xs font-mono">
        <p className="text-[10px] uppercase tracking-[.16em] text-char/40 mb-1 font-sans">What your purchase triggered</p>
        {order.supplier?.map((s: any) => <p key={s.productId} className="text-char/70">⬡ Supplier: {s.mode === 'simulated' ? 'simulated supplier' : 'Printful draft'} {s.id} · cost ${s.cost}</p>)}
        {order.payouts?.map((p: any, i: number) => <p key={i} className="text-char/70">§ Accountant paid {p.agent} agent ${p.amount} via {p.method} <span className="text-char/40">{p.status}</span></p>)}
      </div>}
    </div>
  </div>;
}
export const OrderResult = Receipt;
