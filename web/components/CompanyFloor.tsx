'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
type NodeId = 'customer' | 'founder' | 'writer' | 'designer' | 'supplier' | 'accountant';
type Kind = 'task' | 'thought' | 'pay' | 'block' | 'sale';
type Msg = { id: number; from: NodeId; to: NodeId; label: string; kind: Kind; live: boolean };
const NODES: Record<NodeId, { x: number; y: number; name: string; role: string; icon: string; hue: string }> = {
  customer: { x: 7, y: 50, name: 'Customer', role: 'buyer', icon: '🛍', hue: '#C8FF5C' },
  founder: { x: 46, y: 50, name: 'Founder', role: 'AI CEO', icon: '◎', hue: '#8B7BFF' },
  writer: { x: 26, y: 18, name: 'Writer', role: 'e-books', icon: '✍', hue: '#5CE1FF' },
  designer: { x: 70, y: 18, name: 'Designer', role: 'brand & merch', icon: '✦', hue: '#FF7AD9' },
  supplier: { x: 86, y: 76, name: 'Supplier', role: 'print on demand', icon: '⬡', hue: '#FFB86B' },
  accountant: { x: 28, y: 82, name: 'Accountant', role: 'guardrails & ledger', icon: '§', hue: '#5EF0A6' },
};
const EDGES: [NodeId, NodeId][] = [['founder', 'writer'], ['founder', 'designer'], ['founder', 'supplier'], ['founder', 'accountant'], ['customer', 'accountant'], ['accountant', 'supplier'], ['accountant', 'writer'], ['designer', 'supplier']];
const COLOR: Record<Kind, string> = { task: '#8B7BFF', thought: '#5CE1FF', pay: '#5EF0A6', block: '#FF6B81', sale: '#C8FF5C' };
const AMBIENT: [NodeId, NodeId, string, Kind][] = [
  ['founder', 'writer', 'Draft a chapter on habits', 'task'], ['writer', 'founder', 'Outline ready ✓', 'thought'], ['founder', 'designer', 'Make the mug bolder', 'task'],
  ['designer', 'supplier', 'Print file 4500px', 'task'], ['supplier', 'accountant', 'Unit cost $6.50', 'thought'], ['founder', 'accountant', 'Can I pay writer $2?', 'task'],
  ['accountant', 'founder', 'Within 30% cap ✓', 'thought'], ['founder', 'accountant', 'Pay myself $500?', 'block'], ['accountant', 'founder', '✋ Exceeds $5/task', 'block'],
  ['designer', 'founder', 'New cover concept', 'thought'], ['customer', 'founder', 'Is the e-book PDF?', 'thought'], ['founder', 'customer', 'Instant PDF + .md', 'thought'],
];
const THOUGHTS: Partial<Record<NodeId, string[]>> = { founder: ['Which niche next?', 'Pricing $9.99 feels right', 'Briefing the team'], writer: ['Tightening chapter 2', 'Checking tone'], designer: ['Kerning the logo', 'Trying a darker palette'], supplier: ['Mug stock OK', 'Draft orders only'], accountant: ['Daily cap $50', 'Books balanced'] };
const agentNode = (a?: string): NodeId => (a && a in NODES ? (a as NodeId) : a === 'fulfilment' ? 'supplier' : 'founder');
const money = (n: any) => `$${Number(n || 0).toFixed(2)}`;
export function eventToMsgs(e: any): Omit<Msg, 'id' | 'live'>[] {
  const sim = e.sim ? ' · sim' : '';
  switch (e.kind) {
    case 'shop_created': return [{ from: 'founder', to: 'writer', label: `Brief: ${e.shop}`, kind: 'task' }, { from: 'founder', to: 'designer', label: `Brand ${e.shop}`, kind: 'task' }];
    case 'revenue': return [{ from: 'customer', to: 'accountant', label: `Sale ${money(e.amount)}${sim}`, kind: 'sale' }, { from: 'accountant', to: 'founder', label: `Revenue booked`, kind: 'thought' }];
    case 'supplier_cost': return [{ from: 'founder', to: 'supplier', label: 'Fulfil order', kind: 'task' }, { from: 'supplier', to: 'accountant', label: `Cost ${money(e.amount)}${sim}`, kind: 'thought' }];
    case 'payout': return [{ from: 'founder', to: 'accountant', label: `Pay ${e.agent} ${money(e.amount)}?`, kind: 'task' }, { from: 'accountant', to: agentNode(e.agent), label: `Paid ${money(e.amount)}${sim}`, kind: 'pay' }];
    case 'rejected': return [{ from: 'founder', to: 'accountant', label: e.proposal?.amount ? `Pay ${money(e.proposal.amount)}?` : 'Proposal', kind: 'task' }, { from: 'accountant', to: 'founder', label: `✋ Blocked`, kind: 'block' }];
    case 'capture_failed': return [{ from: 'customer', to: 'accountant', label: 'Payment failed', kind: 'block' }];
    default: return [];
  }
}
function jobLineToMsg(l: string): Omit<Msg, 'id' | 'live'> | null {
  const m = l.match(/^(\w+) agent: (.*)$/i); if (!m) return null;
  const who = m[1].toLowerCase() as NodeId; const text = m[2].length > 34 ? m[2].slice(0, 32) + '…' : m[2];
  return who === 'founder' ? { from: 'founder', to: /logo|design/i.test(text) ? 'designer' : 'writer', label: text, kind: 'task' } : { from: who in NODES ? who : 'writer', to: 'founder', label: text, kind: 'thought' };
}
const key = (e: any) => `${e.at}|${e.kind}|${e.orderId || ''}|${e.agent || ''}|${e.amount ?? ''}`;
export function CompanyFloor({ events, jobLog, height = 440, onSimulate, simBusy, title = 'Company floor' }: { events?: any[]; jobLog?: string[] | null; height?: number; onSimulate?: () => void; simBusy?: boolean; title?: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]); const [feed, setFeed] = useState<Msg[]>([]);
  const [thought, setThought] = useState<Partial<Record<NodeId, string>>>({}); const [active, setActive] = useState<Partial<Record<NodeId, number>>>({});
  const q = useRef<Omit<Msg, 'id'>[]>([]); const seen = useRef<Set<string> | null>(null); const jobN = useRef(0); const n = useRef(0); const lastLive = useRef(0); const amb = useRef(0);
  const [mode, setMode] = useState<'ambient' | 'live'>('ambient');
  useEffect(() => {
    if (!events) return;
    if (!seen.current) { seen.current = new Set(events.map(key)); return; }
    const fresh = events.filter((e) => !seen.current!.has(key(e))).sort((a, b) => String(a.at).localeCompare(String(b.at)));
    for (const e of fresh) { seen.current.add(key(e)); for (const m of eventToMsgs(e)) q.current.push({ ...m, live: true }); }
  }, [events]);
  useEffect(() => {
    if (!jobLog) { jobN.current = 0; return; }
    for (const l of jobLog.slice(jobN.current)) { const m = jobLineToMsg(l); if (m) q.current.push({ ...m, live: true }); }
    jobN.current = jobLog.length;
  }, [jobLog]);
  useEffect(() => {
    const t = setInterval(() => {
      let m = q.current.shift();
      if (m) lastLive.current = Date.now();
      else if (Date.now() - lastLive.current > 6000) {
        if (++amb.current % 2) { const a = AMBIENT[Math.floor(Math.random() * AMBIENT.length)]; m = { from: a[0], to: a[1], label: a[2], kind: a[3], live: false }; }
        else { const ids = Object.keys(THOUGHTS) as NodeId[]; const who = ids[Math.floor(Math.random() * ids.length)]; const list = THOUGHTS[who]!; const txt = list[Math.floor(Math.random() * list.length)];
          setThought((s) => ({ ...s, [who]: txt })); setTimeout(() => setThought((s) => (s[who] === txt ? { ...s, [who]: undefined } : s)), 2600); }
      }
      setMode(Date.now() - lastLive.current < 6000 ? 'live' : 'ambient');
      if (!m) return;
      const msg = { ...m, id: ++n.current };
      setMsgs((x) => [...x, msg]); setFeed((f) => [msg, ...f].slice(0, 7));
      setActive((s) => ({ ...s, [msg.from]: Date.now(), [msg.to]: Date.now() + 1200 }));
      setTimeout(() => setMsgs((x) => x.filter((y) => y.id !== msg.id)), 1800);
      if (msg.kind !== 'task') { setTimeout(() => { setThought((s) => ({ ...s, [msg.to]: msg.label })); setTimeout(() => setThought((s) => (s[msg.to] === msg.label ? { ...s, [msg.to]: undefined } : s)), 2400); }, 1500); }
    }, 950);
    return () => clearInterval(t);
  }, []);
  const now = Date.now();
  return <div className="card overflow-hidden" data-testid="company-floor">
    <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-white/[.06]">
      <span className="relative flex h-2 w-2"><span className={`absolute inset-0 rounded-full ${mode === 'live' ? 'bg-lime' : 'bg-cyan'} dot-ping`} /><span className={`relative h-2 w-2 rounded-full ${mode === 'live' ? 'bg-lime' : 'bg-cyan'}`} /></span>
      <p className="font-medium text-sm">{title}</p>
      <span className={`text-[10px] font-semibold uppercase tracking-[.16em] rounded-full px-2 py-0.5 border ${mode === 'live' ? 'text-lime border-lime/30 bg-lime/10' : 'text-cyan border-cyan/30 bg-cyan/10'}`} data-testid="floor-mode">{mode === 'live' ? 'Live events' : 'Ambient simulation'}</span>
      {onSimulate && <button onClick={onSimulate} disabled={simBusy} className="btn-ghost h-8 px-3.5 text-xs ml-auto" data-testid="simulate">{simBusy ? 'Customer is shopping…' : '🛍 Simulate a customer'}<span className="text-[9px] uppercase tracking-wider text-char/40">simulated</span></button>}
    </div>
    <div className="grid lg:grid-cols-[1fr_260px]">
      <div className="relative" style={{ height }}>
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          {EDGES.map(([a, b]) => <line key={a + b} x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} stroke="#8B7BFF" strokeOpacity=".22" strokeWidth=".25" vectorEffect="non-scaling-stroke" className="flow-line" style={{ strokeWidth: 1.2 }} />)}
        </svg>
        {(Object.keys(NODES) as NodeId[]).map((id) => { const nd = NODES[id]; const on = (active[id] || 0) > now - 1600;
          return <div key={id} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={{ left: `${nd.x}%`, top: `${nd.y}%` }}>
            <AnimatePresence>{thought[id] && <motion.div key={thought[id]} initial={{ opacity: 0, y: 6, scale: .9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} className="absolute bottom-full mb-2 whitespace-nowrap rounded-lg border border-white/10 bg-[#0d0d16]/90 backdrop-blur px-2.5 py-1 text-[11px] text-char/80 shadow-lg">{thought[id]}</motion.div>}</AnimatePresence>
            <motion.div animate={{ scale: on ? 1.08 : 1, boxShadow: on ? `0 0 0 6px ${nd.hue}22, 0 0 40px ${nd.hue}66` : `0 0 0 0px ${nd.hue}00, 0 0 18px ${nd.hue}22` }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className={`grid place-items-center rounded-full border bg-[#0d0d16] ${id === 'founder' ? 'h-[72px] w-[72px] text-3xl' : 'h-14 w-14 text-xl'}`} style={{ borderColor: nd.hue + '80', color: nd.hue }}>{nd.icon}</motion.div>
            <p className="mt-2 text-xs font-medium">{nd.name}</p><p className="text-[10px] text-char/40 hidden sm:block">{nd.role}</p>
          </div>; })}
        {msgs.map((m) => { const a = NODES[m.from], b = NODES[m.to];
          return <motion.div key={m.id} initial={{ left: `${a.x}%`, top: `${a.y}%`, opacity: 0, scale: .7 }} animate={{ left: `${b.x}%`, top: `${b.y}%`, opacity: [0, 1, 1, 0], scale: 1 }} transition={{ duration: 1.7, ease: [0.4, 0, 0.2, 1] }}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium text-ink shadow-lg" style={{ background: COLOR[m.kind], boxShadow: `0 0 24px ${COLOR[m.kind]}99` }}>{m.label}</motion.div>; })}
      </div>
      <div className="border-t lg:border-t-0 lg:border-l border-white/[.06] p-4">
        <p className="text-[10px] uppercase tracking-[.16em] text-char/40 mb-3">Message stream</p>
        <ul className="space-y-2 text-xs font-mono" data-testid="floor-feed"><AnimatePresence initial={false}>
          {feed.map((m) => <motion.li key={m.id} layout initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex gap-2 items-start">
            <span className="mt-1 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: COLOR[m.kind] }} />
            <span className="min-w-0"><span className="text-char/45">{NODES[m.from].name} → {NODES[m.to].name}</span><br /><span className="text-char/85">{m.label}</span>{!m.live && <span className="text-char/30"> · ambient</span>}</span></motion.li>)}
        </AnimatePresence>{feed.length === 0 && <li className="text-char/35">Waiting for the first message…</li>}</ul>
      </div>
    </div>
  </div>;
}
