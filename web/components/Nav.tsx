'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Wordmark } from './Logo';
import { useAuth } from './Auth';
import { useToast } from './Toast';
import { api } from '@/lib/api';
import { CartButton } from './cart/GlobalCart';
export function Nav() {
  const { user, loading, setUser } = useAuth(); const path = usePathname(); const router = useRouter(); const toast = useToast();
  const [open, setOpen] = useState(false);
  const links = [['/', 'City'], ['/impact', 'Why it matters'], ['/ledger', 'Ledger'], ['/judges', 'For judges'], ...(user ? [['/dashboard', 'Dashboard']] : [])];
  async function out() { const req = api('/auth/signout', { method: 'POST' }).catch(() => {}); await req; setUser(null); router.push('/'); router.refresh(); toast('Signed out', 'ok'); }
  return (
    <header className="sticky top-0 z-40 border-b border-black/[.08] bg-cream/60 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5">
        <Link href="/"><Wordmark /></Link>
        <div className="hidden md:flex gap-1 text-sm">
          {links.map(([h, l]) => <Link key={h} href={h} className={`rounded-full px-3 py-1.5 transition ${(h === '/' ? path === '/' : path.startsWith(h)) ? 'bg-black/[.04] text-char font-medium' : 'text-char/60 hover:text-char'}`}>{l}</Link>)}
        </div>
        <div className="ml-auto flex items-center gap-2 md:order-none"><CartButton /></div>
        <div className="hidden md:flex items-center gap-2">
          {loading ? <div className="skeleton h-9 w-40" /> : user ? <>
            <span className="text-xs text-char/60 mr-2">by {user.displayName || user.name}</span>
            <button onClick={out} className="btn-ghost h-9">Sign out</button>
          </> : <>
            <Link href={path === '/' ? '/?panel=signin' : '/signin'} className="btn h-9 hover:bg-black/[.04]">Sign in</Link>
            <Link href={path === '/' ? '/?panel=signup' : '/signup'} className="btn-primary h-9">Get started</Link>
          </>}
        </div>
        <button className="md:hidden btn-ghost h-9 px-3" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>☰</button>
      </nav>
      {open && <div className="md:hidden border-t border-line px-5 py-3 flex flex-col gap-1 text-sm bg-cream" onClick={() => setOpen(false)}>
        {links.map(([h, l]) => <Link key={h} href={h} className="py-2">{l}</Link>)}
        {user ? <button onClick={out} className="py-2 text-left">Sign out</button> : <><Link href="/signin" className="py-2">Sign in</Link><Link href="/signup" className="btn-primary mt-1">Get started</Link></>}
      </div>}
    </header>
  );
}
