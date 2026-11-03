'use client';
const m = (n: any) => `$${Number(n || 0).toFixed(2)}`;
/** One store's P&L from ledger rows: revenue → PayPal fee → supplier → AI staff → profit. */
export function PnLBar({ s }: { s: any }) {
  const rev = Math.max(0.01, s.revenue);
  const parts = [['PayPal fees', s.fees, '#8A867C'], ['Supplier', s.supplierCost, '#6F6B62'], ['AI staff', s.payouts, '#B8975A'], ['Profit', Math.max(0, s.profit), '#0E0D0B']] as const;
  return <div>
    <div className="flex h-2 w-full overflow-hidden rounded-sm bg-beige" role="img" aria-label={`Revenue ${m(s.revenue)}: fees ${m(s.fees)}, supplier ${m(s.supplierCost)}, staff ${m(s.payouts)}, profit ${m(s.profit)}`}>
      {parts.map(([k, v, c]) => <span key={k} style={{ width: `${(Math.max(0, v) / rev) * 100}%`, background: c }} />)}</div>
    <dl className="mt-2 grid grid-cols-3 sm:grid-cols-5 gap-x-3 gap-y-2 text-xs text-char/65">
      {[['Revenue', s.revenue], ...parts.map(([k, v]) => [k, k === 'Profit' ? s.profit : v])].map(([k, v]) => <div key={k as string}><dt>{k}</dt><dd className="font-mono text-char tabular-nums text-sm">{m(v)}</dd></div>)}
    </dl>
  </div>;
}
