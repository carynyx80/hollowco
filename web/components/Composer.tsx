'use client';
import { useRef, useState } from 'react';
export function Composer({ onSubmit, busy, placeholder }: { onSubmit: (t: string) => void; busy?: boolean; placeholder?: string }) {
  const [text, setText] = useState(''); const [listening, setListening] = useState(false); const rec = useRef<any>(null);
  const SR = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
  function talk() {
    if (!SR) return; if (listening) { rec.current?.stop(); return; }
    const r = new SR(); r.lang = 'en-US'; r.interimResults = true;
    r.onresult = (e: any) => setText(Array.from(e.results).map((x: any) => x[0].transcript).join(' '));
    r.onend = () => setListening(false); r.onerror = () => setListening(false);
    rec.current = r; r.start(); setListening(true);
  }
  const go = () => { if (text.trim().length >= 3 && !busy) { onSubmit(text.trim()); } };
  return <div className="rounded-lg border border-white/10 bg-black/30 focus-within:border-coral/70 focus-within:ring-4 focus-within:ring-coral/15 transition">
    <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) go(); }} rows={6} maxLength={4000} disabled={busy}
      placeholder={placeholder || 'Describe your store in as much detail as you like — name, products, prices, colours, audience, tone… e.g. “A store called Lagos Night Coffee selling a Midnight Brew mug for $24 and an e-book The Lagos Coffee Guide for $9.99, black and gold style”'} className="w-full resize-y bg-transparent p-4 text-[15px] outline-none placeholder:text-char/35" data-testid="composer" />
    <div className="flex items-center gap-2 px-3 pb-3">
      <button type="button" onClick={talk} disabled={!SR || busy} title={SR ? 'Speak your idea' : 'Voice input is not supported in this browser'}
        className={`btn h-9 px-3 border ${listening ? 'bg-coral border-coral text-white' : 'border-white/10 hover:bg-white/[.06]'}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v4" /></svg>
        {listening ? 'Listening… tap to stop' : 'Speak'}</button>
      <span className="text-[11px] text-char/35 hidden sm:block">⌘/Ctrl + Enter · {text.length}/4000</span>
      <button type="button" onClick={go} disabled={busy || text.trim().length < 3} className="btn-coral h-9 ml-auto" data-testid="build">{busy ? 'Founder is working…' : 'Build company →'}</button>
    </div>
  </div>;
}
