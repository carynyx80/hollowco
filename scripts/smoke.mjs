import fs from 'node:fs';
const env = {};
for (const l of fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*"?([^"]*)"?\s*$/); if (m) env[m[1]] = m[2];
}
const ID = env.PAYPAL_CLIENT_ID, SECRET = process.env.PAYPAL_CLIENT_SECRET || env.PAYPAL_CLIENT_SECRET;
const BASE = 'https://api-m.sandbox.paypal.com';
let token;
async function call(method, path, body) {
  const r = await fetch(BASE + path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}
const err = (j) => `${j.name || j.error} — ${j.message || j.error_description}${j.details ? ' ' + JSON.stringify(j.details) : ''}`;
// 1
const t = await fetch(BASE + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${ID}:${SECRET}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
const tj = await t.json();
if (!t.ok) { console.log('1) OAuth FAIL', t.status, err(tj)); process.exit(1); }
token = tj.access_token; console.log(`1) OAuth OK (expires_in ${tj.expires_in}s)`);
// 2
const o = await call('POST', '/v2/checkout/orders', { intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: 'USD', value: '5.00', breakdown: { item_total: { currency_code: 'USD', value: '5.00' } } }, items: [{ name: 'Zero-Person Co Digital Report', quantity: '1', category: 'DIGITAL_GOODS', unit_amount: { currency_code: 'USD', value: '5.00' } }] }] });
if (o.ok) console.log(`2) Order OK id=${o.j.id} status=${o.j.status} approve=${o.j.links.find(l => l.rel === 'approve')?.href}`);
else console.log('2) Order FAIL', o.status, err(o.j));
// 3
const p = await call('POST', '/v1/payments/payouts', { sender_batch_header: { sender_batch_id: 'zpc_' + Date.now(), email_subject: 'Payout', email_message: 'Smoke test payout' }, items: [{ recipient_type: 'EMAIL', amount: { value: '1.00', currency: 'USD' }, receiver: 'sb-vkeld53675758@personal.example.com', note: 'smoke', sender_item_id: 'i1' }] });
let payoutFail = !p.ok;
if (p.ok) {
  const bid = p.j.batch_header.payout_batch_id;
  console.log(`3) Payout created batch=${bid} status=${p.j.batch_header.batch_status}`);
  await new Promise(r => setTimeout(r, 3000));
  const g = await call('GET', `/v1/payments/payouts/${bid}`);
  if (g.ok) console.log(`   GET batch status=${g.j.batch_header.batch_status} item=${g.j.items?.[0]?.transaction_status}${g.j.items?.[0]?.errors ? ' err=' + err(g.j.items[0].errors) : ''}`);
  else { console.log('   GET FAIL', g.status, err(g.j)); payoutFail = true; }
} else console.log('3) Payout FAIL', p.status, err(p.j));
if (payoutFail || process.argv.includes('--invoice')) {
  const i = await call('POST', '/v2/invoicing/invoices', { detail: { currency_code: 'USD', note: 'Smoke test' }, primary_recipients: [{ billing_info: { email_address: 'sb-vkeld53675758@personal.example.com' } }], items: [{ name: 'Digital Report', quantity: '1', unit_amount: { currency_code: 'USD', value: '1.00' }, unit_of_measure: 'QUANTITY' }] });
  if (i.ok) console.log(`   Invoice draft OK ${i.j.href || i.j.id || JSON.stringify(i.j).slice(0, 200)}`);
  else console.log('   Invoice FAIL', i.status, err(i.j));
}
