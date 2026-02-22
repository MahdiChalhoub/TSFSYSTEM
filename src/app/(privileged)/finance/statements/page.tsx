'use client'

import { useCurrency } from '@/lib/utils/currency'

import { useState, useEffect, useMemo } from "react"
import type { Contact } from '@/types/erp'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
    FileText, Search, Users, DollarSign, ShoppingCart,
    CreditCard, BookOpen, ArrowLeft
} from "lucide-react"
import { getContactStatement } from "@/app/actions/finance/bank-reconciliation"

export default function StatementsPage() {
    const { fmt } = useCurrency()
    const [contacts, setContacts] = useState<Contact[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
    const [detail, setDetail] = useState<Record<string, unknown> | null>(null)
    const [activeTab, setActiveTab] = useState<'orders' | 'payments' | 'journal'>('orders')

    useEffect(() => { loadContacts() }, [])

    async function loadContacts() {
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const data = await erpFetch('crm/contacts/')
            setContacts(Array.isArray(data) ? data : data.results || [])
        } catch {
            toast.error("Failed to load contacts")
        } finally {
            setLoading(false)
        }
    }

    async function viewStatement(contact: Record<string, any>) {
        setLoading(true)
        setSelectedContact(contact)
        try {
            const data = await getContactStatement(contact.id)
            setDetail(data)
        } catch {
            toast.error("Failed to load statement")
        } finally {
            setLoading(false)
        }
    }

    const filteredContacts = useMemo(() => {
        if (!search) return contacts
        const s = search.toLowerCase()
        return contacts.filter((c: Record<string, any>) =>
            c.name?.toLowerCase().includes(s) ||
            c.phone?.toLowerCase().includes(s) ||
            c.email?.toLowerCase().includes(s)
        )
    }, [contacts, search])

    if (loading && !detail && contacts.length === 0) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-96" />
            </div>
        )
    }

    // Detail View
    if (selectedContact && detail) {
        return (
            <div className="p-6 space-y-6">
                <header className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedContact(null); setDetail(null) }}>
                        <ArrowLeft size={16} className="mr-1" /> Back
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{detail.contact?.name || selectedContact.name}</h1>
                        <p className="text-sm text-gray-500">
                            <Badge variant="outline" className="mr-2">{detail.contact?.type || selectedContact.type}</Badge>
                            {detail.contact?.email} · {detail.contact?.phone}
                        </p>
                    </div>
                </header>

                {/* Summary Cards */}
                <div className="grid grid-cols-4 gap-4">
                    <Card className="border-l-4 border-l-blue-500">
                        <CardContent className="py-4 text-center">
                            <ShoppingCart size={20} className="mx-auto mb-1 text-blue-500" />
                            <p className="text-2xl font-bold">{detail.stats?.order_count || 0}</p>
                            <p className="text-[10px] text-gray-400 uppercase">Orders</p>
                        </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-emerald-500">
                        <CardContent className="py-4 text-center">
                            <DollarSign size={20} className="mx-auto mb-1 text-emerald-500" />
                            <p className="text-xl font-bold text-emerald-700">{fmt(detail.stats?.total_revenue || 0)}</p>
                            <p className="text-[10px] text-gray-400 uppercase">Total Revenue</p>
                        </CardContent>
                    </Card>
                    <Card className="border-l-4 border-l-purple-500">
                        <CardContent className="py-4 text-center">
                            <CreditCard size={20} className="mx-auto mb-1 text-purple-500" />
                            <p className="text-xl font-bold text-purple-700">{fmt(detail.stats?.total_paid || 0)}</p>
                            <p className="text-[10px] text-gray-400 uppercase">Total Paid</p>
                        </CardContent>
                    </Card>
                    <Card className={`border-l-4 ${(detail.balance?.amount || 0) > 0 ? 'border-l-red-500' : 'border-l-green-500'}`}>
                        <CardContent className="py-4 text-center">
                            <BookOpen size={20} className={`mx-auto mb-1 ${(detail.balance?.amount || 0) > 0 ? 'text-red-500' : 'text-green-500'}`} />
                            <p className={`text-xl font-bold ${(detail.balance?.amount || 0) > 0 ? 'text-red-700' : 'text-green-700'}`}>
                                {fmt(detail.balance?.amount || 0)}
                            </p>
                            <p className="text-[10px] text-gray-400 uppercase">Balance</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
                    {(['orders', 'payments', 'journal'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-1.5 text-sm rounded-md transition-all capitalize ${activeTab === tab ? 'bg-white shadow font-medium text-gray-900' : 'text-gray-500'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <Card>
                    <CardContent className="p-0">
                        {activeTab === 'orders' && (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50/50">
                                        <TableHead>Date</TableHead>
                                        <TableHead>Ref</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(detail.orders || []).length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">No orders</TableCell></TableRow>
                                    ) : (detail.orders || []).map((o: Record<string, any>) => (
                                        <TableRow key={o.id}>
                                            <TableCell className="text-sm">{o.date || '—'}</TableCell>
                                            <TableCell className="font-mono text-xs">{o.ref_code || `#${o.id}`}</TableCell>
                                            <TableCell><Badge variant="outline">{o.type}</Badge></TableCell>
                                            <TableCell className="text-sm text-gray-500">{o.status}</TableCell>
                                            <TableCell className="text-right font-bold">{fmt(o.total || 0)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                        {activeTab === 'payments' && (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50/50">
                                        <TableHead>Date</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(detail.payments || []).length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-8">No payments</TableCell></TableRow>
                                    ) : (detail.payments || []).map((p: Record<string, any>, i: number) => (
                                        <TableRow key={i}>
                                            <TableCell className="text-sm">{p.date || '—'}</TableCell>
                                            <TableCell className="font-mono text-xs">{p.reference || '—'}</TableCell>
                                            <TableCell><Badge variant="outline">{p.type}</Badge></TableCell>
                                            <TableCell className="text-right font-bold">{fmt(p.amount || 0)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                        {activeTab === 'journal' && (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-50/50">
                                        <TableHead>Date</TableHead>
                                        <TableHead>Reference</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Account</TableHead>
                                        <TableHead className="text-right">Debit</TableHead>
                                        <TableHead className="text-right">Credit</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {(detail.journal || []).length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">No journal entries</TableCell></TableRow>
                                    ) : (detail.journal || []).map((j: Record<string, any>) => (
                                        <TableRow key={j.id}>
                                            <TableCell className="text-sm">{j.date || '—'}</TableCell>
                                            <TableCell className="font-mono text-xs text-blue-600">{j.reference || '—'}</TableCell>
                                            <TableCell className="text-sm text-gray-600">{j.description}</TableCell>
                                            <TableCell className="text-sm">{j.account}</TableCell>
                                            <TableCell className="text-right text-sm text-emerald-700">
                                                {j.debit > 0 ? fmt(j.debit) : ''}
                                            </TableCell>
                                            <TableCell className="text-right text-sm text-red-700">
                                                {j.credit > 0 ? fmt(j.credit) : ''}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Contact List
    return (
        <div className="p-6 space-y-6">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center">
                            <FileText size={20} className="text-white" />
                        </div>
                        Account Statements
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">View customer & supplier financial history</p>
                </div>
                <div className="relative w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <Input placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
                </div>
            </header>

            <Card>
                <CardContent className="p-0">
                    {filteredContacts.length === 0 ? (
                        <div className="text-center py-16 text-gray-400">
                            <Users size={48} className="mx-auto mb-3 opacity-30" />
                            <p>No contacts found</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-50/50">
                                    <TableHead>Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredContacts.map((c: Record<string, any>) => (
                                    <TableRow key={c.id} className="hover:bg-gray-50/50">
                                        <TableCell className="font-medium">{c.name}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={c.type === 'CUSTOMER' ? 'text-blue-600' : 'text-orange-600'}>
                                                {c.type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-500">{c.phone || '—'}</TableCell>
                                        <TableCell className="text-sm text-gray-500">{c.email || '—'}</TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="outline" onClick={() => viewStatement(c)}>
                                                <FileText size={14} className="mr-1" /> Statement
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
