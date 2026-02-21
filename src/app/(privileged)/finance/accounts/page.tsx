'use client'

import { useEffect, useState } from "react"
import type { ChartOfAccount } from '@/types/erp'
import { getFinancialAccounts, deleteFinancialAccount, assignUserToAccount, unassignUser, togglePosAccess } from "./actions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Wallet, User as UserIcon, Building, Smartphone, Link as LinkIcon, AlertCircle, BookOpen, BarChart3, Monitor, Briefcase, PiggyBank, Globe2, Lock, TrendingUp } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { UserPicker } from "@/components/admin/user-picker" // Assuming this exists or I'll create one

export default function FinancialAccountsPage() {
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
    const [loading, setLoading] = useState(true)

    const load = async () => {
        try {
            const data = await getFinancialAccounts()
            setAccounts(data)
        } catch (e) {
            console.error(e)
            toast.error("Failed to load accounts")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { load() }, [])

    const [deleteTarget, setDeleteTarget] = useState<number | null>(null)

    const handleDelete = async (id: number) => {
        setDeleteTarget(id)
    }

    const confirmDelete = async () => {
        if (deleteTarget === null) return
        try {
            await deleteFinancialAccount(deleteTarget)
            toast.success("Account deleted")
            load()
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        }
        setDeleteTarget(null)
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold">Financial Accounts</h1>
                    <p className="text-muted-foreground">Manage cash drawers, bank accounts, and their ledger links.</p>
                </div>
                <Link href="/finance/accounts/new">
                    <Button><Plus className="mr-2 h-4 w-4" /> New Account</Button>
                </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {accounts.map(account => (
                    <AccountCard
                        key={account.id}
                        account={account}
                        onDelete={() => handleDelete(account.id)}
                        onRefresh={load}
                    />
                ))}
            </div>

            {!loading && accounts.length === 0 && (
                <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                    No financial accounts found. Create one to get started.
                </div>
            )}

            <ConfirmDialog
                open={deleteTarget !== null}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
                onConfirm={confirmDelete}
                title="Delete Financial Account?"
                description="This cannot be undone if transactions exist."
                variant="danger"
            />
        </div>
    )
}

function AccountCard({ account, onDelete, onRefresh }: { account: Record<string, any>, onDelete: () => void, onRefresh: () => void }) {
    const icon: Record<string, any> = {
        'CASH': Wallet,
        'BANK': Building,
        'MOBILE': Smartphone,
        'PETTY_CASH': Briefcase,
        'SAVINGS': PiggyBank,
        'FOREIGN': Globe2,
        'ESCROW': Lock,
        'INVESTMENT': TrendingUp,
    }

    // Check Config Health
    const isConfigured = !!account.ledgerAccount

    const Icon = icon[account.type] || Wallet
    const [unassignTarget, setUnassignTarget] = useState<{ userId: number; name: string } | null>(null)

    // Format balance
    const balance = parseFloat(account.balance || 0)
    const formattedBalance = new Intl.NumberFormat('en-US', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(balance)

    return (
        <Card className="relative group">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${isConfigured ? 'bg-primary/10 text-primary' : 'bg-red-100 text-red-600'}`}>
                            <Icon className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">{account.name}</CardTitle>
                            <CardDescription>{account.type} · {account.currency}</CardDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={onDelete}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">

                {/* Balance Display */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border">
                    <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Balance</p>
                    <p className={`text-xl font-bold tabular-nums ${balance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                        {account.currency} {formattedBalance}
                    </p>
                </div>

                {/* Ledger Link Status */}
                <div className={`text-xs p-2 rounded-xl border flex items-center justify-between ${isConfigured ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                    <div className="flex items-center gap-2 truncate">
                        {isConfigured ? (
                            <>
                                <LinkIcon className="h-3 w-3" />
                                <span className="truncate">Ledger: {account.ledgerAccount.code} — {account.ledgerAccount.name}</span>
                            </>
                        ) : (
                            <>
                                <AlertCircle className="h-4 w-4" />
                                <span className="font-bold">Missing Ledger Link!</span>
                            </>
                        )}
                    </div>
                    {isConfigured && (
                        <Badge variant="outline" className="text-[10px] bg-white text-emerald-600 border-emerald-200 shrink-0">System Managed</Badge>
                    )}
                </div>

                {/* Action Buttons */}
                {isConfigured && (
                    <div className="flex gap-2">
                        <Link href={`/finance/ledger?account=${account.ledgerAccount.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full text-xs">
                                <BookOpen className="h-3 w-3 mr-1" />
                                View Ledger
                            </Button>
                        </Link>
                        <Link href={`/finance/bank-reconciliation?account_id=${account.ledgerAccount.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full text-xs">
                                <BarChart3 className="h-3 w-3 mr-1" />
                                Statement
                            </Button>
                        </Link>
                    </div>
                )}
                {/* POS Access Toggle */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border">
                    <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-slate-500" />
                        <span className="text-xs font-medium">POS Access</span>
                    </div>
                    <button
                        onClick={async () => {
                            try {
                                await togglePosAccess(account.id, !account.is_pos_enabled)
                                onRefresh()
                                toast.success(account.is_pos_enabled ? 'POS access disabled' : 'POS access enabled')
                            } catch { toast.error('Failed to toggle POS access') }
                        }}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${account.is_pos_enabled ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                    >
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${account.is_pos_enabled ? 'translate-x-4' : 'translate-x-0.5'
                            }`} />
                    </button>
                </div>

                {/* Assigned Users */}
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-xs font-semibold uppercase text-muted-foreground">Assigned Users</h4>
                        <AssignUserDialog accountId={account.id} onAssign={onRefresh} />
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {account.assignedUsers && account.assignedUsers.length > 0 ? (
                            account.assignedUsers.map((u: Record<string, any>) => (
                                <Badge key={u.id} variant="secondary" className="flex items-center gap-1 pr-1">
                                    <UserIcon className="h-3 w-3" />
                                    {u.name}
                                    <button
                                        className="ml-1 hover:bg-slate-200 rounded-full p-0.5"
                                        onClick={() => setUnassignTarget({ userId: u.id, name: u.name })}
                                    >
                                        &times;
                                    </button>
                                </Badge>
                            ))
                        ) : (
                            <span className="text-sm text-gray-400 italic">No active users</span>
                        )}
                    </div>
                </div>

            </CardContent>

            <ConfirmDialog
                open={unassignTarget !== null}
                onOpenChange={(open) => { if (!open) setUnassignTarget(null) }}
                onConfirm={async () => {
                    if (unassignTarget) {
                        await unassignUser(unassignTarget.userId, account.id)
                        onRefresh()
                    }
                    setUnassignTarget(null)
                }}
                title={`Unassign ${unassignTarget?.name ?? ''}?`}
                description="This user will no longer have access to this financial account."
                variant="warning"
            />
        </Card>
    )
}

function AssignUserDialog({ accountId, onAssign }: { accountId: number, onAssign: () => void }) {
    const [userId, setUserId] = useState<string>("")
    const [open, setOpen] = useState(false)

    const handleAssign = async () => {
        if (!userId) return
        try {
            await assignUserToAccount(parseInt(userId), accountId)
            toast.success("User assigned")
            setOpen(false)
            onAssign()
        } catch (e: unknown) {
            toast.error((e instanceof Error ? e.message : String(e)))
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 text-xs">+ Assign</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Assign User</DialogTitle>
                    <DialogDescription>Select a user to link to this cash drawer.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <UserPicker value={userId} onChange={setUserId} />
                    <Button onClick={handleAssign} disabled={!userId} className="w-full">Confirm Assignment</Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}