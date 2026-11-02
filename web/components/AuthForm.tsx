'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Ring } from './Logo';
import { useAuth } from './Auth';
import { useToast } from './Toast';
import { api } from '@/lib/api';
export function AuthForm({ mode }: { mode: 'signin' | 'signup' }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const router = useRouter(); const sp = useSearchParams(); const { setUser } = useAuth(); const toast = useToast();
  const up = mode === 'signup';
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const { user } = await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify({ email, password, name }) });
      setUser(user); toast(up ? 'Welcome to HollowCo — meet your AI founder' : 'Signed in', 'ok');
      const next = sp.get('next'); router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard' + (up ? '?welcome=1' : '')); router.refresh();
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }
  return <div className="mx-auto max-w-md px-5 py-16 md:py-24">
    <div className="card p-8">
      <Ring size={40} pulse />
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{up ? 'Create your account' : 'Welcome back'}</h1>
      <p className="mt-1 text-sm text-char/55">{up ? 'Get an AI founder that builds and runs shops for you.' : 'Sign in to talk to your AI founder.'}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {up && <div><label className="label" htmlFor="name">Name</label><input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada" autoComplete="name" /></div>}
        <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" type="password" required minLength={up ? 8 : 1} className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={up ? 'At least 8 characters' : '••••••••'} autoComplete={up ? 'new-password' : 'current-password'} /></div>
        {err && <p className="text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2" role="alert">{err}</p>}
        <button disabled={busy} className="btn-primary w-full">{busy ? 'One moment…' : up ? 'Create account' : 'Sign in'}</button>
      </form>
      <p className="mt-6 text-sm text-char/55 text-center">{up ? <>Already have an account? <Link href="/signin" className="text-char font-medium underline underline-offset-4">Sign in</Link></> : <>New here? <Link href="/signup" className="text-char font-medium underline underline-offset-4">Create an account</Link></>}</p>
    </div>
  </div>;
}
