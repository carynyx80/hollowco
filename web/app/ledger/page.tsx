'use client';
import { useCallback, useEffect, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { api } from '@/lib/api';
import AgentProof from '@/components/judge/AgentProof';
ModuleRegistry.registerModules([AllCommunityModule]);
const theme = themeQuartz.withParams({ accentColor: '#B8975A', foregroundColor: '#0E0D0B', backgroundColor: '#FFFFFF', headerBackgroundColor: '#ECEAE3', headerTextColor: '#6F6B62', borderColor: '#DFDBD1', rowHoverColor: '#F4F2EC', oddRowBackgroundColor: '#FBFAF7', fontFamily: 'var(--font-ui)', headerFontSize: 11, headerFontWeight: 500, fontSize: 13, borderRadius: 6, wrapperBorderRadius: 6, spacing: 7, cellTextColor: '#0E0D0B' });
const usd = (p: any) => (p.value == null ? '' : `$${Number(p.value).toFixed(2)}`);
export default function Ledger() {
  const [d, setD] = useState<any>(null);
  const load = useCallback(() => api('/ledger').then(setD).catch(() => {}), []);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  const t = d?.totals;
  return (
    <div className="mx-auto max-w-6xl px-5 py-10 space-y-8">
      <div><p className="eyebrow">Transparency</p><h1 className="font-display text-4xl  mt-1">Live public P&amp;L</h1><p className="text-char/55 mt-2">Every cent in and out of every HollowCo company. Refreshes every 5s.</p></div>
      {t && <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[['Revenue', t.revenue], ['Supplier cost', t.supplierCost], ['Agent payouts', t.payouts], ['Profit', t.profit]].map(([k, v]) =>
          <div key={k as string} className="card p-5"><div className="text-xs text-char/55">{k}</div><div className="text-2xl font-semibold tabular-nums mt-1">${Number(v).toFixed(2)}</div></div>)}
      </div>}
      <section><h2 className="font-semibold mb-2">Profit per order</h2>
        <div style={{ height: 320 }}><AgGridReact theme={theme} rowData={d?.orders || []} columnDefs={[
          { field: 'at', headerName: 'Time', sort: 'desc', width: 190 }, { field: 'shop', flex: 1 }, { field: 'orderId', width: 200 },
          { field: 'revenue', valueFormatter: usd, width: 120 }, { field: 'supplierCost', valueFormatter: usd, width: 130 }, { field: 'payouts', headerName: 'Agent payouts', valueFormatter: usd, width: 140 },
          { field: 'profit', valueFormatter: usd, width: 120, cellStyle: (p: any) => ({ fontWeight: 700, color: p.value >= 0 ? '#4F7A47' : '#A6452F' }) },
          { field: 'rejected', headerName: 'Rejected', width: 110 }, { field: 'test', headerName: 'Test', width: 80 }, { field: 'sim', headerName: 'Simulated', width: 110, cellStyle: (p: any) => (p.value ? { color: '#5F6E5C' } : null) }]} /></div></section>
      <AgentProof />
      <section><h2 className="font-semibold mb-2">Event log (incl. rejected proposals)</h2>
        <div style={{ height: 420 }}><AgGridReact theme={theme} rowData={d?.events || []} columnDefs={[
          { field: 'at', headerName: 'Time', sort: 'desc', width: 190 }, { field: 'kind', width: 130, cellStyle: (p: any) => ((p.value === 'rejected' || p.value === 'agent_tool') ? { color: '#A6452F', fontWeight: 700 } : null) },
          { field: 'shop', width: 160 }, { field: 'agent', width: 100 }, { field: 'amount', valueFormatter: usd, width: 100 },
          { headerName: 'Detail', flex: 1, valueGetter: (p: any) => p.data.kind === 'agent_tool' ? p.data.detail : p.data.reasons ? `${JSON.stringify(p.data.proposal)} ⇒ ${p.data.reasons.join('; ')}` : p.data.detail }]} /></div></section>
    </div>
  );
}
