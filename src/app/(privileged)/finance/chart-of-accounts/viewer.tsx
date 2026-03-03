'use client'

import { useState, useMemo, useTransition } from 'react'
import type { ChartOfAccount } from '@/types/erp'
import { ChevronRight, ChevronDown, Plus, Folder, FolderOpen, FileText, RefreshCcw, Library, Zap, Eye, EyeOff, Power, Pencil, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { recalculateAccountBalances } from '@/app/actions/finance/ledger'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// Recursive Tree Node Component
const AccountNode = ({ node, level, accounts }: { node: Record<string, any>, level: number, accounts: Record<string, any>[] }) => {
 const isParent = node.children && node.children.length > 0
 const [isOpen, setIsOpen] = useState(level < 1) // Only open first level by default

 const toggle = () => setIsOpen(!isOpen)

 return (
 <div className={`flex flex-col border-app-border ${!node.isActive ? 'opacity-50 grayscale-[0.5]' : ''}`}>
 {/* Account Row */}
 <div
 className={`flex items-center group hover:bg-app-background transition-colors py-2 border-b border-stone-50 ${level === 0 ? 'bg-app-surface' : ''}`}
 style={{ paddingLeft: `${level * 24}px` }}
 >
 <div className="flex-1 flex items-center gap-2">
 {/* Expand/Collapse Toggle */}
 <div className="w-6 flex justify-center">
 {isParent ? (
 <button onClick={toggle} className="p-1 hover:bg-app-border rounded text-app-muted-foreground">
 {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
 </button>
 ) : (
 <div className="w-4 h-4 rounded-full border border-app-border flex items-center justify-center opacity-30">
 <div className="w-1 h-1 bg-app-surface-2 rounded-full" />
 </div>
 )}
 </div>

 {/* Icon based on status */}
 <div className="text-app-muted-foreground">
 {isParent ? (isOpen ? <FolderOpen size={16} className="text-app-warning" /> : <Folder size={16} className="text-amber-200" />) : <FileText size={16} />}
 </div>

 {/* Account Info */}
 <div className="flex flex-col">
 <div className="flex items-center gap-2">
 <span className="font-mono text-xs font-bold text-app-muted-foreground w-12">{node.code}</span>
 <span className={`text-sm font-medium ${level === 0 ? 'text-app-foreground font-bold' : 'text-app-muted-foreground'}`}>
 {node.name}
 </span>
 </div>
 {node.subType && (
 <span className="text-[10px] text-app-muted-foreground uppercase tracking-tighter">[{node.subType}]</span>
 )}
 </div>
 </div>

 {/* Regulatory Mapping */}
 <div className="w-48 flex flex-col justify-center">
 {node.syscohadaCode && (
 <div className="flex items-center gap-1.5">
 <span className="text-[10px] font-black bg-app-surface-2 text-app-muted-foreground px-1.5 py-0.5 rounded border border-app-border">
 {node.syscohadaCode}
 </span>
 {node.syscohadaClass && (
 <span className="text-[9px] text-app-muted-foreground font-medium truncate max-w-[120px]">
 {node.syscohadaClass}
 </span>
 )}
 </div>
 )}
 </div>

 {/* Type Badge */}
 <div className="w-32 flex items-center">
 <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${node.type === 'ASSET' ? 'bg-app-info-bg text-app-info border-app-info/30' :
 node.type === 'LIABILITY' ? 'bg-app-error-bg text-app-error border-app-error/30' :
 node.type === 'EQUITY' ? 'bg-app-surface-2 text-app-muted-foreground border-app-border' :
 node.type === 'INCOME' ? 'bg-app-primary-light text-app-success border-app-success' :
 'bg-app-warning-bg text-app-warning border-app-warning'
 }`}>
 {node.type}
 </span>
 {!node.isActive && (
 <span className="ml-1 text-[8px] font-black text-rose-500 bg-rose-50 px-1 rounded uppercase">Inactive</span>
 )}
 </div>

 {/* Balance */}
 <div className={`w-32 text-right pr-4 font-mono text-sm ${node.balance < 0 ? 'text-app-error' : 'text-app-foreground'}`}>
 {node.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
 </div>

 {/* Actions */}
 <div className="w-16 flex items-center justify-end pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
 <button
 title="Edit / Revise Account"
 onClick={() => (window as any).openEditModal(node)}
 className="p-1.5 hover:bg-app-border rounded-md text-app-muted-foreground"
 >
 <Pencil size={12} />
 </button>
 <button
 title="Add Sub-Account"
 onClick={() => (window as any).openAddModal(node.id)}
 className="p-1.5 hover:bg-app-border rounded-md text-app-muted-foreground"
 >
 <Plus size={14} />
 </button>
 {!node.isActive && (
 <button
 title="Reactivate Account"
 onClick={() => (window as any).reactivateAccount(node.id)}
 className="p-1.5 hover:bg-app-primary-light rounded-md text-app-primary"
 >
 <Power size={14} />
 </button>
 )}
 </div>
 </div>

 {/* Render Children */}
 {isParent && isOpen && (
 <div className="animate-in fade-in slide-in-from-top-1 duration-200">
 {node.children.map((child: Record<string, any>) => (
 <AccountNode key={child.id} node={child} level={level + 1} accounts={accounts} />
 ))}
 </div>
 )}
 </div>
 )
}

export function ChartOfAccountsViewer({ accounts }: { accounts: Record<string, any>[] }) {
 const router = useRouter()
 const [isPending, startTransition] = useTransition()
 const [isAdding, setIsAdding] = useState(false)
 const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null)
 const [preselectedParentId, setPreselectedParentId] = useState<number | undefined>(undefined)
 const [showInactive, setShowInactive] = useState(false)

 // Build hierarchical tree
 const tree = useMemo(() => {
 const filtered = showInactive ? accounts : accounts.filter(a => a.isActive)

 const dataMap: Record<string, any> = {}
 filtered.forEach(acc => {
 dataMap[acc.id] = { ...acc, children: [] }
 })

 const rootNodes: Record<string, any>[] = []
 filtered.forEach(acc => {
 if (acc.parentId && dataMap[acc.parentId]) {
 dataMap[acc.parentId].children.push(dataMap[acc.id])
 } else if (!acc.parentId) {
 rootNodes.push(dataMap[acc.id])
 }
 })

 return rootNodes
 }, [accounts, showInactive])

 async function handleCreate(formData: FormData) {
 const code = formData.get('code') as string
 const name = formData.get('name') as string
 const type = formData.get('type') as string
 const subType = formData.get('subType') as string
 const parentId = formData.get('parentId') ? parseInt(formData.get('parentId') as string) : undefined
 const syscohadaCode = formData.get('syscohadaCode') as string
 const syscohadaClass = formData.get('syscohadaClass') as string

 startTransition(async () => {
 const { createAccount } = await import('@/app/actions/finance/accounts')
 try {
 await createAccount({ code, name, type, subType, parentId, syscohadaCode, syscohadaClass })
 setIsAdding(false)
 setPreselectedParentId(undefined)
 router.refresh()
 } catch (e: unknown) {
 toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
 }
 })
 }

 const openAddModal = (parentId?: number) => {
 setPreselectedParentId(parentId)
 setIsAdding(true)
 }

 const [pendingAction, setPendingAction] = useState<{ type: string; title: string; description: string; variant: 'danger' | 'warning' | 'info'; id?: number } | null>(null)

 const reactivateAccount = (id: number) => {
 setPendingAction({
 type: 'reactivate',
 title: 'Reactivate Account?',
 description: 'This will reactivate the deactivated account.',
 variant: 'warning',
 id,
 })
 }

 const handleConfirmAction = () => {
 if (!pendingAction) return
 if (pendingAction.type === 'reactivate' && pendingAction.id) {
 startTransition(async () => {
 const { reactivateChartOfAccount } = await import('@/app/actions/finance/accounts')
 try {
 await reactivateChartOfAccount(pendingAction.id!)
 router.refresh()
 } catch (e: unknown) {
 toast.error('Error: ' + (e instanceof Error ? e.message : String(e)))
 }
 })
 } else if (pendingAction.type === 'recalculate') {
 startTransition(async () => {
 await recalculateAccountBalances()
 router.refresh()
 toast.success('System balances recalculated successfully.')
 })
 }
 setPendingAction(null)
 }

 const openEditModal = (account: Record<string, any>) => {
 setEditingAccount(account as unknown as ChartOfAccount)
 }

 // Expose globally for children to use
 if (typeof window !== 'undefined') {
 (window as any).openAddModal = openAddModal;
 (window as any).openEditModal = openEditModal;
 (window as any).reactivateAccount = reactivateAccount;
 }

 async function handleUpdate(formData: FormData) {
 if (!editingAccount) return
 const code = formData.get('code') as string
 const name = formData.get('name') as string
 const type = formData.get('type') as string
 const subType = formData.get('subType') as string
 const parentId = formData.get('parentId') ? parseInt(formData.get('parentId') as string) : null
 const syscohadaCode = formData.get('syscohadaCode') as string
 const syscohadaClass = formData.get('syscohadaClass') as string

 startTransition(async () => {
 const { updateChartOfAccount } = await import('@/app/actions/finance/accounts')
 try {
 await updateChartOfAccount(editingAccount.id, {
 code, name, type, subType, parentId, syscohadaCode, syscohadaClass, isActive: true
 })
 setEditingAccount(null)
 router.refresh()
 } catch (err: unknown) {
 toast.error('Update Error: ' + (err instanceof Error ? err.message : String(err)))
 }
 })
 }

 return (
 <div className="bg-app-surface rounded-lg shadow-sm border border-app-border overflow-hidden">
 {/* Toolbar */}
 <div className="p-4 border-b border-app-border bg-app-background flex justify-between items-center">
 <div className="flex items-center gap-3">
 <FolderOpen className="text-app-muted-foreground" />
 <h2 className="text-lg font-bold text-app-foreground">Account Hierarchy</h2>
 <span className="bg-app-border text-app-muted-foreground text-xs px-2 py-0.5 rounded-full">{accounts.length} Total</span>

 {accounts.some(a => !a.isActive) && (
 <button
 onClick={() => setShowInactive(!showInactive)}
 className={`flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full transition-all ${showInactive ? 'bg-app-warning-bg text-app-warning border border-app-warning' : 'bg-app-surface-2 text-app-muted-foreground border border-app-border hover:text-app-muted-foreground'}`}
 >
 {showInactive ? <Eye size={12} /> : <EyeOff size={12} />}
 {showInactive ? 'Showing Inactive' : 'Show Inactive'}
 </button>
 )}
 </div>
 <div className="flex items-center gap-3">
 <button
 onClick={() => router.push('/finance/chart-of-accounts/templates')}
 className="flex items-center gap-2 text-xs font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-3 py-1.5 rounded-md hover:bg-app-surface transition-all shadow-sm"
 >
 <Library size={14} />
 Templates Library
 </button>
 <button
 onClick={() => {
 setPendingAction({
 type: 'recalculate',
 title: 'Recalculate Account Balances?',
 description: 'This will rebuild all account balances from scratch using posted journal entries.',
 variant: 'danger',
 })
 }}
 disabled={isPending}
 title="Audit & Recalculate System Balances"
 className="flex items-center gap-2 text-xs font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-3 py-1.5 rounded-md hover:bg-app-surface transition-all disabled:opacity-50"
 >
 <RefreshCcw size={14} className={isPending ? 'animate-spin' : ''} />
 Audit Integrity
 </button>
 <button
 onClick={() => openAddModal()}
 className="flex items-center gap-2 text-sm bg-app-background text-app-foreground px-3 py-1.5 rounded-md hover:bg-app-surface-2 transition-colors shadow-sm"
 >
 <Plus size={16} /> New Account
 </button>
 </div>
 </div>

 {/* Quick Add Form - Main Toolbar Version */}
 {isAdding && (
 <div className="p-4 border-b border-2 border-app-info/30 bg-app-info-bg/50">
 <h3 className="text-sm font-bold text-app-foreground mb-3">
 {preselectedParentId ? `Adding Sub-Account` : 'Adding New Root Account'}
 </h3>
 <form action={handleCreate} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
 <div className="md:col-span-1">
 <label className="block text-xs font-medium text-app-muted-foreground mb-1">Code</label>
 <input name="code" placeholder="1010" className="w-full text-sm border p-2 rounded focus:ring-black focus:border-black" required />
 </div>
 <div className="md:col-span-2">
 <label className="block text-xs font-medium text-app-muted-foreground mb-1">Name</label>
 <input name="name" placeholder="Account Name" className="w-full text-sm border p-2 rounded focus:ring-black focus:border-black" required />
 </div>
 <div className="md:col-span-2">
 <label className="block text-xs font-medium text-app-muted-foreground mb-1">Type</label>
 <select name="type" className="w-full text-sm border p-2 rounded focus:ring-black focus:border-black">
 <option value="ASSET">Asset</option>
 <option value="LIABILITY">Liability</option>
 <option value="EQUITY">Equity</option>
 <option value="INCOME">Income</option>
 <option value="EXPENSE">Expense</option>
 </select>
 </div>
 <div className="md:col-span-2">
 <label className="block text-xs font-medium text-app-muted-foreground mb-1">Sub-Type</label>
 <select name="subType" className="w-full text-sm border p-2 rounded focus:ring-black focus:border-black">
 <option value="">None</option>
 <option value="CASH">Cash</option>
 <option value="BANK">Bank</option>
 <option value="RECEIVABLE">Receivable</option>
 <option value="PAYABLE">Payable</option>
 </select>
 </div>
 <div className="md:col-span-2">
 <label className="block text-xs font-medium text-app-muted-foreground mb-1">Parent</label>
 <select
 name="parentId"
 defaultValue={preselectedParentId || ''}
 className="w-full text-sm border p-2 rounded focus:ring-black focus:border-black font-mono text-xs"
 >
 <option value="">(Root)</option>
 {accounts.map(a => (
 <option key={a.id} value={a.id}>
 {a.code} - {a.name}
 </option>
 ))}
 </select>
 </div>
 <div className="md:col-span-2">
 <label className="block text-xs font-medium text-app-muted-foreground mb-1">SYSCOHADA</label>
 <div className="flex gap-1">
 <input name="syscohadaCode" placeholder="Code (57)" className="w-1/3 text-[10px] border p-1.5 rounded" />
 <input name="syscohadaClass" placeholder="Class" className="w-2/3 text-[10px] border p-1.5 rounded" />
 </div>
 </div>
 <div className="md:col-span-1 flex gap-2">
 <button disabled={isPending} type="submit" className="w-full bg-app-info text-app-foreground p-2 rounded text-sm font-medium hover:bg-app-info">
 {isPending ? '...' : 'Save'}
 </button>
 <button type="button" onClick={() => setIsAdding(false)} className="bg-app-surface border border-app-border text-app-muted-foreground p-2 rounded text-sm hover:bg-app-background">X</button>
 </div>
 </form>
 </div>
 )}

 {/* Tree List */}
 <div className="min-w-[800px] overflow-x-auto">
 <div className="bg-app-background border-b p-2 flex text-xs font-bold text-app-muted-foreground uppercase">
 <div className="flex-1 pl-8">Account</div>
 <div className="w-48 text-app-primary">SYSCOHADA Mapping</div>
 <div className="w-32">Type</div>
 <div className="w-32 text-right pr-4">Balance</div>
 <div className="w-16"></div>
 </div>

 {tree.map((node: Record<string, any>) => (
 <AccountNode key={node.id} node={node} level={0} accounts={accounts} />
 ))}

 {tree.length === 0 && (
 <div className="p-12 text-center text-app-muted-foreground italic">
 No accounts defined yet. Start building your chart of accounts.
 </div>
 )}
 </div>

 {/* Edit / Revise Modal */}
 {editingAccount && (
 <EditModal
 account={editingAccount}
 accounts={accounts}
 onUpdate={handleUpdate}
 onClose={() => setEditingAccount(null)}
 isPending={isPending}
 />
 )}

 <ConfirmDialog
 open={pendingAction !== null}
 onOpenChange={(open) => { if (!open) setPendingAction(null) }}
 onConfirm={handleConfirmAction}
 title={pendingAction?.title ?? ''}
 description={pendingAction?.description ?? ''}
 confirmText="Confirm"
 variant={pendingAction?.variant ?? 'warning'}
 />
 </div>
 )
}

const EditModal = ({ account, accounts, onUpdate, onClose, isPending }: Record<string, any>) => {
 return (
 <div className="fixed inset-0 bg-app-surface/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
 <div className="bg-app-surface rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
 <div className="p-6 border-b border-app-border flex justify-between items-center bg-app-background">
 <div>
 <h3 className="text-xl font-bold text-app-foreground">Revise Account Hierarchy</h3>
 <p className="text-xs text-app-muted-foreground font-bold uppercase tracking-widest mt-1">Modifying: {account.name}</p>
 </div>
 <button onClick={onClose} className="p-2 hover:bg-app-border rounded-full transition-colors">
 <X size={20} className="text-app-muted-foreground" />
 </button>
 </div>
 <form action={onUpdate} className="p-8 space-y-6">
 <div className="grid grid-cols-2 gap-6">
 <div className="space-y-1">
 <label className="text-[10px] font-black uppercase text-app-muted-foreground tracking-widest">Account Code</label>
 <input name="code" defaultValue={account.code} className="w-full p-3 bg-app-background border border-app-border rounded-xl focus:ring-4 focus:ring-black/5 outline-none transition-all font-mono font-bold" required />
 </div>
 <div className="space-y-1">
 <label className="text-[10px] font-black uppercase text-app-muted-foreground tracking-widest">Display Name</label>
 <input name="name" defaultValue={account.name} className="w-full p-3 bg-app-background border border-app-border rounded-xl focus:ring-4 focus:ring-black/5 outline-none transition-all font-bold" required />
 </div>
 <div className="space-y-1">
 <label className="text-[10px] font-black uppercase text-app-muted-foreground tracking-widest">Financial Type</label>
 <select name="type" defaultValue={account.type} className="w-full p-3 bg-app-background border border-app-border rounded-xl focus:ring-4 focus:ring-black/5 outline-none transition-all font-bold">
 <option value="ASSET">Asset</option>
 <option value="LIABILITY">Liability</option>
 <option value="EQUITY">Equity</option>
 <option value="INCOME">Income</option>
 <option value="EXPENSE">Expense</option>
 </select>
 </div>
 <div className="space-y-1">
 <label className="text-[10px] font-black uppercase text-app-muted-foreground tracking-widest">Account Category (Sub-Type)</label>
 <select name="subType" defaultValue={account.subType || ''} className="w-full p-3 bg-app-background border border-app-border rounded-xl focus:ring-4 focus:ring-black/5 outline-none transition-all font-bold">
 <option value="">Standard Ledger Account</option>
 <option value="CASH">Liquid Cash</option>
 <option value="BANK">Bank Holding</option>
 <option value="RECEIVABLE">Trade Receivable (Customers)</option>
 <option value="PAYABLE">Trade Payable (Suppliers)</option>
 </select>
 </div>
 <div className="col-span-2 space-y-1">
 <label className="text-[10px] font-black uppercase text-app-muted-foreground tracking-widest">Parent Node (Hierarchy Position)</label>
 <select name="parentId" defaultValue={account.parentId || ''} className="w-full p-3 bg-app-background border border-app-border rounded-xl focus:ring-4 focus:ring-black/5 outline-none transition-all font-mono text-sm">
 <option value="">[TOP LEVEL ROOT]</option>
 {accounts.filter((a: Record<string, any>) => a.id !== account.id).map((a: Record<string, any>) => (
 <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
 ))}
 </select>
 </div>
 <div className="space-y-1">
 <label className="text-[10px] font-black uppercase text-app-muted-foreground tracking-widest">SYSCOHADA Code</label>
 <input name="syscohadaCode" defaultValue={account.syscohadaCode || ''} className="w-full p-3 bg-app-background border border-app-border rounded-xl focus:ring-4 focus:ring-black/5 outline-none transition-all font-mono" />
 </div>
 <div className="space-y-1">
 <label className="text-[10px] font-black uppercase text-app-muted-foreground tracking-widest">SYSCOHADA Classification</label>
 <input name="syscohadaClass" defaultValue={account.syscohadaClass || ''} className="w-full p-3 bg-app-background border border-app-border rounded-xl focus:ring-4 focus:ring-black/5 outline-none transition-all" />
 </div>
 </div>

 <div className="flex gap-4 pt-4">
 <button type="button" onClick={onClose} className="flex-1 p-4 rounded-2xl border border-app-border font-bold hover:bg-app-background transition-all">
 Discard Changes
 </button>
 <button type="submit" disabled={isPending} className="flex-2 bg-app-surface text-app-foreground px-12 rounded-2xl font-bold hover:bg-app-background transition-all shadow-xl shadow-stone-900/20 flex items-center gap-2">
 {isPending ? 'Saving Revisions...' : 'Apply Hierarchy Changes'}
 <RefreshCcw size={18} className={isPending ? 'animate-spin text-app-warning' : 'text-app-primary'} />
 </button>
 </div>
 </form>
 </div>
 </div>
 )
}