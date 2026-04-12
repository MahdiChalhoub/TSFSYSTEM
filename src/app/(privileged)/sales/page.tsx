'use client'

import dynamic from 'next/dynamic';

const POSClient = dynamic(() => import('./POSClient'), { ssr: false });

export default function POSPage() {
    return <POSClient />;
}
