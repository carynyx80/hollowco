'use client';
import { useEffect, useRef, useState } from 'react';
import { loadScript } from '@paypal/paypal-js';
import { api } from '@/lib/api';
export function PayButton({ shopId, productId, onDone, onError }: { shopId: string; productId: string; onDone: (o: any) => void; onError?: (m: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = await api('/config');
      const paypal = await loadScript({ clientId: cfg.paypalClientId, currency: 'USD', intent: 'capture', components: 'buttons' });
      if (cancelled || !paypal?.Buttons || !ref.current) return;
      ref.current.innerHTML = '';
      await paypal.Buttons({
        style: { layout: 'vertical', height: 45, shape: 'pill', color: 'gold', tagline: false },
        createOrder: async () => (await api('/orders', { method: 'POST', body: JSON.stringify({ shopId, items: [{ productId, qty: 1 }] }) })).paypalOrderId,
        onApprove: async (d: any) => onDone(await api(`/orders/${d.orderID}/capture`, { method: 'POST' })),
        onError: (e: any) => { const m = String(e?.message || e); setErr(m); onError?.(m); },
      }).render(ref.current);
      setReady(true);
    })().catch((e) => setErr(e.message));
    return () => { cancelled = true; };
  }, [shopId, productId, onDone, onError]);
  return <div>{!ready && !err && <div className="skeleton h-[45px] rounded-full" />}<div ref={ref} data-testid="paypal-buttons" />{err && <p className="text-xs text-red-600 mt-2">{err}</p>}</div>;
}
export function OrderResult({ order }: { order: any }) {
  return <div className="card p-5 border-emerald-200 bg-emerald-50/40">
    <p className="font-semibold">Payment {order.status?.toLowerCase()} ✓</p>
    {order.downloads?.map((d: any) => <p key={d.pdf} className="text-sm mt-2">📘 {d.title}: <a className="underline font-medium" href={'/api' + d.pdf}>PDF</a> · <a className="underline" href={'/api' + d.md}>Markdown</a></p>)}
    {order.supplier?.map((s: any) => <p key={s.productId} className="text-sm mt-1 text-char/70">📦 Supplier draft {s.id} ({s.mode === 'simulated' ? 'simulated supplier' : 'Printful draft'}) · cost ${s.cost}</p>)}
    {order.payouts?.map((p: any, i: number) => <p key={i} className="text-sm mt-1 text-char/70">💸 Paid {p.agent} agent ${p.amount} via PayPal {p.method}</p>)}
  </div>;
}
