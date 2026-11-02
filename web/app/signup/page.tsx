import { Suspense } from 'react';
import { AuthForm } from '@/components/AuthForm';
export default function P() { return <Suspense><AuthForm mode="signup" /></Suspense>; }
