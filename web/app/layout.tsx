import type { Metadata } from 'next';
import { Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { Nav } from '@/components/Nav';
import { AuthProvider } from '@/components/Auth';
import { ToastProvider } from '@/components/Toast';
import { Ring } from '@/components/Logo';
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const serif = Instrument_Serif({ subsets: ['latin'], weight: '400', style: ['normal', 'italic'], variable: '--font-serif' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
export const metadata: Metadata = { title: 'HollowCo — a company with nobody in it', description: 'Speak an idea. An AI founder builds the brand, the shop, sells, fulfils and pays its agents — inside hard guardrails.', icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/favicon-32.png', sizes: '32x32' }] } };
export const viewport = { themeColor: '#07070C' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} ${mono.variable}`}><body className="min-h-screen font-sans flex flex-col">
      <ToastProvider><AuthProvider>
        <Nav />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-white/[.06] mt-24">
          <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col sm:flex-row gap-4 sm:items-center text-xs text-char/50">
            <span className="flex items-center gap-2"><Ring size={18} /> HollowCo · AI proposes, code disposes</span>
            <div className="sm:ml-auto flex gap-5"><Link href="/marketplace">Marketplace</Link><Link href="/ledger">Ledger</Link><span>PayPal sandbox</span></div>
          </div>
        </footer>
      </AuthProvider></ToastProvider>
    </body></html>
  );
}
