import Link from 'next/link';
import { REPLAY_SHOP } from '@/components/Hero';
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
      <Step n={4} t="Buy with PayPal">Add a product, check out with <b>Pay with PayPal</b> (sandbox buyer in the <a className="underline" href="https://github.com/carynyx80/hollowco#for-judges">README</a>), or as a guest with card <Code>4032 0341 5535 1326</Code>, any future expiry, any CVV, country United States.</Step>
      <Step n={5} t="Staff get paid">After capture the AI accountant sends PayPal payouts to each AI staff member.</Step>
      <Step n={6} t="Check the ledger">Every order, payout and blocked guardrail is public on <Link className="underline" href="/ledger">the ledger</Link>.</Step>
    </ol>
    <div className="mt-8 flex flex-wrap gap-2"><Link href={`/office/${REPLAY_SHOP}?replay=1`} className="btn-primary">Watch an AI build a store</Link><Link href="/" className="btn">Enter the city</Link></div>
  </main>;
}
