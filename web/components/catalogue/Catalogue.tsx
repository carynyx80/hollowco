'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, usd, thumb } from '@/lib/api';
import { Progress } from '@/components/cart/Progress';
import { useCart, cart as gcart } from '@/lib/cart';

type Prod = { id: string; title: string; kind: string; digital: boolean; price: number; comingSoon?: boolean; description?: string; image?: string };
type Shop = { id: string; name: string; tagline?: string; logo?: string; owner?: string; products: Prod[] };
type Line = { productId: string; qty: number };
type Screen = { k: 'home'; mode?: 'search' | 'wish' } | { k: 'product'; pid: string } | { k: 'progress'; orderId: string; ppId?: string };

const KIND: Record<string, string> = { ebook: 'E-books', mug: 'Mugs', tshirt: 'T-shirts', comingsoon: 'Coming soon' };
// Spec columns derived from the real product kind + the real Printful variants used in api/src/printful.ts.
export function specOf(p: Prod) {
  if (p.comingSoon) return { line: 'Coming soon', material: '—', fulfil: '—', delivery: '—' };
  if (p.digital) return { line: 'PDF + Markdown · instant download', material: 'PDF e-book', fulfil: 'Instant download', delivery: 'Instant' };
  if (p.kind === 'mug') return { line: '11 oz ceramic mug · printed by Printful', material: 'Ceramic 11 oz', fulfil: 'Printful', delivery: '5–8 days' };
  return { line: 'Bella+Canvas 3001 tee · printed by Printful', material: 'Cotton tee', fulfil: 'Printful', delivery: '5–8 days' };
}
const ls = { get: (k: string, d: any) => { try { return JSON.parse(localStorage.getItem(k) || '') ?? d; } catch { return d; } }, set: (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const I = {
  x: <path d="M6 6l12 12M18 6L6 18" />, back: <path d="M15 5l-7 7 7 7" />, bag: <><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 016 0v2" /></>,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />, home: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
  search: <><circle cx="11" cy="11" r="6" /><path d="M20 20l-4-4" /></>, plus: <path d="M12 5v14M5 12h14" />, minus: <path d="M5 12h14" />, check: <path d="M5 12l5 5 9-10" />,
};
const Ic = ({ d, fill }: { d: React.ReactNode; fill?: boolean }) => <svg viewBox="0 0 24 24" aria-hidden className={fill ? 'fill' : ''}>{d}</svg>;
const slide = { initial: (dir: number) => ({ x: dir * 60, opacity: 0 }), animate: { x: 0, opacity: 1, transition: { type: 'spring' as const, stiffness: 380, damping: 36 } }, exit: (dir: number) => ({ x: dir * -60, opacity: 0, transition: { duration: .18 } }) };

export function Catalogue({ shopId, initialProduct, onClose }: { shopId: string; initialProduct?: string; onClose: () => void }) {
  const [shop, setShop] = useState<Shop | null>(null); const [err, setErr] = useState('');
  const [screen, setScreen] = useState<Screen>(initialProduct ? { k: 'product', pid: initialProduct } : { k: 'home' }); const [dir, setDir] = useState(1);
  const [q, setQ] = useState(''); const [cat, setCat] = useState('all');
  const [wish, setWish] = useState<string[]>([]); const gc = useCart(); const cartOpen = gc.open;
  const [toast, setToast] = useState(''); const searchRef = useRef<HTMLInputElement>(null); const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { api(`/shops/${shopId}`).then(setShop).catch((e) => setErr(e.message)); setWish(ls.get('hc:wish', [])); }, [shopId]);
  const go = (s: Screen, d = 1) => { setDir(d); setScreen(s); panelRef.current?.querySelector('.cat-scroll')?.scrollTo({ top: 0 }); };
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1800); };
  const products = useMemo(() => (shop?.products || []).filter((p) => !(p.comingSoon && !p.image)), [shop]);
  const byId = (id: string) => products.find((p) => p.id === id);
  const add = (p: Prod, n = 1) => { if (p.comingSoon || !shop) return; if (gcart.add({ shopId, productId: p.id, title: p.title, price: p.price, image: p.image, digital: p.digital, kind: p.kind, shopName: shop.name, shopLogo: shop.logo, owner: shop.owner, comingSoon: p.comingSoon }, n)) flash('Added to cart'); };
  const toggleWish = (id: string) => { const w = wish.includes(id) ? wish.filter((x) => x !== id) : [...wish, id]; setWish(w); ls.set('hc:wish', w); };
    const count = gc.count;
  const back = useCallback(() => { if (cartOpen) return; else if (screen.k === 'product') go({ k: 'home' }, -1); else onClose(); }, [cartOpen, screen, onClose]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); back(); } }; window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true); }, [back]);
  useEffect(() => { panelRef.current?.focus(); }, []);

  const cats = useMemo(() => ['all', ...['ebook', 'mug', 'tshirt'].filter((k) => products.some((p) => p.kind === k)), ...(products.some((p) => p.comingSoon) ? ['comingsoon'] : [])], [products]);
  const term = q.trim().toLowerCase();
  const shown = products.filter((p) => (cat === 'all' || p.kind === cat) && (!term || `${p.title} ${p.description || ''} ${KIND[p.kind] || ''}`.toLowerCase().includes(term)) && (screen.k !== 'home' || screen.mode !== 'wish' || wish.includes(p.id)));
  const recs = products.filter((p) => !p.comingSoon).slice().sort((a, b) => b.price - a.price).slice(0, 4);

  const card = (p: Prod) => <div key={p.id} className="cat-card" data-testid="cat-card">
    <div className="cat-plate"><button className="cat-plate-btn" onClick={() => go({ k: 'product', pid: p.id })} aria-label={`Open ${p.title}`}>{p.image && <img src={thumb(p.image, 640)} alt="" loading="lazy" decoding="async" />}</button>
      <button className={`cat-heart ${wish.includes(p.id) ? 'on' : ''}`} onClick={() => toggleWish(p.id)} aria-pressed={wish.includes(p.id)} aria-label={wish.includes(p.id) ? 'Remove from wishlist' : 'Add to wishlist'} data-testid="cat-heart"><Ic d={I.heart} fill={wish.includes(p.id)} /></button>
      {p.comingSoon ? <span className="cat-soon">Coming soon</span> : <button className="cat-add" onClick={() => add(p)} aria-label={`Add ${p.title} to cart`} data-testid="cat-quick-add"><Ic d={I.plus} /></button>}</div>
    <button className="cat-meta" onClick={() => go({ k: 'product', pid: p.id })}><span className="cat-title">{p.title}</span><span className="cat-price">{p.comingSoon ? 'Coming soon' : usd(p.price)}</span></button>
  </div>;

  let body: React.ReactNode = null;
  if (err) body = <div className="cat-empty">This catalogue is closed. <span>{err}</span></div>;
  else if (!shop) body = <div className="cat-pad"><div className="cat-shim h-10 w-2/3" /><div className="cat-grid mt-6">{[0, 1, 2, 3].map((i) => <div key={i} className="cat-shim aspect-square" />)}</div></div>;
  else if (screen.k === 'home') body = <div className="cat-pad">
    <p className="cat-eyebrow">The Catalogue · Vol. 01</p>
    <h1 className="cat-h1">Find your next <i>favourite</i> piece.</h1>
    <p className="cat-by">by <b>{shop.owner || 'HollowCo'}</b> · {shop.tagline}</p>
    <label className="cat-search"><Ic d={I.search} /><input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${shop.name}`} aria-label="Search the catalogue" data-testid="cat-search" />{q && <button onClick={() => setQ('')} aria-label="Clear search"><Ic d={I.x} /></button>}</label>
    <div className="cat-pills" role="tablist" aria-label="Categories">{cats.map((c) => <button key={c} role="tab" aria-selected={cat === c} className={`cat-pill ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)} data-testid={`cat-pill-${c}`}>{c === 'all' ? 'All' : KIND[c]}</button>)}</div>
    {screen.mode === 'wish' && <p className="cat-sec">Your wishlist</p>}
    {shown.length ? <div className="cat-grid" data-testid="cat-grid">{shown.map(card)}</div> : <div className="cat-empty">{screen.mode === 'wish' ? 'Tap the heart on anything you love — it’s saved on this device.' : 'Nothing matches that yet.'}</div>}
    {screen.mode !== 'wish' && !term && recs.length > 1 && <><p className="cat-sec">We recommend</p><div className="cat-row">{recs.map((p) => <button key={p.id} className="cat-rec" onClick={() => go({ k: 'product', pid: p.id })}><span className="cat-rec-img">{p.image && <img src={thumb(p.image, 640)} alt="" loading="lazy" decoding="async" />}</span><span className="cat-title">{p.title}</span><span className="cat-price">{usd(p.price)}</span></button>)}</div></>}
  </div>;
  else if (screen.k === 'product') body = <ProductView p={byId(screen.pid)} wished={wish.includes(screen.pid)} onWish={() => toggleWish(screen.pid)} onAdd={add} more={products.filter((x) => x.id !== screen.pid && !x.comingSoon).slice(0, 4)} onOpen={(pid) => go({ k: 'product', pid })} />;
  else body = <Progress orderId={screen.orderId} ppId={screen.ppId} onDone={onClose} />;

  const title = screen.k === 'product' ? 'Details' : screen.k === 'progress' ? 'Order' : null;
  return <motion.div className="cat-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="catalogue">
    <motion.div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${shop?.name || 'Shop'} catalogue`} className="cat-panel" initial={{ y: 40, scale: .97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } }} exit={{ y: 30, opacity: 0, transition: { duration: .2 } }}>
      <header className="cat-top">
        <button className="cat-ic" onClick={back} aria-label={screen.k === 'product' ? 'Back' : 'Close catalogue'} data-testid="cat-back"><Ic d={screen.k === 'product' ? I.back : I.x} /></button>
        {title ? <span className="cat-toptitle">{title}</span> : <span className="cat-brand">{shop?.logo && <img src={thumb(shop.logo, 64)} alt="" />}{shop?.name}</span>}
        {screen.k === 'progress' ? <span className="cat-ic-ghost" /> : <button className="cat-ic" onClick={() => gcart.openCart()} aria-label={`Cart, ${count} items`} data-testid="cat-cart-btn"><Ic d={I.bag} />{count > 0 && <b className="cat-badge">{count}</b>}</button>}
      </header>
      <div className="cat-scroll"><AnimatePresence mode="wait" custom={dir} initial={false}><motion.div key={screen.k + ((screen as any).pid || (screen as any).mode || '')} custom={dir} variants={slide} initial="initial" animate="animate" exit="exit">{body}</motion.div></AnimatePresence></div>
      {screen.k === 'home' && <nav className="cat-dock" aria-label="Catalogue">
        {([['home', 'Home', I.home], ['search', 'Search', I.search], ['wish', 'Wishlist', I.heart]] as const).map(([k, l, d]) => { const on = k === 'home' ? !screen.mode : screen.mode === k; return <button key={k} className={on ? 'on' : ''} aria-current={on} onClick={() => { go({ k: 'home', mode: k === 'home' ? undefined : k }, 0); if (k === 'search') setTimeout(() => searchRef.current?.focus(), 250); }} data-testid={`cat-dock-${k}`}><Ic d={d} />{on && <span>{l}</span>}</button>; })}
        <button onClick={() => gcart.openCart()} aria-label={`Cart, ${count} items`} data-testid="cat-dock-cart"><Ic d={I.bag} />{count > 0 && <b className="cat-badge">{count}</b>}</button>
      </nav>}
      <AnimatePresence>{toast && <motion.div className="cat-toast" role="status" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} data-testid="cat-toast"><Ic d={I.check} />{toast}</motion.div>}</AnimatePresence>
    </motion.div>
  </motion.div>;
}

function Qty({ v, set, min = 1 }: { v: number; set: (n: number) => void; min?: number }) {
  return <div className="cat-qty" role="group" aria-label="Quantity"><button onClick={() => set(Math.max(min, v - 1))} aria-label="Decrease quantity" data-testid="qty-dec"><Ic d={I.minus} /></button><span aria-live="polite">{v}</span><button onClick={() => set(Math.min(5, v + 1))} aria-label="Increase quantity" data-testid="qty-inc"><Ic d={I.plus} /></button></div>;
}

function ProductView({ p, wished, onWish, onAdd, more, onOpen }: { p?: Prod; wished: boolean; onWish: () => void; onAdd: (p: Prod, n: number) => void; more: Prod[]; onOpen: (pid: string) => void }) {
  const [n, setN] = useState(1);
  if (!p) return <div className="cat-empty">That piece isn’t in this catalogue.</div>;
  const s = specOf(p);
  return <div className="cat-pad" data-testid="cat-product">
    <div className="cat-hero">{p.image && <img src={thumb(p.image, 1080)} alt={p.title} />}<button className={`cat-heart ${wished ? 'on' : ''}`} onClick={onWish} aria-pressed={wished} aria-label="Wishlist"><Ic d={I.heart} fill={wished} /></button></div>
    <div className="cat-ptop"><h1 className="cat-h2">{p.title}</h1><span className="cat-pprice" data-testid="cat-price">{p.comingSoon ? 'Coming soon' : usd(p.price)}</span></div>
    <p className="cat-specline">{s.line}</p>
    {p.description && <p className="cat-desc">{p.description}</p>}
    {!p.comingSoon && <div className="cat-specs"><div><dt>{p.digital ? 'Format' : 'Material'}</dt><dd>{s.material}</dd></div><div><dt>Fulfilment</dt><dd>{s.fulfil}</dd></div><div><dt>Delivery</dt><dd>{s.delivery}</dd></div></div>}
    {p.comingSoon ? <p className="cat-soonbox" data-testid="coming-soon">Coming soon — this piece isn’t available to buy yet.</p>
      : <div className="cat-buy"><Qty v={n} set={setN} /><button className="cat-cta" onClick={() => onAdd(p, n)} data-testid="cat-add">Add to cart – {usd(p.price * n)}</button></div>}
    {more.length > 0 && <><p className="cat-sec">You may also like</p><div className="cat-row">{more.map((m) => <button key={m.id} className="cat-rec" onClick={() => onOpen(m.id)}><span className="cat-rec-img">{m.image && <img src={thumb(m.image, 384)} alt="" loading="lazy" />}</span><span className="cat-title">{m.title}</span><span className="cat-price">{usd(m.price)}</span></button>)}</div></>}
  </div>;
}

