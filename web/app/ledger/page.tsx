'use client';
import { useCallback, useEffect, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { api } from '@/lib/api';
import AgentProof from '@/components/judge/AgentProof';
ModuleRegistry.registerModules([AllCommunityModule]);
const theme = themeQuartz.withParams({ accentColor: '#B8975A', foregroundColor: '#0E0D0B', backgroundColor: '#FFFFFF', headerBackgroundColor: '#ECEAE3', headerTextColor: '#6F6B62', borderColor: '#DFDBD1', rowHoverColor: '#F4F2EC', oddRowBackgroundColor: '#FBFAF7', fontFamily: 'var(--font-ui)', headerFontSize: 11, headerFontWeight: 500, fontSize: 13, borderRadius: 6, wrapperBorderRadius: 6, spacing: 7, cellTextColor: '#0E0D0B' });
const usd = (p: any) => (p.value == null ? '' : `$${Number(p.value).toFixed(2)}`);
const money = (n: any) => `$${Number(n || 0).toFixed(2)}`;
const when = (v: any) => { if (!v) return ''; const d = new Date(v); return isNaN(+d) ? String(v) : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); };
const time = (p: any) => when(p.value);
const tag = (o: any) => (o.sim ? 'Simulated' : o.test ? 'Test' : '');
const detail = (e: any) => e.kind === 'agent_tool' ? `${e.via === 'toolkit' ? 'PayPal Agent Toolkit · ' : ''}${e.tool || ''}${e.decision ? ` (${e.decision})` : ''} — ${e.detail || ''}` : e.reasons ? `${JSON.stringify(e.proposal)} ⇒ ${e.reasons.join('; ')}` : e.detail;
function useMobile() { const [m, setM] = useState(false); useEffect(() => { const q = window.matchMedia('(max-width: 767px)'); const f = () => setM(q.matches); f(); q.addEventListener('change', f); return () => q.removeEventListener('change', f); }, []); return m; }
const Skel = ({ h }: { h: number }) => <div className="rounded-md border border-black/[.08] bg-white p-3 space-y-2" style={{ height: h }} data-testid="ledger-skeleton">{Array.from({ length: Math.max(3, Math.floor(h / 44)) }).map((_, i) => <div key={i} className="h-7 rounded bg-beige animate-pulse" />)}</div>;
const orderCols: any[] = [
  { field: 'at', headerName: 'Time', sort: 'desc', width: 150, valueFormatter: time }, { field: 'shop', headerName: 'Shop', flex: 1, minWidth: 220, tooltipField: 'shop' },
  { field: 'revenue', valueFormatter: usd, width: 110 }, { field: 'fees', headerName: 'PayPal fee', valueFormatter: usd, width: 110 }, { field: 'supplierCost', headerName: 'Supplier', valueFormatter: usd, width: 110 }, { field: 'payouts', headerName: 'Agent payouts', valueFormatter: usd, width: 130 },
  { field: 'profit', valueFormatter: usd, width: 110, cellStyle: (p: any) => ({ fontWeight: 700, color: p.value >= 0 ? '#4F7A47' : '#A6452F' }) },
  { field: 'rejected', headerName: 'Blocked', width: 95 }, { field: 'orderId', headerName: 'Order', width: 170 }];
