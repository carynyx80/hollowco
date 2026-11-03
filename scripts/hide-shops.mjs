// One-off moderation: node scripts/hide-shops.mjs shop_a shop_b [--unhide]
// Reads ADMIN_SECRET and API (default production) from env; never prints the secret.
const api = process.env.API || 'https://api-production-692d8.up.railway.app';
const secret = process.env.ADMIN_SECRET; if (!secret) { console.error('Set ADMIN_SECRET in your env'); process.exit(1); }
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--')); const hidden = !process.argv.includes('--unhide');
const r = await fetch(`${api}/admin/hidden`, { method: ids.length ? 'POST' : 'GET', headers: { 'content-type': 'application/json', 'x-admin-secret': secret }, body: ids.length ? JSON.stringify({ shopIds: ids, hidden, reason: 'test data' }) : undefined });
console.log(r.status, JSON.stringify(await r.json()));
