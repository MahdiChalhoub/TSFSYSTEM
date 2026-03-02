import { Suspense } from 'react';
import { SupermarcheClient } from './client';

// Metadata
export const metadata = {
 title: 'Supermarché POS | Dajingo ERP',
 description: 'Multi-theme Supermarché point of sale',
};

export default async function SupermarchePage() {
 // For MVP, we pass empty arrays — the client fetches products via actions.
 // This keeps the server component minimal and avoids waterfall fetching.
 return (
 <Suspense fallback={<SupermarcheSkeleton />}>
 <SupermarcheClient />
 </Suspense>
 );
}

function SupermarcheSkeleton() {
 return (
 <div
 className="h-screen flex items-center justify-center"
 style={{ background: '#020617', fontFamily: "'Outfit', sans-serif" }}
 >
 <div className="flex flex-col items-center gap-4">
 <div
 className="w-16 h-16 rounded-2xl animate-pulse"
 style={{ background: 'rgba(16, 185, 129, 0.2)' }}
 />
 <p style={{ color: '#94A3B8', fontSize: 14 }}>Loading Supermarché...</p>
 </div>
 </div>
 );
}
