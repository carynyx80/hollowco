'use client';
import { use } from 'react';
import { CityGate } from '@/components/city/CityGate';
import { ClassicProduct } from '@/components/classic/ClassicProduct';
export default function ProductInCity({ params }: { params: Promise<{ shopId: string; pid: string }> }) { const { shopId, pid } = use(params); return <CityGate deep={{ shop: shopId, product: pid }} fallback={<ClassicProduct shopId={shopId} pid={pid} />} />; }
