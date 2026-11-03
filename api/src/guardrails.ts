// The AI only PROPOSES. This module decides. Hard limits live in code, not in prompts.
// Staff agents (writer/designer) are paid to this US sandbox personal account. sb-vkeld (NG) is buyer only.
export const STAFF_PAYEE = 'sb-7ygua53685681@personal.example.com';
// Sandbox BUYER (customer). Never a payee; the founder may only bill it (B2B invoice demo).
export const SANDBOX_BUYER = 'sb-vkeld53675758@personal.example.com';
export const INVOICE_RECIPIENTS = [STAFF_PAYEE, SANDBOX_BUYER];
// Physical items must leave margin over Printful cost for payouts.
export const MIN_PRICE: Record<string, number> = { tshirt: 29, mug: 22 };
export const floorPrice = (kind: string, p: number) => Math.max(MIN_PRICE[kind] || 0, p);
export const LIMITS = {
  minPrice: 1, maxPrice: 60,
  maxPayoutPerTask: 5,
  maxPayoutPctOfMargin: 0.3,
  get maxPayoutPctOfRevenue() { return this.maxPayoutPctOfMargin; }, // legacy alias; base is margin (revenue − PayPal fee − supplier)
  dailyPayoutCap: 50,
  allowedRecipients: [STAFF_PAYEE],
  allowedCurrencies: ['USD'],
};
export type Verdict = { ok: true } | { ok: false; reasons: string[] };
export function checkPrice(p: any): Verdict {
  const r: string[] = [];
  if (typeof p !== 'number' || !Number.isFinite(p)) r.push('price is not a number');
  else { if (p < LIMITS.minPrice) r.push(`price ${p} below min ${LIMITS.minPrice}`); if (p > LIMITS.maxPrice) r.push(`price ${p} above max ${LIMITS.maxPrice}`); }
  return r.length ? { ok: false, reasons: r } : { ok: true };
}
export function checkPayout(p: { recipient: any; amount: any; currency?: any }, orderMargin: number, paidToday: number, paidThisOrder: number): Verdict {
  const r: string[] = [];
  const a = p.amount;
  if (typeof a !== 'number' || !Number.isFinite(a) || a <= 0) r.push('amount must be a positive number');
  else {
    if (a > LIMITS.maxPayoutPerTask) r.push(`amount ${a} exceeds max per task ${LIMITS.maxPayoutPerTask}`);
    if (paidThisOrder + a > orderMargin * LIMITS.maxPayoutPctOfMargin) r.push(`payouts would exceed ${LIMITS.maxPayoutPctOfMargin * 100}% of order margin (${orderMargin.toFixed(2)})`);
    if (paidToday + a > LIMITS.dailyPayoutCap) r.push(`would exceed daily payout cap ${LIMITS.dailyPayoutCap}`);
  }
  if (!LIMITS.allowedRecipients.includes(String(p.recipient).toLowerCase())) r.push(`recipient ${String(p.recipient).slice(0, 80)} not allowlisted`);
  if (p.currency && !LIMITS.allowedCurrencies.includes(p.currency)) r.push(`currency ${p.currency} not allowed`);
  return r.length ? { ok: false, reasons: r } : { ok: true };
}
// Refunds: only the store owner, only real captured orders, only once, never more than was captured, within 180 days.
export const REFUND_WINDOW_DAYS = 180;
export function checkRefund(o: any, actorId: string | null, shopOwnerId: string | null, amount: number, now = Date.now()): Verdict {
  const r: string[] = [];
  if (!actorId || actorId !== shopOwnerId) r.push('only the store owner can refund this order');
  if (!o || o.status !== 'COMPLETED' || !o.captureId) r.push('order has no completed PayPal capture');
  if (o?.simulated || o?.test) r.push('simulated/test orders have nothing to refund');
  if (o?.refund) r.push('order already refunded');
  const cap = Number(o?.capturedAmount ?? o?.total ?? 0);
  if (!(amount > 0) || amount > cap + 1e-9) r.push(`refund must be between $0.01 and the captured $${cap.toFixed(2)}`);
  if (o?.createdAt && now - Date.parse(o.createdAt) > REFUND_WINDOW_DAYS * 86_400_000) r.push(`outside ${REFUND_WINDOW_DAYS}-day refund window`);
  return r.length ? { ok: false, reasons: r } : { ok: true };
}
