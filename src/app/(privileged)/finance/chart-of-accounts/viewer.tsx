'use client'

import { useState, useMemo, useTransition } from 'react'
import type { ChartOfAccount } from '@/types/erp'
import { ChevronRight, ChevronDown, Plus, Folder, FolderOpen, FileText, RefreshCcw, Library, Zap, Eye, EyeOff, Power, Pencil, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { recalculateAccountBalances } from '@/app/actions/finance/ledger'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

// Recursive Tree Node Component
const AccountNode = ({ node, level, accounts }: { node: any, level: number, accounts: any[] }) => {
    const isParent = node.children && node.children.length > 0
    const [isOpen, setIsOpen] = useState(level < 1) // Only open first level by default

    const toggle = () => setIsOpen(!isOpen)

    return (
        <div className={`flex flex-col border-stone-100 ${!node.isActive ? 'opacity-50 grayscale-[0.5]' : ''}`}>
            {/* Account Row */}
            <div
                className={`flex items-center group hover:bg-stone-50 transition-colors py-2 border-b border-stone-50 ${level === 0 ? 'bg-white' : ''}`}
                style={{ paddingLeft: `${level * 24}px` }}
            >
                <div className="flex-1 flex items-center gap-2">
                    {/* Expand/Collapse Toggle */}
                    <div className="w-6 flex justify-center">
                        {isParent ? (
                            <button onClick={toggle} className="p-1 hover:bg-stone-200 rounded text-stone-400">
                                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                        ) : (
                            <div className="w-4 h-4 rounded-full border border-stone-100 flex items-center justify-center opacity-30">
                                <div className="w-1 h-1 bg-stone-300 rounded-full" />
                            </div>
                        )}
                    </div>

                    {/* Icon based on status */}
                    <div className="text-stone-400">
                        {isParent ? (isOpen ? <FolderOpen size={16} className="text-amber-400" /> : <Folder size={16} className="text-amber-200" />) : <FileText size={16} />}
                    </div>

                    {/* Account Info */}
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-stone-400 w-12">{node.code}</span>
                            <span className={`text-sm font-medium ${level === 0 ? 'text-stone-900 font-bold' : 'text-stone-600'}`}>
                                {node.name}
                            </span>
                        </div>
                        {node.subType && (
                            <span className="text-[10px] text-stone-400 uppercase tracking-tighter">[{node.subType}]</span>
                        )}
                    </div>
                </div>

                {/* Regulatory Mapping */}
                <div className="w-48 flex flex-col justify-center">
                    {node.syscohadaCode && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded border border-stone-200">
                                {node.syscohadaCode}
                            </span>
                            {node.syscohadaClass && (
                                <span className="text-[9px] text-stone-400 font-medium truncate max-w-[120px]">
                                    {node.syscohadaClass}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Type Badge */}
                <div className="w-32 flex items-center">
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${node.type === 'ASSET' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        node.type === 'LIABILITY' ? 'bg-red-50 text-red-600 border-red-100' :
                            node.type === 'EQUITY' ? 'bg-stone-100 text-stone-600 border-stone-200' :
                                node.type === 'INCOME' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                    'bg-amber-100 text-amber-700 border-amber-200'
                        }`}>
                        {node.type}
                    </span>
                    {!node.isActive && (
                        <span className="ml-1 text-[8px] font-black text-rose-500 bg-rose-50 px-1 rounded uppercase">Inactive</span>
                    )}
                </div>

                {/* Balance */}
                <div className={`w-32 text-right pr-4 font-mono text-sm ${node.balance < 0 ? 'text-red-500' : 'text-stone-900'}`}>
                    {node.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>

                {/* Actions */}
                <div className="w-16 flex items-center justify-end pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        title="Edit / Revise Account"
                        onClick={() => (window as any).openEditModal(node)}
                        className="p-1.5 hover:bg-stone-200 rounded-md text-stone-500"
                    >
                        <Pencil size={12} />
                    </button>
                    <button
                        title="Add Sub-Account"
                        onClick={() => (window as any).openAddModal(node.id)}
                        className="p-1.5 hover:bg-stone-200 rounded-md text-stone-500"
                    >
                        <Plus size={14} />
                    </button>
                    {!node.isActive && (
                        <button
                            title="Reactivate Account"
                            onClick={() => (window as any).reactivateAccount(node.id)}
                            className="p-1.5 hover:bg-emerald-100 rounded-md text-emerald-600"
                        >
                            <Power size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Render Children */}
            {isParent && isOpen && (
                <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    {node.children.map((child: any) => (
                        <AccountNode key={child.id} node={child} level={level + 1} accounts={accounts} />
                    ))}
                </div>
            )}
        </div>
    )
}

export function ChartOfAccountsViewer({ accounts }: { accounts: any[] }) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [isAdding, setIsAdding] = useState(false)
    const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null)
    const [preselectedParentId, setPreselectedParentId] = useState<number | undefined>(undefined)
    const [showInactive, setShowInactive] = useState(false)

    // Build hierarchical tree
    const tree = useMemo(() => {
        const filtered = showInactive ? accounts : accounts.filter(a => a.isActive)

        const dataMap: any = {}
        filtered.forEach(acc => {
            dataMap[acc.id] = { ...acc, children: [] }
        })

        const rootNodes: any[] = []
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
            } catch (e: any) {
                toast.error('Error: ' + e.message)
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
                } catch (e: any) {
                    toast.error('Error: ' + e.message)
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

    const openEditModal = (account: any) => {
        setEditingAccount(account)
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
            } catch (err: any) {
                toast.error('Update Error: ' + err.message)
            }
        })
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-stone-200 bg-stone-50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <FolderOpen className="text-stone-400" />
                    <h2 className="text-lg font-bold text-stone-900">Account Hierarchy</h2>
                    <span className="bg-stone-200 text-stone-600 text-xs px-2 py-0.5 rounded-full">{accounts.length} Total</span>

                    {accounts.some(a => !a.isActive) && (
                        <button
                            onClick={() => setShowInactive(!showInactive)}
                            className={`flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full transition-all ${showInactive ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-stone-100 text-stone-400 border border-stone-200 hover:text-stone-600'}`}
                        >
                            {showInactive ? <Eye size={12} /> : <EyeOff size={12} />}
                            {showInactive ? 'Showing Inactive' : 'Show Inactive'}
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push('/finance/chart-of-accounts/migrate')}
                        className="flex items-center gap-2 text-xs font-bold text-amber-600 hover:text-amber-700 border border-amber-100 px-3 py-1.5 rounded-md hover:bg-amber-50 transition-all shadow-sm"
                    >
                        <Zap size={14} />
                        Migration Tool
                    </button>
                    <button
                        onClick={() => router.push('/finance/chart-of-accounts/templates')}
                        className="flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-stone-900 border border-stone-200 px-3 py-1.5 rounded-md hover:bg-white transition-all shadow-sm"
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
                        className="flex items-center gap-2 text-xs font-bold text-stone-500 hover:text-stone-900 border border-stone-200 px-3 py-1.5 rounded-md hover:bg-white transition-all disabled:opacity-50"
                    >
                        <RefreshCcw size={14} className={isPending ? 'animate-spin' : ''} />
                        Audit Integrity
                    </button>
                    <button
                        onClick={() => openAddModal()}
                        className="flex items-center gap-2 text-sm bg-black text-white px-3 py-1.5 rounded-md hover:bg-stone-800 transition-colors shadow-sm"
                    >
                        <Plus size={16} /> New Account
                    </button>
                </div>
            </div>

            {/* Quick Add Form - Main Toolbar Version */}
            {isAdding && (
                <div className="p-4 border-b border-2 border-blue-100 bg-blue-50/50">
                    <h3 className="text-sm font-bold text-stone-900 mb-3">
                        {preselectedParentId ? `Adding Sub-Account` : 'Adding New Root Account'}
                    </h3>
                    <form action={handleCreate} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                        <div className="md:col-span-1">
                            <label className="block text-xs font-medium text-stone-500 mb-1">Code</label>
                            <input name="code" placeholder="1010" className="w-full text-sm border p-2 rounded focus:ring-black focus:border-black" required />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-stone-500 mb-1">Name</label>
                            <input name="name" placeholder="Account Name" className="w-full text-sm border p-2 rounded focus:ring-black focus:border-black" required />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-stone-500 mb-1">Type</label>
                            <select name="type" className="w-full text-sm border p-2 rounded focus:ring-black focus:border-black">
                                <option value="ASSET">Asset</option>
                                <option value="LIABILITY">Liability</option>
                                <option value="EQUITY">Equity</option>
                                <option value="INCOME">Income</option>
                                <option value="EXPENSE">Expense</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-stone-500 mb-1">Sub-Type</label>
                            <select name="subType" className="w-full text-sm border p-2 rounded focus:ring-black focus:border-black">
                                <option value="">None</option>
                                <option value="CASH">Cash</option>
                                <option value="BANK">Bank</option>
                                <option value="RECEIVABLE">Receivable</option>
                                <option value="PAYABLE">Payable</option>
                            </select>
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-stone-500 mb-1">Parent</label>
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
                            <label className="block text-xs font-medium text-stone-500 mb-1">SYSCOHADA</label>
                            <div className="flex gap-1">
                                <input name="syscohadaCode" placeholder="Code (57)" className="w-1/3 text-[10px] border p-1.5 rounded" />
                                <input name="syscohadaClass" placeholder="Class" className="w-2/3 text-[10px] border p-1.5 rounded" />
                            </div>
                        </div>
                        <div className="md:col-span-1 flex gap-2">
                            <button disabled={isPending} type="submit" className="w-full bg-blue-600 text-white p-2 rounded text-sm font-medium hover:bg-blue-700">
                                {isPending ? '...' : 'Save'}
                            </button>
                            <button type="button" onClick={() => setIsAdding(false)} className="bg-white border border-stone-300 text-stone-600 p-2 rounded text-sm hover:bg-stone-50">X</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tree List */}
            <div className="min-w-[800px] overflow-x-auto">
                <div className="bg-stone-50 border-b p-2 flex text-xs font-bold text-stone-400 uppercase">
                    <div className="flex-1 pl-8">Account</div>
                    <div className="w-48 text-emerald-600">SYSCOHADA Mapping</div>
                    <div className="w-32">Type</div>
                    <div className="w-32 text-right pr-4">Balance</div>
                    <div className="w-16"></div>
                </div>

                {tree.map((node: any) => (
                    <AccountNode key={node.id} node={node} level={0} accounts={accounts} />
                ))}

                {tree.length === 0 && (
                    <div className="p-12 text-center text-stone-400 italic">
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

const EditModal = ({ account, accounts, onUpdate, onClose, isPending }: any) => {
    return (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                    <div>
                        <h3 className="text-xl font-bold text-stone-900">Revise Account Hierarchy</h3>
                        <p className="text-xs text-stone-500 font-bold uppercase tracking-widest mt-1">Modifying: {account.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
                        <X size={20} className="text-stone-400" />
                    </button>
                </div>
                <form action={onUpdate} className="p-8 space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Account Code</label>
                            <input name="code" defaultValue={account.code} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-4 focus:ring-black/5 outline-none transition-all font-mono font-bold" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Display Name</label>
                            <input name="name" defaultValue={account.name} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-4 focus:ring-black/5 outline-none transition-all font-bold" required />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Financial Type</label>
                            <select name="type" defaultValue={account.type} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-4 focus:ring-black/5 outline-none transition-all font-bold">
                                <option value="ASSET">Asset</option>
                                <option value="LIABILITY">Liability</option>
                                <option value="EQUITY">Equity</option>
                                <option value="INCOME">Income</option>
                                <option value="EXPENSE">Expense</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Account Category (Sub-Type)</label>
                            <select name="subType" defaultValue={account.subType || ''} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-4 focus:ring-black/5 outline-none transition-all font-bold">
                                <option value="">Standard Ledger Account</option>
                                <option value="CASH">Liquid Cash</option>
                                <option value="BANK">Bank Holding</option>
                                <option value="RECEIVABLE">Trade Receivable (Customers)</option>
                                <option value="PAYABLE">Trade Payable (Suppliers)</option>
                            </select>
                        </div>
                        <div className="col-span-2 space-y-1">
                            <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">Parent Node (Hierarchy Position)</label>
                            <select name="parentId" defaultValue={account.parentId || ''} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-4 focus:ring-black/5 outline-none transition-all font-mono text-sm">
                                <option value="">[TOP LEVEL ROOT]</option>
                                {accounts.filter((a: any) => a.id !== account.id).map((a: any) => (
                                    <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">SYSCOHADA Code</label>
                            <input name="syscohadaCode" defaultValue={account.syscohadaCode || ''} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-4 focus:ring-black/5 outline-none transition-all font-mono" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-stone-400 tracking-widest">SYSCOHADA Classification</label>
                            <input name="syscohadaClass" defaultValue={account.syscohadaClass || ''} className="w-full p-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-4 focus:ring-black/5 outline-none transition-all" />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button type="button" onClick={onClose} className="flex-1 p-4 rounded-2xl border border-stone-200 font-bold hover:bg-stone-50 transition-all">
                            Discard Changes
                        </button>
                        <button type="submit" disabled={isPending} className="flex-2 bg-stone-900 text-white px-12 rounded-2xl font-bold hover:bg-black transition-all shadow-xl shadow-stone-900/20 flex items-center gap-2">
                            {isPending ? 'Saving Revisions...' : 'Apply Hierarchy Changes'}
                            <RefreshCcw size={18} className={isPending ? 'animate-spin text-amber-400' : 'text-emerald-400'} />
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}