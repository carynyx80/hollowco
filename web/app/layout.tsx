import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
export const metadata: Metadata = { title: 'HollowCo — a company with nobody in it', description: 'Speak an idea. AI agents build, sell, fulfil and get paid via PayPal.', icons: { icon: '/favicon-32.png' } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en"><body className="min-h-screen">
      <header className="border-b border-char/10">
        <nav className="max-w-6xl mx-auto flex items-center gap-6 px-5 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg"><img src="/icon.svg" alt="" className="h-8 w-8" />HollowCo</Link>
          <span className="text-sm text-char/60 hidden sm:block">a company with nobody in it</span>
          <div className="ml-auto flex gap-5 text-sm"><Link href="/">Build</Link><Link href="/ledger" className="font-medium text-coral">Live P&amp;L ledger</Link></div>
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-5 py-8">{children}</main>
      <footer className="max-w-6xl mx-auto px-5 py-10 text-xs text-char/50">PayPal sandbox demo · AI proposes, code disposes · MIT</footer>
    </body></html>
  );
}
