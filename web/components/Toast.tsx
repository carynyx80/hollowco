'use client';
import { AnimatePresence, motion } from 'framer-motion';
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
      <AnimatePresence initial={false}>{list.map((t) => <motion.div layout key={t.id} role="status" initial={{ opacity: 0, y: 24, scale: .94 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 420, damping: 30 } }} exit={{ opacity: 0, x: 60, transition: { duration: .22 } }} className={`rounded-xl px-4 py-3 text-sm shadow-lg border flex gap-2 items-start ${t.kind === 'err' ? 'bg-[#1a0f14]/90 backdrop-blur-xl border-red-400/30 text-red-200' : t.kind === 'info' ? 'bg-[#16140F]/90 backdrop-blur-xl border-[#B8975A]/40 text-char' : 'bg-[#11111a]/90 backdrop-blur-xl border-white/10 text-char'}`}>
        <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${t.kind === 'err' ? 'bg-red-500' : t.kind === 'ok' ? 'bg-lime' : 'bg-coral'}`} />{t.msg}</motion.div>)}</AnimatePresence>
    </div></Ctx.Provider>;
}
