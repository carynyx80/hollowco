'use client';
import Link from 'next/link';
import { use, useEffect, useState } from 'react';
import { api, usd } from '@/lib/api';
export default function Shop({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [shop, setShop] = useState<any>(null); const [err, setErr] = useState('');
  useEffect(() => { api(`/shops/${id}`).then(setShop).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <div className="mx-auto max-w-6xl px-5 py-20 text-center"><p className="font-medium">Shop not found</p><Link href="/marketplace" className="btn-ghost mt-4">Back to marketplace</Link></div>;
  if (!shop) return <div className="mx-auto max-w-6xl px-5 py-10 space-y-6"><div className="skeleton h-40" /><div className="grid grid-cols-2 md:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className="skeleton aspect-square" />)}</div></div>;
  const [c1, c2, c3] = shop.colors;
  return <div className="mx-auto max-w-6xl px-5 py-10">
    <div className="card overflow-hidden border-0" style={{ background: c1, color: c3 }}>
      <div className="p-8 md:p-10 flex flex-col sm:flex-row sm:items-center gap-6">
        <img src={shop.logo} alt="" className="h-24 w-24 rounded-2xl bg-white/10 object-cover shadow-lg" />
        <div><h1 className="font-display text-3xl md:text-4xl ">{shop.name}</h1><p className="mt-1 opacity-80">{shop.tagline}</p>
          <p className="text-xs opacity-60 mt-3">Founded by an AI from the idea “{shop.idea}” · staff: 0 humans</p></div>
      </div>
      <div className="h-1.5" style={{ background: c2 }} />
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-8">
      {shop.products.map((p: any) => {
        const inner = <><div className="aspect-square bg-sand overflow-hidden">{p.image ? <img src={p.image} alt="" className="h-full w-full object-cover group-hover:scale-[1.04] transition duration-500" /> : <div className="h-full grid place-items-center text-5xl" style={{ background: c3 }}>⌚</div>}</div>
          <div className="p-4"><div className="flex justify-between gap-2"><h3 className="font-medium">{p.title}</h3>{!p.comingSoon && <span className="font-semibold tabular-nums">{usd(p.price)}</span>}</div>
            <p className="text-[11px] uppercase tracking-wider mt-1 font-medium" style={{ color: c2 }}>{p.comingSoon ? 'coming soon' : p.digital ? 'e-book · instant PDF' : `${p.kind} · print on demand`}</p>
            <p className="text-sm text-char/60 mt-2 line-clamp-2">{p.description}</p></div></>;
        return p.comingSoon ? <div key={p.id} className="card overflow-hidden opacity-60">{inner}</div> : <Link key={p.id} href={`/p/${shop.id}/${p.id}`} className="group card overflow-hidden hover:shadow-lg transition">{inner}</Link>;
      })}
    </div>
  </div>;
}
