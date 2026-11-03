'use client';
import { useSyncExternalStore } from 'react';
// ONE global cart for the whole site (every store, every page, while flying around the city). Persisted in localStorage.
export type CartLine = { shopId: string; productId: string; qty: number; title: string; price: number; image?: string; digital: boolean; kind: string; shopName: string; shopLogo?: string; owner?: string };
export const MAX_STORES = 10; export const MAX_QTY = 5;
const KEY = 'hc:cart:v2';
type State = { lines: CartLine[]; open: boolean; orderId?: string; ppId?: string };
let state: State = { lines: [], open: false }; let loaded = false; const subs = new Set<() => void>();
const load = () => { if (loaded || typeof window === 'undefined') return; loaded = true; try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(v)) state = { ...state, lines: v }; } catch {} 
  window.addEventListener('storage', (e) => { if (e.key === KEY) { try { state = { ...state, lines: JSON.parse(e.newValue || '[]') }; } catch {} emit(); } }); };
const emit = () => subs.forEach((f) => f());
const set = (p: Partial<State>) => { state = { ...state, ...p }; if (p.lines) try { localStorage.setItem(KEY, JSON.stringify(state.lines)); } catch {} emit(); };
const EMPTY: State = { lines: [], open: false };
export function useCart() {
  const s = useSyncExternalStore((f) => { load(); subs.add(f); return () => subs.delete(f); }, () => (load(), state), () => EMPTY);
  return { ...s, ...cart, count: s.lines.reduce((n, l) => n + l.qty, 0), total: Math.round(s.lines.reduce((n, l) => n + l.qty * l.price, 0) * 100) / 100, stores: groupByStore(s.lines) };
}
export function groupByStore(lines: CartLine[]) {
  const m = new Map<string, { shopId: string; shopName: string; shopLogo?: string; owner?: string; lines: CartLine[]; subtotal: number }>();
  for (const l of lines) { const g = m.get(l.shopId) || { shopId: l.shopId, shopName: l.shopName, shopLogo: l.shopLogo, owner: l.owner, lines: [], subtotal: 0 }; g.lines.push(l); g.subtotal = Math.round((g.subtotal + l.price * l.qty) * 100) / 100; m.set(l.shopId, g); }
  return [...m.values()];
}
export const cart = {
  add(l: Omit<CartLine, 'qty'> & { comingSoon?: boolean }, n = 1) {
    if (l.comingSoon || !(l.price > 0)) return false; load();
    const { comingSoon, ...line } = l as any; const lines = state.lines.map((x) => ({ ...x })); const ex = lines.find((x) => x.shopId === l.shopId && x.productId === l.productId);
    if (ex) ex.qty = Math.min(MAX_QTY, ex.qty + n); else lines.push({ ...line, qty: Math.min(MAX_QTY, n) });
    set({ lines }); return true;
  },
  setQty(shopId: string, productId: string, n: number) { load(); set({ lines: n > 0 ? state.lines.map((x) => x.shopId === shopId && x.productId === productId ? { ...x, qty: Math.min(MAX_QTY, n) } : x) : state.lines.filter((x) => !(x.shopId === shopId && x.productId === productId)) }); },
  removeStore(shopId: string) { load(); set({ lines: state.lines.filter((x) => x.shopId !== shopId) }); },
  clear() { set({ lines: [] }); },
  openCart() { set({ open: true, orderId: undefined, ppId: undefined }); },
  close() { set({ open: false, orderId: undefined, ppId: undefined }); },
  showOrder(orderId: string, ppId?: string) { set({ open: true, orderId, ppId }); },
};
