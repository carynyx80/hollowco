'use client';
import { createContext, useCallback, useContext, useState } from 'react';
type T = { id: number; msg: string; kind: 'ok' | 'err' | 'info' };
const Ctx = createContext<(msg: string, kind?: T['kind']) => void>(() => {});
export const useToast = () => useContext(Ctx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [list, setList] = useState<T[]>([]);
  const push = useCallback((msg: string, kind: T['kind'] = 'info') => {
    const id = Date.now() + Math.random(); setList((l) => [...l, { id, msg, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4200);
  }, []);
  return <Ctx.Provider value={push}>{children}
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 w-[min(92vw,360px)]">
      {list.map((t) => <div key={t.id} role="status" className={`toast-in rounded-xl px-4 py-3 text-sm shadow-lg border flex gap-2 items-start ${t.kind === 'err' ? 'bg-[#1a0f14]/90 backdrop-blur-xl border-red-400/30 text-red-200' : 'bg-[#11111a]/90 backdrop-blur-xl border-white/10 text-char'}`}>
        <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${t.kind === 'err' ? 'bg-red-500' : t.kind === 'ok' ? 'bg-emerald-400' : 'bg-coral'}`} />{t.msg}</div>)}
    </div></Ctx.Provider>;
}
