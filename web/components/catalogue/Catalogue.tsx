'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, usd } from '@/lib/api';
import { PayButton } from '@/components/PayButton';

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
  const [wish, setWish] = useState<string[]>([]); const [cart, setCart] = useState<Line[]>([]); const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState(''); const searchRef = useRef<HTMLInputElement>(null); const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { api(`/shops/${shopId}`).then(setShop).catch((e) => setErr(e.message)); setWish(ls.get('hc:wish', [])); setCart(ls.get(`hc:cart:${shopId}`, [])); }, [shopId]);
  const saveCart = (c: Line[]) => { setCart(c); ls.set(`hc:cart:${shopId}`, c); };
  const go = (s: Screen, d = 1) => { setDir(d); setScreen(s); panelRef.current?.querySelector('.cat-scroll')?.scrollTo({ top: 0 }); };
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1800); };
  const products = useMemo(() => (shop?.products || []).filter((p) => !(p.comingSoon && !p.image)), [shop]);
  const byId = (id: string) => products.find((p) => p.id === id);
  const add = (p: Prod, n = 1) => { if (p.comingSoon) return; const c = [...cart]; const l = c.find((x) => x.productId === p.id); if (l) l.qty = Math.min(5, l.qty + n); else c.push({ productId: p.id, qty: Math.min(5, n) }); saveCart(c); flash('Added to cart'); };
  const toggleWish = (id: string) => { const w = wish.includes(id) ? wish.filter((x) => x !== id) : [...wish, id]; setWish(w); ls.set('hc:wish', w); };
  const lines = cart.map((l) => ({ ...l, p: byId(l.productId) })).filter((l) => l.p && !l.p.comingSoon) as (Line & { p: Prod })[];
  const count = lines.reduce((s, l) => s + l.qty, 0); const total = lines.reduce((s, l) => s + l.qty * l.p.price, 0);
  const back = useCallback(() => { if (cartOpen) setCartOpen(false); else if (screen.k === 'product') go({ k: 'home' }, -1); else onClose(); }, [cartOpen, screen, onClose]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); back(); } }; window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true); }, [back]);
  useEffect(() => { panelRef.current?.focus(); }, []);

  const cats = useMemo(() => ['all', ...['ebook', 'mug', 'tshirt'].filter((k) => products.some((p) => p.kind === k)), ...(products.some((p) => p.comingSoon) ? ['comingsoon'] : [])], [products]);
  const term = q.trim().toLowerCase();
  const shown = products.filter((p) => (cat === 'all' || p.kind === cat) && (!term || `${p.title} ${p.description || ''} ${KIND[p.kind] || ''}`.toLowerCase().includes(term)) && (screen.k !== 'home' || screen.mode !== 'wish' || wish.includes(p.id)));
  const recs = products.filter((p) => !p.comingSoon).slice().sort((a, b) => b.price - a.price).slice(0, 4);

  const card = (p: Prod) => <div key={p.id} className="cat-card" data-testid="cat-card">
    <div className="cat-plate"><button className="cat-plate-btn" onClick={() => go({ k: 'product', pid: p.id })} aria-label={`Open ${p.title}`}>{p.image && <img src={p.image} alt="" />}</button>
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
    {screen.mode !== 'wish' && !term && recs.length > 1 && <><p className="cat-sec">We recommend</p><div className="cat-row">{recs.map((p) => <button key={p.id} className="cat-rec" onClick={() => go({ k: 'product', pid: p.id })}><span className="cat-rec-img">{p.image && <img src={p.image} alt="" />}</span><span className="cat-title">{p.title}</span><span className="cat-price">{usd(p.price)}</span></button>)}</div></>}
  </div>;
  else if (screen.k === 'product') body = <ProductView p={byId(screen.pid)} wished={wish.includes(screen.pid)} onWish={() => toggleWish(screen.pid)} onAdd={add} more={products.filter((x) => x.id !== screen.pid && !x.comingSoon).slice(0, 4)} onOpen={(pid) => go({ k: 'product', pid })} />;
  else body = <Progress orderId={screen.orderId} ppId={screen.ppId} onDone={onClose} />;

  const title = screen.k === 'product' ? 'Details' : screen.k === 'progress' ? 'Order' : null;
  return <motion.div className="cat-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid="catalogue">
    <motion.div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`${shop?.name || 'Shop'} catalogue`} className="cat-panel" initial={{ y: 40, scale: .97, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } }} exit={{ y: 30, opacity: 0, transition: { duration: .2 } }}>
      <header className="cat-top">
        <button className="cat-ic" onClick={back} aria-label={screen.k === 'product' ? 'Back' : 'Close catalogue'} data-testid="cat-back"><Ic d={screen.k === 'product' ? I.back : I.x} /></button>
        {title ? <span className="cat-toptitle">{title}</span> : <span className="cat-brand">{shop?.logo && <img src={shop.logo} alt="" />}{shop?.name}</span>}
        {screen.k === 'progress' ? <span className="cat-ic-ghost" /> : <button className="cat-ic" onClick={() => setCartOpen(true)} aria-label={`Cart, ${count} items`} data-testid="cat-cart-btn"><Ic d={I.bag} />{count > 0 && <b className="cat-badge">{count}</b>}</button>}
      </header>
      <div className="cat-scroll"><AnimatePresence mode="wait" custom={dir} initial={false}><motion.div key={screen.k + ((screen as any).pid || (screen as any).mode || '')} custom={dir} variants={slide} initial="initial" animate="animate" exit="exit">{body}</motion.div></AnimatePresence></div>
      {screen.k === 'home' && <nav className="cat-dock" aria-label="Catalogue">
        {([['home', 'Home', I.home], ['search', 'Search', I.search], ['wish', 'Wishlist', I.heart]] as const).map(([k, l, d]) => { const on = k === 'home' ? !screen.mode : screen.mode === k; return <button key={k} className={on ? 'on' : ''} aria-current={on} onClick={() => { go({ k: 'home', mode: k === 'home' ? undefined : k }, 0); if (k === 'search') setTimeout(() => searchRef.current?.focus(), 250); }} data-testid={`cat-dock-${k}`}><Ic d={d} />{on && <span>{l}</span>}</button>; })}
        <button onClick={() => setCartOpen(true)} aria-label={`Cart, ${count} items`} data-testid="cat-dock-cart"><Ic d={I.bag} />{count > 0 && <b className="cat-badge">{count}</b>}</button>
      </nav>}
      <AnimatePresence>{toast && <motion.div className="cat-toast" role="status" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} data-testid="cat-toast"><Ic d={I.check} />{toast}</motion.div>}</AnimatePresence>
      <AnimatePresence>{cartOpen && <>
        <motion.div className="cat-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setCartOpen(false)} />
        <motion.section className="cat-sheet" role="dialog" aria-label="Your bag" initial={{ y: '100%' }} animate={{ y: 0, transition: { type: 'spring', stiffness: 320, damping: 34 } }} exit={{ y: '100%', transition: { duration: .22 } }} data-testid="cat-cart">
          <div className="cat-grab" /><div className="cat-sheet-head"><div><p className="cat-eyebrow">Your bag</p><h2 className="cat-h2">{count} {count === 1 ? 'piece' : 'pieces'}</h2></div><button className="cat-ic" onClick={() => setCartOpen(false)} aria-label="Close bag"><Ic d={I.x} /></button></div>
          {!lines.length ? <div className="cat-empty">Your bag is empty.</div> : <>
            {lines.map((l) => <div key={l.productId} className="cat-line" data-testid="cat-line"><span className="cat-line-img">{l.p.image && <img src={l.p.image} alt="" />}</span><div className="flex-1 min-w-0"><p className="cat-line-t">{l.p.title}</p><p className="cat-line-s">{specOf(l.p).fulfil}{l.p.digital ? ' · PDF' : ' · ships ' + specOf(l.p).delivery}</p>
              <Qty v={l.qty} set={(n) => saveCart(n ? cart.map((x) => x.productId === l.productId ? { ...x, qty: n } : x) : cart.filter((x) => x.productId !== l.productId))} min={0} /></div><span className="cat-line-p">{usd(l.p.price * l.qty)}</span></div>)}
            <dl className="cat-sum"><div><dt>Subtotal</dt><dd>{usd(total)}</dd></div>{lines.some((l) => !l.p.digital) && <div><dt>Shipping (Printful)</dt><dd>Included</dd></div>}<div className="tot"><dt>Total</dt><dd data-testid="cat-total">{usd(total)}</dd></div></dl>
            <div className="cat-pay"><p className="cat-pay-h"><span>Secure payment · PayPal</span><span className="cat-chip">sandbox</span></p>
              <PayButton key={JSON.stringify(cart)} shopId={shopId} items={lines.map((l) => ({ productId: l.productId, qty: l.qty }))} color="gold"
                onDone={(o, rec) => { saveCart([]); setCartOpen(false); go(o ? { k: 'progress', orderId: o.id } : { k: 'progress', orderId: rec!.orderId, ppId: rec!.ppId }); }} onError={(m) => flash(m.slice(0, 80))} />
              <p className="cat-fine">Test card: set Country to United States, use a US billing address, then “Pay now as guest”.</p></div>
          </>}
        </motion.section></>}</AnimatePresence>
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
    <div className="cat-hero">{p.image && <img src={p.image} alt={p.title} />}<button className={`cat-heart ${wished ? 'on' : ''}`} onClick={onWish} aria-pressed={wished} aria-label="Wishlist"><Ic d={I.heart} fill={wished} /></button></div>
    <div className="cat-ptop"><h1 className="cat-h2">{p.title}</h1><span className="cat-pprice" data-testid="cat-price">{p.comingSoon ? 'Coming soon' : usd(p.price)}</span></div>
    <p className="cat-specline">{s.line}</p>
    {p.description && <p className="cat-desc">{p.description}</p>}
    {!p.comingSoon && <div className="cat-specs"><div><dt>{p.digital ? 'Format' : 'Material'}</dt><dd>{s.material}</dd></div><div><dt>Fulfilment</dt><dd>{s.fulfil}</dd></div><div><dt>Delivery</dt><dd>{s.delivery}</dd></div></div>}
    {p.comingSoon ? <p className="cat-soonbox" data-testid="coming-soon">Coming soon — this piece isn’t available to buy yet.</p>
      : <div className="cat-buy"><Qty v={n} set={setN} /><button className="cat-cta" onClick={() => onAdd(p, n)} data-testid="cat-add">Add to cart – {usd(p.price * n)}</button></div>}
    {more.length > 0 && <><p className="cat-sec">You may also like</p><div className="cat-row">{more.map((m) => <button key={m.id} className="cat-rec" onClick={() => onOpen(m.id)}><span className="cat-rec-img">{m.image && <img src={m.image} alt="" />}</span><span className="cat-title">{m.title}</span><span className="cat-price">{usd(m.price)}</span></button>)}</div></>}
  </div>;
}

