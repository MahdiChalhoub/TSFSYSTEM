import SupplierGatePreviewClient from './client'
import { Building2 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function SupplierGatePreviewPage() {
 return (
 <div className="app-page p-6 max-w-[1600px] mx-auto">
  {/* V2 Header */}
  <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 fade-in-up">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-info)20', border: '1px solid var(--app-info)40' }}>
        <Building2 size={26} style={{ color: 'var(--app-info)' }} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Management</p>
        <h1 className="text-3xl font-black tracking-tight text-app-foreground">Supplier Gate</h1>
        <p className="text-sm text-app-muted-foreground mt-0.5">Preview supplier portal access</p>
      </div>
    </div>
  </header>
 <SupplierGatePreviewClient />
 </div>
 )
}
