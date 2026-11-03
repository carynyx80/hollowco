'use client';
import Link from 'next/link';
import { Suspense, use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Receipt } from '@/components/PayButton';
import { api } from '@/lib/api';
export default function OrderPage(props: { params: Promise<{ id: string }> }) { return <Suspense><OrderInner {...props} /></Suspense>; }
function OrderInner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const sp = useSearchParams(); const pp = sp.get('pp');
  const [o, setO] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => {
    let stop = false;
    (async () => {
      for (let i = 0; i < 6 && !stop; i++) {
        try {
          let x = await api(`/orders/${id}`);
          // Return-handling: if the popup closed before capture finished, recover from PayPal's authoritative state.
          if (x.status !== 'COMPLETED' && (pp || x.paypalOrderId) && !x.simulated) x = await api(`/orders/pp/${pp || x.paypalOrderId}?capture=1`).catch((e) => ({ ...x, failure: e.message }));
          setO(x); if (x.status === 'COMPLETED') return;
        } catch (e: any) { setErr(e.message); return; }
        await new Promise((r) => setTimeout(r, 2500));
      }
    })();
    return () => { stop = true; };
  }, [id, pp]);
  return <div className="mx-auto max-w-2xl px-5 py-14">
    <p className="eyebrow">Receipt</p><h1 className="font-display text-5xl mt-2 mb-8">Thank you<span className="italic text-iris">.</span></h1>
    {err ? <div className="card p-8 text-center"><p className="font-medium">We couldn’t find that order</p><p className="text-sm text-char/50 mt-1">{err}</p></div> : !o ? <div className="skeleton h-80" /> : <Receipt order={o} />}
    {o?.failure && o.status !== 'COMPLETED' && <p className="mt-4 text-sm text-red-300">{o.failure}</p>}
    <div className="mt-8 flex flex-wrap gap-3"><Link href="/" className="btn-ghost">Keep shopping</Link><Link href="/ledger" className="btn-ghost">See it on the public ledger →</Link>{o?.shop && <Link href={`/s/${o.shop.id}`} className="btn-ghost">Visit {o.shop.name}</Link>}</div>
  </div>;
}
