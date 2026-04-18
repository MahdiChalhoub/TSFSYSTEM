// @ts-nocheck
'use client'

import { useState } from 'react'
import { Loader2, Building2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/* ── Create Site Dialog ── */
export function CreateSiteDialog({ open, onOpenChange, onCreate }: {
 open: boolean; onOpenChange: (v: boolean) => void
 onCreate: (site: { name: string; code: string; address: string; city: string; phone: string; vat_number: string }) => Promise<void>
}) {
 const [newSite, setNewSite] = useState({ name: '', code: '', address: '', city: '', phone: '', vat_number: '' })
 const [creatingSite, setCreatingSite] = useState(false)
 const handleCreate = async () => {
 setCreatingSite(true)
 try { await onCreate(newSite); setNewSite({ name: '', code: '', address: '', city: '', phone: '', vat_number: '' }) }
 finally { setCreatingSite(false) }
 }
 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
 <DialogHeader><DialogTitle className="font-bold">Add New Site</DialogTitle></DialogHeader>
 <div className="space-y-4 py-4">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">Site Name *</label>
 <Input value={newSite.name} onChange={e => setNewSite({ ...newSite, name: e.target.value })} placeholder="Main Branch" className="rounded-xl" />
 </div>
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">Code</label>
 <Input value={newSite.code} onChange={e => setNewSite({ ...newSite, code: e.target.value.toUpperCase() })} placeholder="BR001" className="rounded-xl font-mono" />
 </div>
 </div>
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">Address</label>
 <Input value={newSite.address} onChange={e => setNewSite({ ...newSite, address: e.target.value })} placeholder="123 Main Street" className="rounded-xl" />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">City</label>
 <Input value={newSite.city} onChange={e => setNewSite({ ...newSite, city: e.target.value })} placeholder="Beirut" className="rounded-xl" />
 </div>
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">Phone</label>
 <Input value={newSite.phone} onChange={e => setNewSite({ ...newSite, phone: e.target.value })} placeholder="+961 1 234567" className="rounded-xl" />
 </div>
 </div>
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">VAT Number</label>
 <Input value={newSite.vat_number} onChange={e => setNewSite({ ...newSite, vat_number: e.target.value })} placeholder="LB123456789" className="rounded-xl font-mono" />
 </div>
 </div>
 <DialogFooter>
 <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
 <Button onClick={handleCreate} disabled={creatingSite} className="bg-app-primary hover:bg-app-primary text-app-foreground rounded-xl font-bold">
 {creatingSite ? <Loader2 size={16} className="animate-spin mr-2" /> : <Building2 size={16} className="mr-2" />}
 Create Site
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}
