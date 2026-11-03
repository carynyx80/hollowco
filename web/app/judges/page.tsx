import Link from 'next/link';
import { REPLAY_SHOP } from '@/lib/replay';
import { CopyField, CopyAll } from '@/components/judge/CopyField';
// PayPal SANDBOX test buyer (fake money, published for judges per hackathon rules).
const BUYER = { email: 'sb-vkeld53675758@personal.example.com', password: 'Hollowco2026' };
const CARD = { number: '4032034155351326', shown: '4032 0341 5535 1326', exp: '12/2030', cvv: '123' };
export const metadata = { title: 'For judges · HollowCo' };
const Step = ({ n, t, children }: { n: number; t: string; children: React.ReactNode }) => <li className="grid grid-cols-[2.5rem_1fr] gap-3 py-4 border-b border-black/[.08]"><span className="font-mono text-sm text-brass pt-1">0{n}</span><div><p className="font-display text-2xl text-char">{t}</p><div className="text-sm text-char/70 mt-1 leading-relaxed">{children}</div></div></li>;
const Code = ({ children }: { children: React.ReactNode }) => <code className="font-mono text-[13px] bg-beige rounded px-1.5 py-0.5 select-all">{children}</code>;
export default function Judges() {
  return <main className="mx-auto max-w-2xl px-5 py-12">
    <p className="font-mono text-xs uppercase tracking-[.2em] text-brass">For judges · 90 seconds</p>
    <h1 className="font-display text-5xl text-char mt-2 leading-tight">One idea in, a paid AI staff out.</h1>
    <p className="text-char/70 mt-3">Everything runs on the PayPal <b>sandbox</b>. No real money moves; the credentials below are throwaway and test-only.</p>
    <ol className="mt-8">
      <Step n={1} t="Describe">Sign in with the demo account (<Code>demo@hollowco.app</Code> / <Code>ItpZaPUr0ApxZDIc</Code>) and type a one-line business idea — or skip ahead with a recorded build.</Step>
      <Step n={2} t="Watch the build">The AI founder hires staff, writes the products and opens the store. <Link className="underline" href={`/office/${REPLAY_SHOP}?replay=1`}>Watch a real build replay →</Link></Step>
      <Step n={3} t="The building rises">The new store appears as a building in <Link className="underline" href="/">the city</Link>. Tap it to open its catalogue.</Step>
      <Step n={4} t="Buy with PayPal">Add a product and pick either path. Both are PayPal <b>sandbox</b>, no real money.
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div data-testid="judge-buyer"><p className="font-mono text-[11px] uppercase tracking-[.16em] text-brass mb-1.5">A · Pay with PayPal (sandbox buyer)</p>
            <div className="grid gap-1.5"><CopyField label="Email" value={BUYER.email} testid="copy-buyer-email" /><CopyField label="Password" value={BUYER.password} testid="copy-buyer-pass" /></div></div>
          <div data-testid="judge-card"><p className="font-mono text-[11px] uppercase tracking-[.16em] text-brass mb-1.5">B · Guest card (no login)</p>
            <div className="grid gap-1.5"><CopyField label="Visa" value={CARD.shown} copy={CARD.number} testid="copy-card" /><div className="grid grid-cols-2 gap-1.5"><CopyField label="Expiry" value={CARD.exp} /><CopyField label="CVV" value={CARD.cvv} /></div></div>
            <p className="mt-1.5 text-xs text-char/60">Country <b>United States</b>, e.g. 123 Main St, San Jose, CA 95131.</p></div>
        </div>
        <div className="mt-3"><CopyAll testid="copy-all" label="Copy all test details" text={`PayPal sandbox buyer: ${BUYER.email} / ${BUYER.password}\nGuest card: ${CARD.number} exp ${CARD.exp} cvv ${CARD.cvv}, country United States, 123 Main St, San Jose, CA 95131`} /></div></Step>
      <Step n={5} t="Staff get paid">After capture the AI accountant sends PayPal payouts to each AI staff member.</Step>
      <Step n={6} t="Check the ledger">Every order, payout and blocked guardrail is public on <Link className="underline" href="/ledger">the ledger</Link>.</Step>
    </ol>
    <div className="mt-8 flex flex-wrap gap-2"><Link href={`/office/${REPLAY_SHOP}?replay=1`} className="btn-primary">Watch an AI build a store</Link><Link href="/" className="btn">Enter the city</Link></div>
  </main>;
}
