'use client';
import { useState } from 'react';
/** One-click copy for sandbox test values (buyer login, guest card). */
export function CopyField({ label, value, copy, testid }: { label: string; value: string; copy?: string; testid?: string }) {
  const [ok, setOk] = useState(false);
  return <button type="button" data-testid={testid} onClick={() => { navigator.clipboard?.writeText(copy ?? value).then(() => { setOk(true); setTimeout(() => setOk(false), 1400); }).catch(() => {}); }}
    className="group flex w-full items-center justify-between gap-3 rounded-lg border border-black/[.08] bg-white px-3 py-2 text-left hover:border-brass/60 transition-colors">
    <span className="min-w-0"><span className="block font-mono text-[10px] uppercase tracking-[.16em] text-char/60">{label}</span><span className="block font-mono text-[13px] text-char truncate select-all">{value}</span></span>
    <span className="shrink-0 font-mono text-[11px] text-[#8C6F3C]">{ok ? 'Copied ✓' : 'Copy'}</span>
  </button>;
}
export function CopyAll({ text, label, testid }: { text: string; label: string; testid?: string }) {
  const [ok, setOk] = useState(false);
  return <button type="button" data-testid={testid} className="btn-primary h-10 text-sm" onClick={() => navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1600); }).catch(() => {})}>{ok ? 'Copied ✓' : label}</button>;
}