function OrderCards({ rows, empty }: { rows: any[]; empty: string }) {
  if (!rows.length) return <p className="text-sm text-char/60 py-4">{empty}</p>;
  return <ul className="space-y-2">{[...rows].sort((a, b) => String(b.at).localeCompare(String(a.at))).map((o) => <li key={o.orderId} className="rounded-md border border-black/[.08] bg-white p-3 text-sm">
    <div className="flex justify-between gap-3"><span className="font-medium">{o.shop}{tag(o) && <span className="ml-1.5 font-mono text-[10px] uppercase text-char/60">{tag(o)}</span>}</span><span className="tabular-nums font-semibold">{money(o.revenue)}</span></div>
    <div className="mt-1 flex justify-between text-xs text-char/60"><span>{when(o.at)}</span><span>fee {money(o.fees)} · supplier {money(o.supplierCost)} · staff {money(o.payouts)} · <b className={o.profit >= 0 ? 'text-[#4F7A47]' : 'text-[#A6452F]'}>profit {money(o.profit)}</b></span></div></li>)}</ul>;
}
export default function Ledger() {
  const [d, setD] = useState<any>(null); const mobile = useMobile(); const [showSim, setShowSim] = useState(false);
  const load = useCallback(() => api('/ledger').then(setD).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  const t = d?.totals; const st = d?.simulatedTotals;
  const real = (d?.orders || []).filter((o: any) => !o.test && !o.sim); const fake = (d?.orders || []).filter((o: any) => o.test || o.sim);
  const events = (d?.events || []).filter((e: any) => showSim || (!e.sim && !e.test));
  const grid = (rows: any[], cols: any[], h: number) => !d ? <Skel h={h} /> : <div style={{ height: h }}><AgGridReact theme={theme} rowData={rows} columnDefs={cols} overlayNoRowsTemplate="Nothing here yet." /></div>;
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 space-y-8">
      <div><p className="eyebrow">Transparency</p><h1 className="font-display text-4xl  mt-1">Live public P&amp;L</h1><p className="text-char/60 mt-2">Every cent in and out of every HollowCo company, from real PayPal sandbox orders. Refreshes every 5s.</p></div>
      {t ? <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[['Revenue', t.revenue], ['PayPal fees', t.fees], ['Supplier cost', t.supplierCost], ['Agent payouts', t.payouts], ['Profit', t.profit]].map(([k, v]) =>
          <div key={k as string} className="card p-5"><div className="text-xs text-char/60">{k}</div><div className="text-2xl font-semibold tabular-nums mt-1">{money(v)}</div></div>)}
      </div> : <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{[0, 1, 2, 3].map((i) => <div key={i} className="card p-5 h-[84px] animate-pulse" />)}</div>}
      {st && <p className="text-xs text-char/60 -mt-4" data-testid="sim-note">Totals count {t.orders} real sandbox order{t.orders === 1 ? '' : 's'} only. {st.orders} test/simulated order{st.orders === 1 ? '' : 's'} ({money(st.revenue)}, no money moved) are excluded and listed separately below.</p>}
      <section><h2 className="font-semibold mb-2">Profit per order</h2>
        {mobile ? (d ? <OrderCards rows={real} empty="No real orders yet." /> : <Skel h={240} />) : grid(real, orderCols, 320)}</section>
      <AgentProof />
      <section><h2 className="font-semibold mb-2">Event log (incl. blocked proposals and PayPal Agent Toolkit calls)</h2>
        <label className="text-xs text-char/60 flex items-center gap-2 mb-2"><input type="checkbox" checked={showSim} onChange={(e) => setShowSim(e.target.checked)} /> Include test / simulated rows</label>
        {mobile ? (d ? <ul className="space-y-2">{[...events].sort((a: any, b: any) => String(b.at).localeCompare(String(a.at))).slice(0, 80).map((e: any, i: number) => <li key={i} className="rounded-md border border-black/[.08] bg-white p-3 text-xs">
          <div className="flex justify-between gap-2"><span className={`font-mono uppercase ${e.kind === 'rejected' ? 'text-[#A6452F]' : e.kind === 'agent_tool' ? 'text-brass' : 'text-char/70'}`}>{e.kind}{(e.sim || e.test) && ' · sim'}</span><span className="text-char/60">{when(e.at)}</span></div>
          <div className="mt-1"><b>{e.shop}</b>{e.amount != null && <span className="tabular-nums"> {money(e.amount)}</span>}</div><div className="text-char/60 break-words">{detail(e)}</div></li>)}</ul> : <Skel h={300} />)
          : grid(events, [
          { field: 'at', headerName: 'Time', sort: 'desc', width: 150, valueFormatter: time }, { field: 'kind', width: 130, cellStyle: (p: any) => (p.value === 'rejected' ? { color: '#A6452F', fontWeight: 700 } : p.value === 'agent_tool' ? { color: '#8C6F3C', fontWeight: 700 } : null) },
          { field: 'shop', width: 200, tooltipField: 'shop' }, { field: 'agent', width: 100 }, { field: 'amount', valueFormatter: usd, width: 100 },
          { headerName: 'Detail', flex: 1, minWidth: 300, tooltipValueGetter: (p: any) => detail(p.data), valueGetter: (p: any) => `${p.data.sim || p.data.test ? '[SIMULATED] ' : ''}${detail(p.data)}`.replace('[SIMULATED] [SIMULATED]', '[SIMULATED]') }], 420)}</section>
      {fake.length > 0 && <section><h2 className="font-semibold mb-1">Test &amp; simulated orders <span className="text-xs font-normal text-char/60">— excluded from all totals, no money moved</span></h2>
        {mobile ? <OrderCards rows={fake} empty="" /> : grid(fake, orderCols, 260)}</section>}
    </div>
  );
}
