import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import * as db from './db.js';
import { env } from './env.js';
export const COOKIE = 'hc_session';
const TTL = 30 * 24 * 3600_000;
const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
const norm = (e: any) => String(e || '').trim().toLowerCase();
export const publicUser = (u: any) => u && ({ id: u.id, email: u.email, name: u.name, createdAt: u.createdAt });
export async function signup(email: any, password: any, name?: any) {
  email = norm(email); password = String(password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) throw new Error('Enter a valid email address.');
  if (password.length < 8 || password.length > 200) throw new Error('Password must be at least 8 characters.');
  if (await db.get('users', 'email:' + email)) throw new Error('An account with that email already exists.');
  const u = { id: 'u_' + crypto.randomBytes(8).toString('hex'), email, name: String(name || email.split('@')[0]).slice(0, 60), pw: await bcrypt.hash(password, 12), createdAt: new Date().toISOString() };
  await db.put('users', u.id, u); await db.put('users', 'email:' + email, { ref: u.id });
  return u;
}
export async function signin(email: any, password: any) {
  const ref = await db.get('users', 'email:' + norm(email));
  const u = ref && await db.get('users', ref.ref);
  const ok = await bcrypt.compare(String(password || ''), u?.pw || '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
  if (!u || !ok) throw new Error('Wrong email or password.');
  return u;
}
export async function newSession(userId: string) {
  const token = crypto.randomBytes(32).toString('base64url');
  await db.put('sessions', hash(token), { userId, exp: Date.now() + TTL });
  return token;
}
export async function userFromToken(token?: string) {
  if (!token) return null;
  const s = await db.get('sessions', hash(token));
  if (!s || s.exp < Date.now()) return null;
  return db.get('users', s.userId);
}
export const endSession = (token?: string) => token ? db.del('sessions', hash(token)) : Promise.resolve();
export const cookieOpts = () => ({ httpOnly: true, secure: env('NODE_ENV') === 'production' || !!env('RAILWAY_ENVIRONMENT'), sameSite: 'lax' as const, path: '/', maxAge: TTL });
// Demo account: owns every shop that has no owner yet.
export async function ensureDemo() {
  const email = norm(env('DEMO_EMAIL')), pw = env('DEMO_PASSWORD');
  if (!email || !pw) return;
  let ref = await db.get('users', 'email:' + email);
  let u = ref && await db.get('users', ref.ref);
  if (!u) u = await signup(email, pw, 'Demo Founder');
  else if (!(await bcrypt.compare(pw, u.pw))) { u.pw = await bcrypt.hash(pw, 12); await db.put('users', u.id, u); }
  let n = 0;
  for (const r of await db.list('shops', 5000)) if (!r.data.ownerId) { r.data.ownerId = u.id; await db.put('shops', r.id, r.data); n++; }
  console.log(`demo account ready; assigned ${n} unowned shops`);
}
