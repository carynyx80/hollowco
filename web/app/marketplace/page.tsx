'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ProductCard, ProductSkeleton } from '@/components/ProductCard';
import { api } from '@/lib/api';
export default function Marketplace() {
  const [q, setQ] = useState(''); const [term, setTerm] = useState(''); const [cat, setCat] = useState('');
  const [items, setItems] = useState<any[]>([]); const [next, setNext] = useState<number | null>(0); const [total, setTotal] = useState<number | null>(null);
  const [cats, setCats] = useState<any[]>([]); const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null); const gen = useRef(0);
  useEffect(() => { const t = setTimeout(() => setTerm(q), 300); return () => clearTimeout(t); }, [q]);
  const fetchPage = useCallback(async (offset: number, reset: boolean) => {
    const g = reset ? ++gen.current : gen.current; setLoading(true);
    try {
      const d = await api(`/marketplace?limit=12&offset=${offset}&q=${encodeURIComponent(term)}&category=${cat}`);
      if (g !== gen.current) return;
      setItems((x) => (reset ? d.items : [...x, ...d.items])); setNext(d.nextOffset); setTotal(d.total); setCats(d.categories);
    } finally { if (g === gen.current) setLoading(false); }
  }, [term, cat]);
  useEffect(() => { setItems([]); setNext(0); fetchPage(0, true); }, [fetchPage]);
  useEffect(() => {
    const el = sentinel.current; if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting && next !== null && next > 0 && !loading) fetchPage(next, false); }, { rootMargin: '600px' });
    io.observe(el); return () => io.disconnect();
  }, [next, loading, fetchPage]);
  return <div className="mx-auto max-w-6xl px-5 py-10">
    <p className="eyebrow">Marketplace</p>
    <div className="flex flex-col md:flex-row md:items-end gap-4 justify-between mt-1">
      <div><h1 className="text-4xl font-semibold tracking-tight">Everything, from every AI shop</h1><p className="text-char/55 mt-2">E-books are delivered instantly. Merch is printed on demand. No account needed to buy.</p></div>
      <div className="relative md:w-80"><svg className="absolute left-3.5 top-3.5 text-char/35" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products or shops" className="input pl-10" data-testid="search" /></div>
    </div>
    <div className="sticky top-16 z-30 -mx-5 px-5 py-3 mt-4 bg-cream/85 backdrop-blur flex gap-2 overflow-x-auto">
      {[{ id: '', label: 'All' }, ...cats].map((c) => <button key={c.id} onClick={() => setCat(c.id)} className={`chip shrink-0 ${cat === c.id ? '!bg-char !text-cream !border-char' : ''}`}>{c.label}</button>)}
      {total !== null && <span className="ml-auto self-center text-xs text-char/45 shrink-0">{total} products</span>}
    </div>
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-2" data-testid="grid">
      {items.map((p) => <ProductCard key={p.id} p={p} />)}
      {loading && Array.from({ length: items.length ? 4 : 8 }).map((_, i) => <ProductSkeleton key={'s' + i} />)}
    </div>
    {!loading && total === 0 && <div className="card p-12 text-center mt-4"><p className="font-medium">Nothing matches “{term || cat}”</p><p className="text-sm text-char/55 mt-1">Try another search, or start a company that sells it.</p></div>}
    <div ref={sentinel} className="h-10" />
    {next === null && items.length > 0 && <p className="text-center text-xs text-char/40">You’ve reached the end · {total} products</p>}
  </div>;
}
