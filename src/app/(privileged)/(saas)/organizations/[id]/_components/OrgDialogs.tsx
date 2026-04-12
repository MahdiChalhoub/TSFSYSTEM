// @ts-nocheck
'use client'

import { useState } from 'react'
import { Loader2, UserCog, Eye, EyeOff, KeyRound, Building2, ToggleLeft, ToggleRight, Plus, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { SaasPlan, SaasUsageData } from '@/types/erp'

/* ── Create User Dialog ── */
export function CreateUserDialog({ open, onOpenChange, onCreate }: {
 open: boolean; onOpenChange: (v: boolean) => void
 onCreate: (user: { username: string; email: string; password: string; first_name: string; last_name: string; is_superuser: boolean }) => Promise<void>
}) {
 const [newUser, setNewUser] = useState({ username: '', email: '', password: '', first_name: '', last_name: '', is_superuser: false })
 const [creating, setCreating] = useState(false)
 const handleCreate = async () => {
 setCreating(true)
 try { await onCreate(newUser); setNewUser({ username: '', email: '', password: '', first_name: '', last_name: '', is_superuser: false }) }
 finally { setCreating(false) }
 }
 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
 <DialogHeader><DialogTitle className="font-bold">Create New User</DialogTitle></DialogHeader>
 <div className="space-y-4 py-4">
 <div className="grid grid-cols-2 gap-3">
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">First Name</label>
 <Input value={newUser.first_name} onChange={e => setNewUser({ ...newUser, first_name: e.target.value })} placeholder="John" className="rounded-xl" />
 </div>
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">Last Name</label>
 <Input value={newUser.last_name} onChange={e => setNewUser({ ...newUser, last_name: e.target.value })} placeholder="Doe" className="rounded-xl" />
 </div>
 </div>
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">Username *</label>
 <Input value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} placeholder="johndoe" className="rounded-xl" />
 </div>
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">Email</label>
 <Input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="john@company.com" className="rounded-xl" />
 </div>
 <div>
 <label className="text-xs font-bold text-app-muted-foreground mb-1 block">Password *</label>
 <Input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="••••••••" className="rounded-xl" />
 </div>
 <div className="flex items-center gap-3 p-3 bg-app-primary/5 rounded-xl border border-app-primary/30">
 <button onClick={() => setNewUser({ ...newUser, is_superuser: !newUser.is_superuser })} className="transition-transform hover:scale-110">
 {newUser.is_superuser ? <ToggleRight size={28} className="text-app-primary" /> : <ToggleLeft size={28} className="text-app-muted-foreground" />}
 </button>
 <div>
 <p className="text-sm font-bold text-app-foreground">Superuser Access</p>
 <p className="text-[10px] text-app-muted-foreground">Full admin access to this organization</p>
 </div>
 </div>
 </div>
 <DialogFooter>
 <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
 <Button onClick={handleCreate} disabled={creating} className="bg-app-primary hover:bg-app-success text-app-foreground rounded-xl font-bold">
 {creating ? <Loader2 size={16} className="animate-spin mr-2" /> : <UserCog size={16} className="mr-2" />}
 Create User
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}

