'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export type FounderThought = { k: string; t: string; at: string; shop?: string };

export const thoughtKind = (k: string) => (k === 'decision' ? 'decision memo' : k === 'rejected' ? 'blocked by code' : k);

/** Real, non-simulated ledger events (decision memos, payouts, blocked proposals). Nothing is generated client-side. */
export function useFounderThoughts() {
  const [items, setItems] = useState<FounderThought[]>([]);
  const [i, setI] = useState(0);
  useEffect(() => {
    let on = true;
    const load = () => api('/ledger').then((d: any) => {
      if (!on) return;
      const ev = (d?.events || []).filter((e: any) => !e.sim && !e.test && ['decision', 'payout', 'rejected', 'refund', 'revenue'].includes(e.kind)).sort((a: any, b: any) => String(b.at).localeCompare(String(a.at))).slice(0, 8);
      setItems(ev.map((e: any) => ({
        k: e.kind, at: e.at, shop: e.shop,
        t: e.kind === 'decision' ? String(e.detail || '').split('. ').slice(0, 2).join('. ')
          : e.kind === 'payout' ? `Paid ${e.agent || 'staff'} $${Number(e.amount || 0).toFixed(2)}${e.reason ? ` — “${String(e.reason).slice(0, 60)}”` : ''}`
          : e.kind === 'revenue' ? `Sale captured: $${Number(e.amount || 0).toFixed(2)} via PayPal checkout`
          : e.kind === 'refund' ? `Refunded $${Number(e.amount || 0).toFixed(2)} via PayPal`
          : `Blocked: ${(e.reasons || []).join('; ').slice(0, 110)}`,
      })).filter((x: FounderThought) => x.t));
    }).catch(() => {});
    load();
    const a = setInterval(load, 30000);
    const b = setInterval(() => setI((n) => n + 1), 7000);
    return () => { on = false; clearInterval(a); clearInterval(b); };
  }, []);
  return items.length ? items[i % items.length] : null;
}

export function useMaxMd(bp = 768) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const q = window.matchMedia(`(max-width: ${bp - 1}px)`);
    const upd = () => setMobile(q.matches);
    upd();
    q.addEventListener('change', upd);
    return () => q.removeEventListener('change', upd);
  }, [bp]);
  return mobile;
}

export const thoughtStamp = (at: string) => new Date(at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
