'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { bindUser } from '@/lib/cart';
type U = { id: string; email: string; name: string; displayName?: string } | null;
const Ctx = createContext<{ user: U; loading: boolean; refresh: () => Promise<void>; setUser: (u: U) => void }>({ user: null, loading: true, refresh: async () => {}, setUser: () => {} });
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<U>(null); const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => { try { setUser((await api('/auth/me')).user); } catch { setUser(null); } finally { setLoading(false); } }, []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (!loading) bindUser(user?.id ?? null); }, [user?.id, loading]);
  return <Ctx.Provider value={{ user, loading, refresh, setUser }}>{children}</Ctx.Provider>;
}
