// The AI only PROPOSES. This module decides. Hard limits live in code, not in prompts.
export const LIMITS = {
  minPrice: 1, maxPrice: 60,
  maxPayoutPerTask: 5,
  maxPayoutPctOfRevenue: 0.3,
  dailyPayoutCap: 50,
  allowedRecipients: ['sb-vkeld53675758@personal.example.com'],
  allowedCurrencies: ['USD'],
};
export type Verdict = { ok: true } | { ok: false; reasons: string[] };
export function checkPrice(p: any): Verdict {
  const r: string[] = [];
  if (typeof p !== 'number' || !Number.isFinite(p)) r.push('price is not a number');
  else { if (p < LIMITS.minPrice) r.push(`price ${p} below min ${LIMITS.minPrice}`); if (p > LIMITS.maxPrice) r.push(`price ${p} above max ${LIMITS.maxPrice}`); }
  return r.length ? { ok: false, reasons: r } : { ok: true };
}
export function checkPayout(p: { recipient: any; amount: any; currency?: any }, orderRevenue: number, paidToday: number, paidThisOrder: number): Verdict {
  const r: string[] = [];
  const a = p.amount;
  if (typeof a !== 'number' || !Number.isFinite(a) || a <= 0) r.push('amount must be a positive number');
  else {
    if (a > LIMITS.maxPayoutPerTask) r.push(`amount ${a} exceeds max per task ${LIMITS.maxPayoutPerTask}`);
    if (paidThisOrder + a > orderRevenue * LIMITS.maxPayoutPctOfRevenue) r.push(`payouts would exceed ${LIMITS.maxPayoutPctOfRevenue * 100}% of order revenue (${orderRevenue.toFixed(2)})`);
    if (paidToday + a > LIMITS.dailyPayoutCap) r.push(`would exceed daily payout cap ${LIMITS.dailyPayoutCap}`);
  }
  if (!LIMITS.allowedRecipients.includes(String(p.recipient).toLowerCase())) r.push(`recipient ${String(p.recipient).slice(0, 80)} not allowlisted`);
  if (p.currency && !LIMITS.allowedCurrencies.includes(p.currency)) r.push(`currency ${p.currency} not allowed`);
  return r.length ? { ok: false, reasons: r } : { ok: true };
}
