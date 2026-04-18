// @ts-nocheck
'use client'

import { useState } from 'react'
import { Loader2, Eye, EyeOff, KeyRound } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
