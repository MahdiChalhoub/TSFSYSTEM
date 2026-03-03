import { Suspense } from 'react';
import { SupermarcheClient } from './client';
import { ShoppingCart } from 'lucide-react'

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
  {/* V2 Header */}
  <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 fade-in-up">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-primary)20', border: `1px solid $var(--app-primary)40` }}>
        <ShoppingCart size={26} style={{ color: 'var(--app-primary)' }} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Management</p>
        <h1 className="text-3xl font-black tracking-tight text-app-foreground">Supermarché</h1>
        <p className="text-sm text-app-muted-foreground mt-0.5">Advanced POS interface</p>
      </div>
    </div>
  </header>
 <div className="app-page flex flex-col items-center gap-4">
 <div
 className="w-16 h-16 rounded-2xl animate-pulse"
 style={{ background: 'var(--app-success)' }}
 />
 <p style={{ color: '#94A3B8', fontSize: 14 }}>Loading Supermarché...</p>
 </div>
 </div>
 );
}
