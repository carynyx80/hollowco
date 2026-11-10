import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = { title: 'How to use HollowCo' };

const STEPS = [
  {
    title: 'Describe your business',
    body: 'Open your Dashboard and type or say your idea in one sentence, like “a coffee brand from Lagos”.',
    src: '/how-to/01-dashboard.webp',
    alt: 'The HollowCo dashboard prompt, with a one-sentence idea typed in: a coffee brand from Lagos.',
  },
  {
    title: 'Watch your AI founder build it',
    body: 'In about a minute it creates your brand, products and store.',
    src: '/how-to/02-office.webp',
    alt: 'The Hollow Office, where the AI founder, writer and designer build the store.',
  },
  {
    title: 'Find your store in the city',
    body: 'Your shop appears as a building with your name on it. Walk the city and click any building to go in.',
    src: '/how-to/03-city.webp',
    alt: 'HollowCo City at night, with a named shop building labelled Lagos Night Coffee.',
  },
  {
    title: 'Shop from any store',
    body: 'Open a store’s catalogue, add items to your cart, and keep shopping in other stores. One cart works across the whole city.',
    src: '/how-to/04-catalogue.webp',
    alt: 'A store catalogue open in the city, with an item added to the shared cart.',
  },
  {
    title: 'Pay with PayPal',
    body: 'Check out once for everything with PayPal or a card. This demo uses PayPal sandbox, so no real money moves.',
    src: '/how-to/05-checkout.webp',
    alt: 'Checkout with PayPal, Pay Later and debit or credit card buttons, marked as sandbox.',
  },
  {
    title: 'Watch your order get made',
    body: 'AI staff write and design your product on the spot, and you follow the progress live.',
    src: '/how-to/06-order.webp',
    alt: 'An order receipt showing payment complete and AI staff fulfilment on the live order page.',
  },
  {
    title: 'See where the money went',
    body: 'The founder pays its AI staff through PayPal, and every payment shows on the public Ledger.',
    src: '/how-to/07-ledger.webp',
    alt: 'The public Ledger, with live totals and every order, fee and payout listed.',
  },
] as const;

export default function HowToUse() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-12 md:py-16">
      <p className="eyebrow">A short guide</p>
      <h1 className="font-display text-5xl md:text-6xl text-char mt-2 leading-tight">How to use HollowCo</h1>
      <p className="mt-4 max-w-2xl text-char/70 text-lg leading-relaxed">Seven simple steps, from one sentence to a paid-out order.</p>

      <ol className="mt-14 space-y-16 md:space-y-20">
        {STEPS.map((s, i) => (
          <li key={s.title} className="grid items-center gap-6 md:grid-cols-2 md:gap-12">
            <div className={i % 2 ? 'md:order-2' : undefined}>
              <p className="font-mono text-sm text-[#8C6F3C]">0{i + 1}</p>
              <h2 className="font-display text-3xl md:text-4xl text-char mt-1 leading-tight">{s.title}</h2>
              <p className="mt-3 text-char/70 leading-relaxed">{s.body}</p>
            </div>
            <div className={i % 2 ? 'md:order-1' : undefined}>
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-black/[.06] bg-[#ECEAE3]">
                <Image
                  src={s.src}
                  alt={s.alt}
                  width={1280}
                  height={800}
                  className="h-full w-full object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority={i === 0}
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-16 flex flex-wrap gap-2">
        <Link href="/dashboard" className="btn-primary">Open your Dashboard</Link>
        <Link href="/" className="btn">Enter the city</Link>
        <Link href="/ledger" className="btn">See the ledger</Link>
      </div>
    </main>
  );
}
