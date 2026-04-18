// @ts-nocheck
'use client'

import { useState } from 'react'
import { Loader2, Plus, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { SaasUsageData } from '@/types/erp'

/* ── Client Assignment Dialog ── */
export function ClientAssignDialog({ open, onOpenChange, allClients, usage,
 onAssign, onUnassign, onCreateAndAssign, onSearchClients, savingClient
}: {
 open: boolean; onOpenChange: (v: boolean) => void
 allClients: Record<string, any>[]; usage: SaasUsageData | null
 onAssign: (clientId: string) => void; onUnassign: () => void
 onCreateAndAssign: (client: { first_name: string; last_name: string; email: string; phone: string; company_name: string }) => Promise<void>
 onSearchClients: (query: string) => void; savingClient: boolean
}) {
 const [showNewClient, setShowNewClient] = useState(false)
 const [clientSearch, setClientSearch] = useState('')
 const [newClient, setNewClient] = useState({ first_name: '', last_name: '', email: '', phone: '', company_name: '' })
 return (
 <Dialog open={open} onOpenChange={(o) => { if (!o) { onOpenChange(false); setShowNewClient(false) } }}>
 <DialogContent className="rounded-2xl max-w-md">
 <DialogHeader><DialogTitle className="font-black text-lg">Assign Account Owner</DialogTitle></DialogHeader>
 {!showNewClient ? (
 <div className="space-y-4">
 <Input
 placeholder="Search clients by name or email..."
 value={clientSearch}
 onChange={(e) => { setClientSearch(e.target.value); onSearchClients(e.target.value) }}
 className="rounded-xl"
 />
 <div className="max-h-[300px] overflow-y-auto space-y-1">
 {allClients.map((c: Record<string, any>) => (
 <button key={c.id}
 className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all text-left hover:border-app-success hover:bg-app-primary-light/30 ${(usage as any)?.client?.id === c.id ? 'border-app-success bg-app-primary-light' : 'border-app-border'}`}
 onClick={() => onAssign(c.id)}>
 <div>
 <p className="font-bold text-sm text-app-foreground">{c.full_name}</p>
 <p className="text-[10px] text-app-muted-foreground">{c.email}{c.company_name ? ` · ${c.company_name}` : ''}</p>
 </div>
 <div className="flex items-center gap-2">
 <Badge className="bg-app-background text-app-muted-foreground border-app-border text-[9px]">{c.org_count} orgs</Badge>
 {(usage as any)?.client?.id === c.id && <Check size={14} className="text-app-primary" />}
 </div>
 </button>
 ))}
 {allClients.length === 0 && (
 <p className="text-center text-xs text-app-muted-foreground italic py-6">No clients found</p>
 )}
 </div>
 <div className="border-t border-app-border pt-3 flex gap-2">
 <Button variant="outline" className="flex-1 rounded-xl text-xs" onClick={() => setShowNewClient(true)}>
 <Plus size={12} className="mr-1" /> Create New Client
 </Button>
 {(usage as any)?.client && (
 <Button variant="ghost" className="rounded-xl text-xs text-app-error hover:text-app-error hover:bg-app-error-bg"
 onClick={onUnassign}>
 Unassign
 </Button>
 )}
 </div>
 </div>
 ) : (
 <div className="space-y-3">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-[10px] font-bold text-app-muted-foreground uppercase">First Name *</label>
 <Input value={newClient.first_name} onChange={e => setNewClient({ ...newClient, first_name: e.target.value })} className="rounded-xl" />
 </div>
 <div>
 <label className="text-[10px] font-bold text-app-muted-foreground uppercase">Last Name *</label>
 <Input value={newClient.last_name} onChange={e => setNewClient({ ...newClient, last_name: e.target.value })} className="rounded-xl" />
 </div>
 </div>
 <div>
 <label className="text-[10px] font-bold text-app-muted-foreground uppercase">Email *</label>
 <Input type="email" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} className="rounded-xl" />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-[10px] font-bold text-app-muted-foreground uppercase">Phone</label>
 <Input value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} className="rounded-xl" />
 </div>
 <div>
 <label className="text-[10px] font-bold text-app-muted-foreground uppercase">Company Name</label>
 <Input value={newClient.company_name} onChange={e => setNewClient({ ...newClient, company_name: e.target.value })} className="rounded-xl" />
 </div>
 </div>
 <DialogFooter>
 <Button variant="ghost" onClick={() => setShowNewClient(false)} className="rounded-xl">Back</Button>
 <Button
 disabled={savingClient || !newClient.first_name || !newClient.last_name || !newClient.email}
 className="bg-app-primary hover:bg-app-primary text-app-foreground rounded-xl font-bold"
 onClick={async () => {
 await onCreateAndAssign(newClient)
 setNewClient({ first_name: '', last_name: '', email: '', phone: '', company_name: '' })
 setShowNewClient(false)
 }}>
 {savingClient ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
 Create & Assign
 </Button>
 </DialogFooter>
 </div>
 )}
 </DialogContent>
 </Dialog>
 )
}
