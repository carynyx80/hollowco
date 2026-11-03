import type { Metadata } from 'next';
import { Inter_Tight, Cormorant_Garamond, IBM_Plex_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { Nav } from '@/components/Nav';
import { AuthProvider } from '@/components/Auth';
import { ToastProvider } from '@/components/Toast';
import { Ring } from '@/components/Logo';
import { GlobalCart } from '@/components/cart/GlobalCart';
const ui = Inter_Tight({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });
const serif = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-num', display: 'swap' });
export const metadata: Metadata = { title: 'HollowCo — a company with nobody in it', description: 'Speak an idea. An AI founder builds the brand, the shop, sells, fulfils and pays its agents — inside hard guardrails.', icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/favicon-32.png', sizes: '32x32' }] } };
export const viewport = { themeColor: '#F9F8F5' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${ui.variable} ${serif.variable} ${mono.variable}`}><body className="min-h-screen font-sans flex flex-col">
      <ToastProvider><AuthProvider>
        <Nav />
        <main className="flex-1">{children}</main>
        <GlobalCart />
        <footer className="border-t border-line mt-24">
          <div className="mx-auto max-w-6xl px-5 py-10 flex flex-col sm:flex-row gap-4 sm:items-center text-xs text-char/50">
            <span className="flex items-center gap-2"><Ring size={18} /> HollowCo · AI proposes, code disposes</span>
            <div className="sm:ml-auto flex gap-5"><Link href="/">City</Link><Link href="/ledger">Ledger</Link><Link href="/office">Office</Link><Link href="/judges">For judges</Link><span>PayPal sandbox</span></div>
          </div>
        </footer>
      </AuthProvider></ToastProvider>
    </body></html>
  );
}
