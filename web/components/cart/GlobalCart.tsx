'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useCart, cart, MAX_STORES, MAX_QTY } from '@/lib/cart';
import { usd, thumb } from '@/lib/api';
import { PayButton } from '@/components/PayButton';
import { Progress } from './Progress';
const Svg = ({ children }: { children: React.ReactNode }) => <svg viewBox="0 0 24 24" aria-hidden>{children}</svg>;
const Bag = () => <Svg><path d="M5 8h14l-1 12H6L5 8z" /><path d="M9 8V6a3 3 0 016 0v2" /></Svg>;
export function CartButton({ className = '', onClick }: { className?: string; onClick?: () => void }) {
  const c = useCart();
  return <button className={`hc-cartbtn ${className}`} onClick={() => (onClick ? onClick() : cart.openCart())} aria-label={`Cart, ${c.count} items`} data-testid="global-cart-btn"><Bag />{c.count > 0 && <b data-testid="global-cart-count">{c.count}</b>}</button>;
}
function Qty({ v, set }: { v: number; set: (n: number) => void }) {
  return <div className="cat-qty" role="group" aria-label="Quantity"><button onClick={() => set(v - 1)} aria-label="Decrease quantity"><Svg><path d="M5 12h14" /></Svg></button><span aria-live="polite">{v}</span><button onClick={() => set(Math.min(MAX_QTY, v + 1))} aria-label="Increase quantity"><Svg><path d="M12 5v14M5 12h14" /></Svg></button></div>;
}
// The one cart sheet for the whole site: grouped by store, per-store subtotal, grand total, ONE PayPal checkout.
export function GlobalCart() {
  const c = useCart(); const over = c.stores.length > MAX_STORES;
  useEffect(() => { const u = new URL(window.location.href); if (u.searchParams.get('cart') === '1') { cart.openCart(); u.searchParams.delete('cart'); window.history.replaceState(null, '', u.pathname + u.search + u.hash); } }, []);
  useEffect(() => { if (!c.open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); cart.close(); } }; window.addEventListener('keydown', k, true); return () => window.removeEventListener('keydown', k, true); }, [c.open]);
  return <AnimatePresence>{c.open && <motion.div className="cat-overlay hc-cart-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    {c.orderId ? <motion.div className="cat-panel" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} role="dialog" aria-label="Order progress"><div className="cat-scroll"><Progress orderId={c.orderId} ppId={c.ppId} onDone={() => cart.close()} /></div></motion.div> : <>
    <motion.div className="cat-scrim" onClick={() => cart.close()} />
    <motion.section className="cat-sheet hc-gsheet" role="dialog" aria-label="Your bag" initial={{ y: '100%' }} animate={{ y: 0, transition: { type: 'spring', stiffness: 320, damping: 34 } }} exit={{ y: '100%', transition: { duration: .22 } }} data-testid="cat-cart">
      <div className="cat-grab" /><div className="cat-sheet-head"><div><p className="cat-eyebrow">Your bag · {c.stores.length} {c.stores.length === 1 ? 'store' : 'stores'}</p><h2 className="cat-h2">{c.count} {c.count === 1 ? 'piece' : 'pieces'}</h2></div><button className="cat-ic" onClick={() => cart.close()} aria-label="Close bag"><Svg><path d="M6 6l12 12M18 6L6 18" /></Svg></button></div>
      {!c.lines.length ? <div className="cat-empty">Your bag is empty. Walk into any store in the city and add something you love.</div> : <>
        {c.stores.map((g) => <div key={g.shopId} className="hc-store" data-testid="cart-store" data-shop={g.shopId}>
          <div className="hc-store-h">{g.shopLogo ? <img src={thumb(g.shopLogo, 64)} alt="" /> : <span />}<div className="flex-1 min-w-0"><p className="hc-store-n">{g.shopName}</p><p className="hc-store-o">by {g.owner || 'HollowCo'}</p></div><span className="hc-store-sub" data-testid="store-subtotal">{usd(g.subtotal)}</span></div>
          {g.lines.map((l) => <div key={l.productId} className="cat-line" data-testid="cat-line"><span className="cat-line-img">{l.image && <img src={thumb(l.image, 128)} alt="" />}</span><div className="flex-1 min-w-0"><p className="cat-line-t">{l.title}</p><p className="cat-line-s">{l.digital ? 'Instant download · PDF' : 'Printful · ships 5–8 days'}</p>
            <Qty v={l.qty} set={(n) => cart.setQty(l.shopId, l.productId, n)} /></div><span className="cat-line-p">{usd(l.price * l.qty)}</span></div>)}
        </div>)}
        <dl className="cat-sum">{c.stores.map((g) => <div key={g.shopId}><dt>{g.shopName}</dt><dd>{usd(g.subtotal)}</dd></div>)}{c.lines.some((l) => !l.digital) && <div><dt>Shipping (Printful)</dt><dd>Included</dd></div>}<div className="tot"><dt>Total</dt><dd data-testid="cat-total">{usd(c.total)}</dd></div></dl>
        {over ? <p className="cat-err" role="alert" data-testid="cart-too-many">PayPal can take at most {MAX_STORES} stores in one checkout. Remove {c.stores.length - MAX_STORES} store{c.stores.length - MAX_STORES > 1 ? 's' : ''} and check them out separately.</p>
        : <div className="cat-pay"><p className="cat-pay-h"><span>Secure payment · PayPal · one checkout</span><span className="cat-chip">sandbox</span></p>
          <PayButton key={JSON.stringify(c.lines.map((l) => [l.shopId, l.productId, l.qty]))} shopId={c.stores[0].shopId} stores={c.stores.map((g) => ({ shopId: g.shopId, items: g.lines.map((l) => ({ productId: l.productId, qty: l.qty })) }))} color="gold"
            onDone={(o, rec) => { cart.clear(); o ? cart.showOrder(o.id) : cart.showOrder(rec!.orderId, rec!.ppId); }} />
          <p className="cat-fine">Test card: set Country to United States, use a US billing address, then “Pay now as guest”.</p></div>}
      </>}
    </motion.section></>}
  </motion.div>}</AnimatePresence>;
}
