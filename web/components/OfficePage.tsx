'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { HollowOffice } from '@/components/HollowOffice';
import { useToast } from '@/components/Toast';
import { api } from '@/lib/api';
export function OfficePage({ shop }: { shop?: string }) {
  const [ev, setEv] = useState<any[] | undefined>(); const [sim, setSim] = useState(false); const toast = useToast();
  const sp = useSearchParams(); const auto = sp.get('replay') === '1';
  const load = useCallback(() => api('/activity?limit=100').then((a: any[]) => setEv(shop ? a.filter((e) => e.shopId === shop || (e.kind === 'rejected' && !e.orderId)) : a)).catch(() => {}), [shop]);
  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, [load]);
  async function simulate() { setSim(true); try { await api('/simulate/order', { method: 'POST', body: JSON.stringify(shop ? { shopId: shop } : {}) }); await load(); } catch (e: any) { toast(e.message, 'err'); } finally { setSim(false); } }
  async function jailbreak(message: string) { try { await api('/jailbreak', { method: 'POST', body: JSON.stringify({ message }) }); await load(); } catch (e: any) { toast(e.message, 'err'); } }
  return <div className="mx-auto max-w-7xl px-5 py-8 space-y-4">
    <div className="flex flex-wrap items-end gap-3"><div><p className="eyebrow">Live HQ</p><h1 className="font-display text-4xl mt-1">The Hollow <span className="italic text-coral-600">Office</span></h1>
      <p className="text-sm text-char/55 mt-1">A company with nobody in it. Every move below is a real ledger event: sales, Printful drafts, PayPal payouts and blocked jailbreaks.</p></div>
      <Link href="/" className="ml-auto text-sm text-char/60 hover:text-char">Marketplace →</Link></div>
    <HollowOffice events={ev} shopId={shop} pending={sim} onSimulate={simulate} simBusy={sim} onJailbreak={jailbreak} autoReplay={auto} scope={shop ? 'one shop · public' : 'site-wide · public · last 100 events'} />
  </div>;
}
