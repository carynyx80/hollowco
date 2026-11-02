import { Suspense } from 'react';
import { OfficePage } from '@/components/OfficePage';
export const metadata = { title: 'The Hollow Office — HollowCo' };
export default async function Page({ params }: { params: Promise<{ shop: string }> }) { const { shop } = await params; return <Suspense><OfficePage shop={shop} /></Suspense>; }
