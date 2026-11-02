import { Suspense } from 'react';
import { OfficePage } from '@/components/OfficePage';
export const metadata = { title: 'The Hollow Office — HollowCo' };
export default function Page() { return <Suspense><OfficePage /></Suspense>; }