/* ── Reset Password Dialog ── */
export function ResetPasswordDialog({ user, onClose, onReset }: {
 user: Record<string, unknown> | null; onClose: () => void
 onReset: (userId: string, password: string) => Promise<void>
}) {
 const [newPassword, setNewPassword] = useState('')
 const [showPass, setShowPass] = useState(false)
 const [resetting, setResetting] = useState(false)
 const handleReset = async () => {
 setResetting(true)
 try { await onReset(String(user!.id), newPassword); setNewPassword('') }
 finally { setResetting(false) }
 }
 return (
 <Dialog open={!!user} onOpenChange={(o) => { if (!o) onClose() }}>
 <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
 <DialogHeader><DialogTitle className="font-bold">Reset Password</DialogTitle></DialogHeader>
 {user && (
 <div className="space-y-4 py-4">
 <p className="text-sm text-app-muted-foreground">
 Set a new password for <strong className="text-app-foreground">{String(user.username ?? '')}</strong>
 </p>
 <div className="relative">
 <Input type={showPass ? 'text' : 'password'} value={newPassword}
 onChange={e => setNewPassword(e.target.value)} placeholder="New password (min 6 chars)" className="rounded-xl pr-10" />
 <button onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-app-muted-foreground">
 {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
 </button>
 </div>
 </div>
 )}
 <DialogFooter>
 <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancel</Button>
 <Button onClick={handleReset} disabled={resetting} className="bg-app-warning hover:bg-app-warning text-app-foreground rounded-xl font-bold">
 {resetting ? <Loader2 size={16} className="animate-spin mr-2" /> : <KeyRound size={16} className="mr-2" />}
 Reset Password
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}

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

/* ── Plan Switch Confirmation Dialog ── */
export function PlanSwitchDialog({ plan, usage, switching, onConfirm, onCancel }: {
 plan: SaasPlan | null; usage: SaasUsageData | null
 switching: boolean; onConfirm: () => void; onCancel: () => void
}) {
 return (
 <Dialog open={!!plan} onOpenChange={(open) => !open && onCancel()}>
 <DialogContent className="rounded-2xl max-w-md">
 <DialogHeader><DialogTitle className="font-black text-lg">Confirm Plan Switch</DialogTitle></DialogHeader>
 {plan && (() => {
 const currentPrice = parseFloat(String(usage?.plan?.monthly_price ?? '0'))
 const targetPrice = parseFloat(String((plan as any).price ?? (plan as any).monthly_price ?? '0'))
 const isUpgrade = targetPrice > currentPrice
 const isDowngrade = targetPrice < currentPrice
 const diff = Math.abs(targetPrice - currentPrice)
 return (
 <div className="space-y-4">
 <div className="p-4 rounded-xl bg-app-background border border-app-border space-y-3">
 <div className="flex justify-between items-center">
 <span className="text-xs text-app-muted-foreground font-bold uppercase">Current Plan</span>
 <span className="font-bold text-app-foreground">{usage?.plan?.name || 'Free Tier'}</span>
 </div>
 <div className="border-t border-dashed border-app-border" />
 <div className="flex justify-between items-center">
 <span className="text-xs text-app-muted-foreground font-bold uppercase">New Plan</span>
 <span className="font-black text-app-foreground">{plan.name}</span>
 </div>
 </div>
 <div className="flex items-center justify-between p-4 rounded-xl border-2 border-dashed" style={{
 borderColor: isUpgrade ? 'var(--app-success)' : isDowngrade ? 'var(--app-warning)' : '#9ca3af',
 background: isUpgrade ? '#ecfdf5' : isDowngrade ? '#fffbeb' : '#f9fafb'
 }}>
 <div>
 <Badge className={isUpgrade ? 'bg-app-primary-light text-app-success' : isDowngrade ? 'bg-app-warning-bg text-app-warning' : 'bg-app-surface-2 text-app-muted-foreground'}>
 {isUpgrade ? '⬆ Upgrade' : isDowngrade ? '⬇ Downgrade' : '↔ Switch'}
 </Badge>
 </div>
 <div className="text-right">
 <p className="text-xs text-app-muted-foreground font-bold">Price {isUpgrade ? 'Increase' : isDowngrade ? 'Decrease' : 'Change'}</p>
 <p className={`text-lg font-black ${isUpgrade ? 'text-app-primary' : isDowngrade ? 'text-app-warning' : 'text-app-muted-foreground'}`}>
 {isUpgrade ? '+' : isDowngrade ? '-' : ''}${diff.toFixed(2)}/mo
 </p>
 </div>
 </div>
 {isUpgrade && (
 <p className="text-[11px] text-app-muted-foreground">A <strong>Purchase Invoice</strong> of ${diff.toFixed(2)}/mo will be generated for the price difference.</p>
 )}
 {isDowngrade && (
 <p className="text-[11px] text-app-muted-foreground">A <strong>Credit Note</strong> of ${diff.toFixed(2)}/mo will be issued, plus a new <strong>Purchase Invoice</strong> for ${targetPrice.toFixed(2)}/mo.</p>
 )}
 {Array.isArray((plan as any).modules) && (plan as any).modules.length > 0 && (
 <div>
 <p className="text-[10px] text-app-muted-foreground font-bold uppercase mb-1">Modules in new plan:</p>
 <div className="flex flex-wrap gap-1">
 {(plan as any).modules.map((m: string) => (
 <Badge key={m} className="bg-app-background text-app-muted-foreground text-[9px] border border-app-border uppercase">{m}</Badge>
 ))}
 </div>
 </div>
 )}
 </div>
 )
 })()}
 <DialogFooter>
 <Button variant="ghost" onClick={onCancel} className="rounded-xl">Cancel</Button>
 <Button
 disabled={switching}
 className="bg-app-primary hover:bg-app-primary text-app-foreground rounded-xl font-bold"
 onClick={onConfirm}>
 {switching ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
 Confirm Switch
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}

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
