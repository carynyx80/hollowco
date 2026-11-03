'use client';
import { useSyncExternalStore } from 'react';
// ONE global cart for the whole site (every store, every page, while flying around the city). Persisted in localStorage.
export type CartLine = { shopId: string; productId: string; qty: number; title: string; price: number; image?: string; digital: boolean; kind: string; shopName: string; shopLogo?: string; owner?: string };
export const MAX_STORES = 10; export const MAX_QTY = 5;
const KEY = 'hc:cart:v2';
// Two modes. 'guest': lines live in this browser's localStorage. 'user': lines live ONLY on the server, keyed by the
// session cookie's account (GET/PUT /api/cart) — never written to localStorage, so accounts can't bleed into each other.
type State = { lines: CartLine[]; open: boolean; orderId?: string; ppId?: string; mode: 'guest' | 'user'; uid?: string; syncing?: boolean };
let state: State = { lines: [], open: false, mode: 'guest' }; let loaded = false; const subs = new Set<() => void>();
let epoch = 0; let seq = 0; let timer: any = null;
const readLocal = (): CartLine[] => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const load = () => { if (loaded || typeof window === 'undefined') return; loaded = true; state = { ...state, lines: readLocal() };
  window.addEventListener('storage', (e) => { if (e.key === KEY && state.mode === 'guest') { try { state = { ...state, lines: JSON.parse(e.newValue || '[]') }; } catch {} emit(); } }); };
const emit = () => subs.forEach((f) => f());
const call = async (method: string, body?: any) => { const r = await fetch('/api/cart', { method, credentials: 'same-origin', cache: 'no-store', headers: body ? { 'content-type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined }); if (!r.ok) throw Object.assign(new Error('cart ' + r.status), { status: r.status }); return r.json(); };
const pushServer = () => { clearTimeout(timer); const e = epoch, mine = ++seq; timer = setTimeout(async () => {
  try { const j = await call('PUT', { lines: state.lines.map(({ shopId, productId, qty }) => ({ shopId, productId, qty })) }); if (e === epoch && mine === seq) { state = { ...state, lines: j.lines }; emit(); } } catch {}
}, 250); };
const set = (p: Partial<State>) => { state = { ...state, ...p }; if (p.lines) { if (state.mode === 'guest') { try { localStorage.setItem(KEY, JSON.stringify(state.lines)); } catch {} } else pushServer(); } emit(); };
/** Called by AuthProvider whenever the signed-in account changes (sign-in, sign-up, sign-out, page load). */
export async function bindUser(uid: string | null) {
  if (typeof window === 'undefined') return; load();
  if ((uid || undefined) === state.uid && (uid ? state.mode === 'user' : state.mode === 'guest')) return;
  const e = ++epoch; clearTimeout(timer);
  if (!uid) { // signed out: wipe everything so the next person on this browser sees nothing of the previous account
    const wasUser = state.mode === 'user'; state = { ...state, mode: 'guest', uid: undefined, lines: wasUser ? [] : readLocal(), orderId: undefined, ppId: undefined };
    if (wasUser) try { localStorage.removeItem(KEY); } catch {}
    emit(); return;
  }
  const guest = state.mode === 'guest' ? readLocal() : [];
  state = { ...state, mode: 'user', uid, lines: [], syncing: true, orderId: undefined, ppId: undefined }; emit();
  try {
    const j = guest.length ? await call('PUT', { merge: true, lines: guest.map(({ shopId, productId, qty }) => ({ shopId, productId, qty })) }) : await call('GET');
    if (guest.length) try { localStorage.removeItem(KEY); } catch {}
    if (e === epoch) { state = { ...state, lines: j.lines, syncing: false }; emit(); }
  } catch { if (e === epoch) { state = { ...state, syncing: false }; emit(); } }
}
const EMPTY: State = { lines: [], open: false, mode: 'guest' };
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
