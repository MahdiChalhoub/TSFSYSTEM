import ClientGatePreviewClient from './client'
import { Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function ClientGatePreviewPage() {
 return (
 <div className="app-page p-6 max-w-[1600px] mx-auto">
  {/* V2 Header */}
  <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 fade-in-up">
    <div className="flex items-center gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--app-primary)20', border: `1px solid ${color}40` }}>
        <Users size={26} style={{ color: 'var(--app-primary)' }} />
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-app-muted-foreground">Management</p>
        <h1 className="text-3xl font-black tracking-tight text-app-foreground">Client Gate</h1>
        <p className="text-sm text-app-muted-foreground mt-0.5">Preview client portal access</p>
      </div>
    </div>
  </header>
 <ClientGatePreviewClient />
 </div>
 )
}
