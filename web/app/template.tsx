'use client';
import { motion, useReducedMotion } from 'framer-motion';
// Per-route enter transition (template remounts on every navigation).
export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0.15 : 0.45, ease: [0.22, 1, 0.36, 1] }}>{children}</motion.div>;
}