// Order progress: every step is driven by the real order record (GET /orders/:id), revealed one at a time.
function Progress({ orderId, ppId, onDone }: { orderId: string; ppId?: string; onDone: () => void }) {
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
  const physical = (o?.items || []).filter((i: any) => !i.digital); const digital = (o?.items || []).filter((i: any) => i.digital);
  const sup = o?.supplier || []; const pays = o?.payouts || [];
  const steps = [
    { t: 'Payment received', d: o?.captureStatus ? <>Captured via PayPal · <code data-testid="capture-status">CAPTURE {o.captureStatus}</code></> : o?.status === 'COMPLETED' ? 'Captured via PayPal' : 'Waiting for PayPal…', done: o?.status === 'COMPLETED' },
    { t: 'Order created', d: o ? [...physical.map((i: any) => `${i.name} → Printful`), ...digital.map((i: any) => `${i.name} → PDF ready`)].join(' · ') : '…', done: o?.status === 'COMPLETED' && Array.isArray(o?.supplier) },
    { t: 'AI staff fulfilling', d: sup.length ? sup.map((s: any) => `${s.mode === 'simulated' ? 'Simulated supplier' : 'Printful draft'} #${s.id ?? '—'} (${s.status})`).join(' · ') + (digital.length ? ' · e-book delivered' : '') : digital.length ? 'Writer agent delivered your e-book' : 'Staff are packing your order…', done: Array.isArray(o?.payouts) },
    { t: 'Staff paid via PayPal Payouts', d: pays.length ? pays.map((p: any) => `${p.agent} ${usd(p.amount)} · ${p.method} ${p.status}`).join(' · ') : Array.isArray(o?.payouts) ? 'No payout — blocked by guardrails (see ledger)' : 'Wages released once fulfilment completes', done: Array.isArray(o?.payouts) && (pays.length === 0 || pays.some((p: any) => p.ok !== false)) },
  ];
  const real = steps.findIndex((s) => !s.done); const target = real === -1 ? steps.length : real;
  useEffect(() => { if (shown >= target) return; const t = setTimeout(() => setShown((s) => s + 1), 900); return () => clearTimeout(t); }, [shown, target]);
  if (err) return <div className="cat-empty">We couldn’t load that order. <span>{err}</span></div>;
  return <div className="cat-pad" data-testid="cat-progress">
    <div className="cat-thanks"><p className="cat-eyebrow">Thank you</p><h1 className="cat-h2">{o?.status === 'COMPLETED' ? <>Your order is<br />on its way.</> : o?.failure ? 'Payment didn’t complete.' : <>Confirming your<br />payment…</>}</h1>
      <p className="cat-ord">Order #{orderId.slice(2, 10).toUpperCase()} · {o ? usd(o.total) : '…'}</p></div>
    <div className="cat-progh"><h2>Progress</h2><span>{shown < steps.length ? 'Live' : 'Complete'}</span></div>
    <ol className="cat-steps">{steps.map((s, i) => { const st = i < shown ? 'done' : i === shown ? 'now' : 'todo'; return <li key={s.t} className={st} data-testid={`step-${i}`} data-state={st}><span className="dot">{st === 'done' ? <Ic d={I.check} /> : null}</span><div><p>{s.t}</p><small>{s.d}</small></div></li>; })}</ol>
    {o?.failure && o.status !== 'COMPLETED' && <p className="cat-err">{o.failure}</p>}
    {shown >= 2 && o?.downloads?.map((d: any) => <a key={d.pdf} className="cat-cta brass" href={'/api' + d.pdf} data-testid="cat-download">Download {d.title}</a>)}
    {shown >= steps.length && <button className="cat-cta ghost" onClick={onDone} data-testid="cat-done">Done</button>}
    <a className="cat-link" href="/ledger">See it on the public ledger →</a>
  </div>;
}
