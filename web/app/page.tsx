'use client';
import { CityGate } from '@/components/city/CityGate';
import { ClassicMarketplace } from '@/components/classic/ClassicMarketplace';
export default function Home() { return <CityGate fallback={<ClassicMarketplace />} />; }
