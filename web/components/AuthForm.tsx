'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { Ring } from './Logo';
import { useAuth } from './Auth';
import { useToast } from './Toast';
import { api } from '@/lib/api';
export function AuthForm({ mode, embedded, onDone, onSwitch }: { mode: 'signin' | 'signup'; embedded?: boolean; onDone?: (u: any) => void; onSwitch?: () => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const router = useRouter(); const sp = useSearchParams(); const { setUser } = useAuth(); const toast = useToast();
  const up = mode === 'signup'; const shake = useAnimationControls(); const reduce = useReducedMotion();
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('');
    try {
      const { user } = await api(`/auth/${mode}`, { method: 'POST', body: JSON.stringify({ email, password, name }) });
      setUser(user); toast(up ? 'Welcome to HollowCo — meet your AI founder' : 'Signed in', 'ok');
      if (onDone) { onDone(user); return; } const next = sp.get('next'); router.push(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard' + (up ? '?welcome=1' : '')); router.refresh();
    } catch (e: any) { setErr(e.message); setBusy(false); if (!reduce) shake.start({ x: [0, -12, 10, -7, 5, -2, 0], transition: { duration: 0.45 } }); }
  }
  return <div className={embedded ? 'w-full' : 'relative isolate overflow-hidden min-h-[calc(100vh-4rem)] grid place-items-center px-5 py-16'}>
    {!embedded && <div aria-hidden className="absolute inset-0 -z-10 bg-[#07070C]">
      <div className="aurora absolute left-[10%] top-[8%] h-[46vmax] w-[46vmax] rounded-full bg-iris/25 blur-[90px]" />
      <div className="aurora absolute right-[-6%] bottom-[-10%] h-[40vmax] w-[40vmax] rounded-full bg-cyan/15 blur-[90px]" style={{ animationDelay: '-6s', animationDuration: '20s' }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,.06),transparent_60%)]" />
    </div>}
    <motion.div animate={shake} className="w-full max-w-md"><motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .7, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-3xl border border-white/[.12] bg-white/[.06] backdrop-blur-2xl p-8 shadow-[inset_0_1px_0_rgba(255,255,255,.12),0_40px_120px_-30px_rgba(139,123,255,.45)]" data-testid="auth-card">
      <span className={busy ? 'inline-block ring-spin' : 'inline-block'} data-testid="auth-ring"><Ring size={40} pulse={!busy} /></span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{up ? 'Create your account' : 'Welcome back'}</h1>
      <p className="mt-1 text-sm text-char/55">{up ? 'Get an AI founder that builds and runs shops for you.' : 'Sign in to talk to your AI founder.'}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {up && <div><label className="label" htmlFor="name">Display name <span className="text-char/45">(shown on your buildings)</span></label><input id="name" className="input field-glow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Okafor" autoComplete="name" maxLength={40} /></div>}
        <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" required className="input field-glow" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></div>
        <div><label className="label" htmlFor="password">Password</label><input id="password" type="password" required minLength={up ? 8 : 1} className="input field-glow" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={up ? 'At least 8 characters' : '••••••••'} autoComplete={up ? 'new-password' : 'current-password'} /></div>
        {err && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="text-sm text-red-400 bg-red-500/10 rounded-xl px-3 py-2" role="alert">{err}</motion.p>}
        <motion.button whileTap={{ scale: .97 }} disabled={busy} className="btn-primary w-full">{busy ? <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent ring-spin" />One moment…</span> : up ? 'Create account' : 'Sign in'}</motion.button>
      </form>
      <p className="mt-6 text-sm text-char/55 text-center">{up ? <>Already have an account? {onSwitch ? <button type="button" onClick={onSwitch} className="text-char font-medium underline underline-offset-4">Sign in</button> : <Link href="/signin" className="text-char font-medium underline underline-offset-4">Sign in</Link>}</> : <>New here? {onSwitch ? <button type="button" onClick={onSwitch} className="text-char font-medium underline underline-offset-4">Create an account</button> : <Link href="/signup" className="text-char font-medium underline underline-offset-4">Create an account</Link>}</>}</p>
    </motion.div></motion.div>
  </div>;
}
