import Link from 'next/link';
import { usd } from '@/lib/api';
export function ProductCard({ p }: { p: any }) {
  return <Link href={`/p/${p.shopId}/${p.id}`} className="group card overflow-hidden flex flex-col hover:-translate-y-0.5 hover:shadow-lg transition" data-testid="product-card">
    <div className="relative aspect-square bg-sand overflow-hidden">
      <img src={p.image} alt={p.title} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
      <span className="absolute left-3 top-3 rounded-full bg-white/90 backdrop-blur px-2.5 py-1 text-[11px] font-medium">{p.category}</span>
    </div>
    <div className="p-4 flex flex-col gap-1 flex-1">
      <div className="flex items-start justify-between gap-3"><h3 className="font-medium leading-snug line-clamp-2">{p.title}</h3><span className="font-semibold tabular-nums">{usd(p.price)}</span></div>
      <div className="mt-auto pt-2 flex items-center gap-2 text-xs text-char/55"><img src={p.shopLogo} alt="" className="h-5 w-5 rounded-full object-cover bg-sand" />{p.shopName}</div>
    </div>
  </Link>;
}
export function ProductSkeleton() {
  return <div className="card overflow-hidden"><div className="skeleton aspect-square rounded-none" /><div className="p-4 space-y-2"><div className="skeleton h-4 w-3/4" /><div className="skeleton h-3 w-1/3" /></div></div>;
}
