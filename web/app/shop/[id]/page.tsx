'use client';
import { use } from 'react';
import { ClassicShop } from '@/components/classic/ClassicShop';
export default function Shop({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <ClassicShop id={id} />; }
