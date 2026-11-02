import assert from 'node:assert/strict';
import { checkShopQuota, takeAction, _resetActions, LimitError } from './limits.js';
const now = Date.now(), H = 3_600_000;
// per-user: 3 in 24h
assert.equal(checkShopQuota([now - H, now - 2 * H], [], false, now).used, 2);
assert.throws(() => checkShopQuota([now - H, now - 2 * H, now - 3 * H], [], false, now), LimitError);
// old shops roll off
assert.equal(checkShopQuota([now - 25 * H, now - 26 * H, now - 27 * H], [], false, now).used, 0);
// demo gets more
assert.equal(checkShopQuota([now - H, now - 2 * H, now - 3 * H], [], true, now).limit, 15);
// global cap
assert.throws(() => checkShopQuota([], Array(50).fill(now - H), false, now), /site-wide/);
// actions
_resetActions();
for (let i = 0; i < 10; i++) takeAction('simulate', 'ip:1', 'anon', now);
assert.throws(() => takeAction('simulate', 'ip:1', 'anon', now), /Sign in for more/);
assert.equal(takeAction('simulate', 'ip:2', 'anon', now).used, 1);
for (let i = 0; i < 30; i++) takeAction('simulate', 'u:a', 'user', now);
assert.throws(() => takeAction('simulate', 'u:a', 'user', now), LimitError);
assert.equal(takeAction('simulate', 'u:demo', 'demo', now).limit, 150);
console.log('limits tests: ok');
