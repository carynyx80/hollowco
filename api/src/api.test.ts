// API tests: order capture state, guardrail rejection, payout limits, totals. Offline: memory DB, mock AI, no PayPal calls.
import assert from 'node:assert/strict';
for (const k of ['DATABASE_URL', 'OPENAI_API_KEY', 'XAI_API_KEY', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PRINTFUL_API_TOKEN']) process.env[k] = '';
const { checkPayout, checkPrice, LIMITS, STAFF_PAYEE } = await import('./guardrails.js');
const { applyUnit } = await import('./orderState.js');
const db = await import('./db.js');
const { fulfil, ledgerView, splitTotals, storeEconomics } = await import('./core.js');
let n = 0; const t = async (name: string, f: () => any) => { await f(); n++; console.log('  ✓ ' + name); };

console.log('order capture');
await t('completed capture marks order COMPLETED with captured amount, payer and source', () => {
  const o: any = { total: 9 };
  const j = { status: 'COMPLETED', payer: { email_address: 'b@x.com', name: { given_name: 'Ada', surname: 'B' } }, payment_source: { card: {} } };
  applyUnit(o, j, { payments: { captures: [{ id: 'CAP1', status: 'COMPLETED', amount: { value: '9.00' } }] } }, null);
  assert.equal(o.status, 'COMPLETED'); assert.equal(o.captureId, 'CAP1'); assert.equal(o.capturedAmount, 9); assert.equal(o.paymentSource, 'card'); assert.equal(o.payer.name, 'Ada B');
});
await t('order COMPLETED but capture DECLINED is FAILED (never fulfilled)', () => {
  const o: any = { total: 9 }; applyUnit(o, { status: 'COMPLETED' }, { payments: { captures: [{ id: 'C', status: 'DECLINED', amount: { value: '9.00' } }] } }, null);
  assert.equal(o.status, 'FAILED');
});
await t('PENDING capture stays COMPLETED order status', () => {
  const o: any = {}; applyUnit(o, { status: 'COMPLETED' }, { payments: { captures: [{ id: 'C', status: 'PENDING', amount: { value: '5' } }] } }, null); assert.equal(o.status, 'COMPLETED');
});
await t('shipping address from PayPal is applied for physical fulfilment', () => {
  const o: any = {}; applyUnit(o, { status: 'COMPLETED' }, { shipping: { name: { full_name: 'Ada' }, address: { address_line_1: '123 Main St', admin_area_2: 'San Jose', admin_area_1: 'CA', country_code: 'US', postal_code: '95131' } } }, null);
  assert.equal(o.shipping.city, 'San Jose'); assert.equal(o.shipping.zip, '95131');
});

console.log('guardrail rejection');
await t('non-allowlisted recipient is rejected', () => { const v = checkPayout({ recipient: 'attacker@evil.com', amount: 1 }, 100, 0, 0); assert.equal(v.ok, false); assert.match((v as any).reasons.join(), /not allowlisted/); });
await t('non-USD currency is rejected', () => { const v = checkPayout({ recipient: STAFF_PAYEE, amount: 1, currency: 'EUR' }, 100, 0, 0); assert.equal(v.ok, false); });
await t('zero/negative/NaN amounts are rejected', () => { for (const a of [0, -1, NaN, '5' as any]) assert.equal(checkPayout({ recipient: STAFF_PAYEE, amount: a }, 100, 0, 0).ok, false); });
await t('prices outside bounds are rejected', () => { assert.equal(checkPrice(0.5).ok, false); assert.equal(checkPrice(LIMITS.maxPrice + 1).ok, false); assert.equal(checkPrice(9).ok, true); });

console.log('payout limits');
await t('per-task cap', () => assert.equal(checkPayout({ recipient: STAFF_PAYEE, amount: LIMITS.maxPayoutPerTask + 0.01 }, 1000, 0, 0).ok, false));
await t('% of order revenue cap', () => { assert.equal(checkPayout({ recipient: STAFF_PAYEE, amount: 3.01 }, 10, 0, 0).ok, false); assert.equal(checkPayout({ recipient: STAFF_PAYEE, amount: 3 }, 10, 0, 0).ok, true); assert.equal(checkPayout({ recipient: STAFF_PAYEE, amount: 1 }, 10, 0, 2.5).ok, false); });
await t('daily cap', () => assert.equal(checkPayout({ recipient: STAFF_PAYEE, amount: 1 }, 1000, LIMITS.dailyPayoutCap, 0).ok, false));
await t('fulfilling an e-book order pays staff within limits and is idempotent', async () => {
  await db.put('shops', 'shop_t', { id: 'shop_t', name: 'Test Press', products: [{ id: 'p1', title: 'Guide', kind: 'ebook', digital: true, price: 9 }] });
  await db.put('orders', 'o_t', { id: 'o_t', shopId: 'shop_t', items: [{ productId: 'p1', name: 'Guide', qty: 1, price: 9, digital: true }], total: 9, status: 'COMPLETED', simulated: true, test: true });
  await fulfil('o_t'); await fulfil('o_t');
  const rows = (await db.list('ledger', 1000)).map((r) => r.data).filter((r) => r.orderId === 'o_t');
  assert.equal(rows.filter((r) => r.kind === 'revenue').length, 1, 'revenue booked once');
  const pays = rows.filter((r) => r.kind === 'payout');
  for (const p of pays) assert.ok(p.amount <= LIMITS.maxPayoutPerTask);
  assert.ok(pays.reduce((a, p) => a + p.amount, 0) <= 9 * LIMITS.maxPayoutPctOfRevenue + 1e-9);
});

console.log('totals');
await t('headline totals exclude test/simulated orders', async () => {
  const v = await ledgerView(); assert.equal(v.totals.revenue, 0); assert.equal(v.simulatedTotals.revenue, 9);
  const s = splitTotals([{ revenue: 10, supplierCost: 1, payouts: 2, profit: 7 }, { revenue: 5, supplierCost: 0, payouts: 0, profit: 5, sim: true }]);
  assert.equal(s.totals.revenue, 10); assert.equal(s.totals.orders, 1); assert.equal(s.simulatedTotals.orders, 1);
});
console.log('unit economics');
await t('fulfilment writes a founder decision memo with the margin arithmetic', async () => {
  const d = (await db.list('ledger', 1000)).map((r) => r.data).filter((r) => r.orderId === 'o_t' && r.kind === 'decision');
  assert.equal(d.length, 1); assert.match(d[0].detail, /margin \$/); assert.ok(d[0].memo.paid <= d[0].memo.cap + 1e-9);
});
await t('per-store P&L subtracts PayPal fees, supplier cost and payouts; excludes simulated', () => {
  const e = storeEconomics([{ shopId: 'a', shop: 'A', revenue: 30, fees: 1.37, supplierCost: 12, payouts: 3, profit: 13.63 }, { shopId: 'a', shop: 'A', revenue: 9, fees: 0, supplierCost: 0, payouts: 1, profit: 8, sim: true }]);
  assert.equal(e.length, 1); assert.equal(e[0].orders, 1); assert.equal(e[0].fees, 1.37); assert.equal(e[0].margin, 45.4);
});
await t('splitTotals carries fees', () => assert.equal(splitTotals([{ revenue: 10, fees: 0.79, supplierCost: 0, payouts: 0, profit: 9.21 }]).totals.fees, 0.79));
console.log('refund guardrails');
const { checkRefund } = await import('./guardrails.js');
const done = { status: 'COMPLETED', captureId: 'C1', capturedAmount: 20, createdAt: new Date().toISOString() };
await t('owner can refund a completed capture', () => assert.equal(checkRefund(done, 'u1', 'u1', 20).ok, true));
await t('non-owner refund is rejected', () => assert.equal(checkRefund(done, 'u2', 'u1', 5).ok, false));
await t('over-refund, double refund, simulated and stale orders are rejected', () => {
  assert.equal(checkRefund(done, 'u1', 'u1', 20.01).ok, false); assert.equal(checkRefund({ ...done, refund: { id: 'R' } }, 'u1', 'u1', 1).ok, false);
  assert.equal(checkRefund({ ...done, simulated: true }, 'u1', 'u1', 1).ok, false); assert.equal(checkRefund({ ...done, createdAt: '2020-01-01' }, 'u1', 'u1', 1).ok, false);
});
console.log(`api tests: ${n} passed`);
process.exit(0);
