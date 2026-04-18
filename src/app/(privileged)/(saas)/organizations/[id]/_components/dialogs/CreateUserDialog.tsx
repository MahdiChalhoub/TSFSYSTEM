// @ts-nocheck
'use client'

import { useState } from 'react'
import { Loader2, UserCog, ToggleLeft, ToggleRight } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
