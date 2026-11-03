'use client';
import { use } from 'react';
import { CityGate } from '@/components/city/CityGate';
// Deep link: fly the camera to this shop's building and open its storefront.
export default function ShopInCity({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <CityGate deep={{ shop: id }} />; }
