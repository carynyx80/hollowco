'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PayButton, OrderResult } from '@/components/PayButton';
import { useToast } from '@/components/Toast';
import { api, usd } from '@/lib/api';
export function ClassicProduct({ shopId, pid }: { shopId: string; pid: string }) {
  const [d, setD] = useState<any>(null); const [err, setErr] = useState(''); const [order, setOrder] = useState<any>(null); const toast = useToast(); const router = useRouter();
  useEffect(() => { api(`/products/${shopId}/${pid}`).then(setD).catch((e) => setErr(e.message)); }, [shopId, pid]);
  const done = useCallback((o: any, rec?: { orderId: string; ppId: string }) => { if (!o && rec) { router.push(`/order/${rec.orderId}?pp=${rec.ppId}`); return; } setOrder(o); toast('Payment complete — thank you!', 'ok'); router.push(`/order/${o.id}`); }, [toast, router]);
  const fail = useCallback((m: string) => toast(m, 'err'), [toast]);
  if (err) return <div className="mx-auto max-w-6xl px-5 py-20 text-center"><p className="font-medium">Product not found</p><Link href="/" className="btn-ghost mt-4">Back to marketplace</Link></div>;
  if (!d) return <div className="mx-auto max-w-6xl px-5 py-10 grid md:grid-cols-2 gap-10"><div className="skeleton aspect-square" /><div className="space-y-4"><div className="skeleton h-5 w-24" /><div className="skeleton h-10 w-3/4" /><div className="skeleton h-24" /><div className="skeleton h-12 rounded-full" /></div></div>;
  const { product: p, shop: s } = d;
  return <div className="mx-auto max-w-6xl px-5 py-10">
    <nav className="text-xs text-char/50 mb-6"><Link href="/">Marketplace</Link> / <Link href={`/shop/${s.id}`}>{s.name}</Link> / <span className="text-char">{p.title}</span></nav>
    <div className="grid md:grid-cols-2 gap-10 items-start">
      <div className="card overflow-hidden"><img src={p.image} alt={p.title} className="w-full aspect-square object-cover" /></div>
      <div className="md:sticky md:top-24">
        <span className="chip">{p.category}</span>
        <h1 className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight" data-testid="product-title">{p.title}</h1>
        <p className="mt-3 text-3xl font-semibold tabular-nums text-iris">{usd(p.price)}</p>
        <p className="mt-5 text-char/70 leading-relaxed">{p.description}</p>
        <ul className="mt-5 space-y-1.5 text-sm text-char/60">{p.digital ? <><li>⚡ Instant PDF + Markdown download after payment</li><li>✍️ Written by the shop’s writer agent</li></> : <><li>🖨 Printed on demand by Printful</li><li>🎨 Designed by the shop’s designer agent</li></>}</ul>
        <div className="mt-7">{order ? <OrderResult order={order} /> : <PayButton shopId={s.id} productId={p.id} onDone={done} onError={fail} />}</div>
        <p className="mt-3 text-xs text-char/45">PayPal sandbox — pay with a sandbox PayPal account or as a guest with a sandbox test card. No HollowCo account needed.</p>
        <Link href={`/shop/${s.id}`} className="card p-4 mt-8 flex items-center gap-3 hover:shadow-lg transition"><img src={s.logo} alt="" className="h-11 w-11 rounded-lg object-cover bg-sand" /><div className="min-w-0"><p className="text-sm font-medium">Sold by {s.name}</p><p className="text-xs text-char/50 truncate">{s.tagline} · 0 humans on staff</p></div><span className="ml-auto text-char/40">→</span></Link>
      </div>
    </div>
    {d.more.length > 0 && <section className="mt-16"><h2 className="font-semibold mb-4">More from {s.name}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{d.more.map((m: any) => <Link key={m.id} href={`/p/${s.id}/${m.id}`} className="card overflow-hidden hover:shadow-lg transition"><img src={m.image} alt="" className="aspect-square object-cover w-full" /><div className="p-3 flex justify-between gap-2 text-sm"><span className="font-medium line-clamp-1">{m.title}</span><span className="tabular-nums">{usd(m.price)}</span></div></Link>)}</div></section>}
  </div>;
}
