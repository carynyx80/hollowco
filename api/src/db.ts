import pg from 'pg';
import { env } from './env.js';
export type Row = { id: string; created: string; data: any };
const TABLES = ['shops', 'orders', 'ledger', 'assets'] as const;
type T = (typeof TABLES)[number];
const url = env('DATABASE_URL');
const pool = url ? new pg.Pool({ connectionString: url, ssl: url.includes('railway.internal') || url.includes('localhost') ? false : { rejectUnauthorized: false } }) : null;
const mem: Record<string, Map<string, Row>> = Object.fromEntries(TABLES.map((t) => [t, new Map()]));
export const dbMode = pool ? 'postgres' : 'memory';
export async function init() {
  if (!pool) return;
  for (const t of TABLES) await pool.query(`create table if not exists ${t} (id text primary key, created timestamptz not null default now(), data jsonb not null)`);
}
export async function put(t: T, id: string, data: any) {
  if (!pool) { const ex = mem[t].get(id); mem[t].set(id, { id, created: ex?.created ?? new Date().toISOString(), data }); return; }
  await pool.query(`insert into ${t}(id,data) values($1,$2) on conflict(id) do update set data=excluded.data`, [id, data]);
}
export async function get(t: T, id: string): Promise<any | null> {
  if (!pool) return mem[t].get(id)?.data ?? null;
  const r = await pool.query(`select data from ${t} where id=$1`, [id]);
  return r.rows[0]?.data ?? null;
}
export async function list(t: T, limit = 500): Promise<Row[]> {
  if (!pool) return [...mem[t].values()].sort((a, b) => b.created.localeCompare(a.created)).slice(0, limit);
  const r = await pool.query(`select id, created, data from ${t} order by created desc limit $1`, [limit]);
  return r.rows.map((x) => ({ ...x, created: new Date(x.created).toISOString() }));
}
