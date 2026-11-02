'use client';
import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { loadScript } from '@paypal/paypal-js';
import { api, API } from '@/lib/api';
function PayButton({ shopId, productId, onDone }: { shopId: string; productId: string; onDone: (o: any) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cfg = await api('/config');
      const paypal = await loadScript({ clientId: cfg.paypalClientId, currency: 'USD', intent: 'capture', components: 'buttons' });
      if (cancelled || !paypal?.Buttons || !ref.current) return;
      ref.current.innerHTML = '';
      await paypal.Buttons({
        style: { layout: 'horizontal', height: 40, tagline: false },
        createOrder: async () => (await api('/orders', { method: 'POST', body: JSON.stringify({ shopId, items: [{ productId, qty: 1 }] }) })).paypalOrderId,
        onApprove: async (d: any) => onDone(await api(`/orders/${d.orderID}/capture`, { method: 'POST' })),
        onError: (e: any) => setErr(String(e?.message || e)),
      }).render(ref.current);
    })().catch((e) => setErr(e.message));
    return () => { cancelled = true; };
  }, [shopId, productId, onDone]);
  return <div><div ref={ref} />{err && <p className="text-xs text-red-600 mt-1">{err}</p>}</div>;
}
export default function Shop({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [shop, setShop] = useState<any>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [order, setOrder] = useState<any>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api(`/shops/${id}`).then(setShop).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <p className="text-red-600">{err}</p>;
  if (!shop) return <p className="animate-pulse">Opening shop…</p>;
  const [c1, c2, c3] = shop.colors;
  return (
    <div className="rounded-3xl overflow-hidden border border-char/10" style={{ background: c3, color: c1 }}>
      <div className="p-8 flex items-center gap-5" style={{ background: c1, color: c3 }}>
        <img src={shop.logo} alt="" className="h-20 w-20 rounded-xl bg-white" />
        <div><h1 className="text-3xl font-bold">{shop.name}</h1><p className="opacity-80">{shop.tagline}</p>
          <p className="text-xs opacity-60 mt-1">Founded by an AI from the idea: “{shop.idea}” · staff: 0 humans</p></div>
      </div>
      {order && <div className="m-6 p-5 rounded-xl bg-white border-2" style={{ borderColor: c2 }}>
        <h2 className="font-semibold">Order {order.status} ✓</h2>
        {order.downloads?.map((d: any) => <p key={d.pdf} className="text-sm mt-1">📘 {d.title}: <a className="underline" href={API + d.pdf}>PDF</a> · <a className="underline" href={API + d.md}>Markdown</a></p>)}
        {order.supplier?.map((s: any) => <p key={s.productId} className="text-sm mt-1">📦 Supplier draft {s.id} ({s.mode === 'simulated' ? 'SIMULATED supplier' : 'Printful draft, not confirmed'}) · cost ${s.cost}</p>)}
        {order.payouts?.map((p: any, i: number) => <p key={i} className="text-sm mt-1">💸 Paid {p.agent} agent ${p.amount} via PayPal {p.method} ({p.status})</p>)}
        <Link href="/ledger" className="text-sm underline mt-2 inline-block">See it on the public ledger →</Link>
      </div>}
      <div className="p-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {shop.products.map((p: any) => <div key={p.id} className="bg-white rounded-2xl p-4 flex flex-col text-char">
          {p.image ? <img src={p.image} alt="" className="rounded-xl aspect-square object-cover" /> : <div className="rounded-xl aspect-square grid place-items-center text-5xl" style={{ background: c3 }}>⌚</div>}
          <div className="mt-3 flex items-baseline justify-between gap-2"><h3 className="font-semibold">{p.title}</h3>{!p.comingSoon && <span className="font-bold">${p.price.toFixed(2)}</span>}</div>
          <p className="text-xs uppercase tracking-wide mt-1" style={{ color: c2 }}>{p.comingSoon ? 'coming soon' : p.digital ? 'e-book · instant PDF' : `${p.kind} · print on demand`}</p>
          <p className="text-sm text-char/70 mt-2 flex-1">{p.description}</p>
          {p.comingSoon ? <button disabled className="mt-4 rounded-full py-2 border opacity-50">Coming soon</button>
            : buying === p.id ? <div className="mt-4"><PayButton shopId={shop.id} productId={p.id} onDone={setOrder} /></div>
            : <button onClick={() => setBuying(p.id)} className="mt-4 rounded-full py-2 font-medium" style={{ background: c2, color: c1 }}>Buy</button>}
        </div>)}
      </div>
      <p className="px-6 pb-6 text-xs opacity-60">Sandbox only — pay with a PayPal sandbox personal account.</p>
    </div>
  );
}
