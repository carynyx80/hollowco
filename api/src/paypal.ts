import { env } from './env.js';
const BASE = env('PAYPAL_ENV', 'sandbox') === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
let tok: { v: string; exp: number } | null = null;
async function token() {
  if (tok && tok.exp > Date.now()) return tok.v;
  const r = await fetch(BASE + '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${env('PAYPAL_CLIENT_ID')}:${env('PAYPAL_CLIENT_SECRET')}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const j: any = await r.json();
  if (!r.ok) throw new Error('PayPal OAuth failed: ' + (j.error_description || r.status));
  tok = { v: j.access_token, exp: Date.now() + (j.expires_in - 60) * 1000 };
  return tok.v;
}
export async function pp(method: string, path: string, body?: any, extra: Record<string, string> = {}) {
  const r = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', ...extra }, body: body && JSON.stringify(body) });
  const j: any = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}
export const money = (n: number) => n.toFixed(2);
export async function createOrder(items: { name: string; price: number; qty: number; digital: boolean; sku: string }[], ref: string) {
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  return pp('POST', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: ref.slice(0, 256),
      amount: { currency_code: 'USD', value: money(total), breakdown: { item_total: { currency_code: 'USD', value: money(total) } } },
      items: items.map((i) => ({ name: i.name.slice(0, 127), sku: i.sku, quantity: String(i.qty), category: i.digital ? 'DIGITAL_GOODS' : 'PHYSICAL_GOODS', unit_amount: { currency_code: 'USD', value: money(i.price) } })),
    }],
  });
}
export const captureOrder = (id: string) => pp('POST', `/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {}, { Prefer: 'return=representation' });
export const getOrder = (id: string) => pp('GET', `/v2/checkout/orders/${encodeURIComponent(id)}`);
export async function payout(receiver: string, amount: number, note: string, itemId: string) {
  const r = await pp('POST', '/v1/payments/payouts', {
    sender_batch_header: { sender_batch_id: 'hc_' + itemId + '_' + Date.now(), email_subject: 'HollowCo agent payout', email_message: note },
    items: [{ recipient_type: 'EMAIL', amount: { value: money(amount), currency: 'USD' }, receiver, note, sender_item_id: itemId.slice(0, 63) }],
  });
  if (r.ok) return { ok: true, method: 'payouts', ref: r.j.batch_header.payout_batch_id, status: r.j.batch_header.batch_status };
  // Fallback: draft an invoice so the agent's claim is still recorded in PayPal.
  const i = await pp('POST', '/v2/invoicing/invoices', { detail: { currency_code: 'USD', note }, primary_recipients: [{ billing_info: { email_address: receiver } }], items: [{ name: note.slice(0, 200), quantity: '1', unit_amount: { currency_code: 'USD', value: money(amount) }, unit_of_measure: 'QUANTITY' }] });
  return { ok: i.ok, method: 'invoicing', ref: i.j.id || i.j.href || null, status: i.ok ? 'DRAFT' : 'FAILED', error: r.j.message };
}
