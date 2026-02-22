'use client'

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createFinancialAccount, getOrgCurrency } from "../actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Link as LinkIcon, Loader2 , WalletCards } from "lucide-react"
import Link from "next/link"

const ACCOUNT_TYPES = [
    { value: 'CASH', label: 'Cash Drawer', desc: 'Physical cash register or till' },
    { value: 'BANK', label: 'Bank Account', desc: 'Commercial banking account' },
    { value: 'MOBILE', label: 'Mobile Wallet', desc: 'Digital payment wallet (M-Pesa, etc.)' },
    { value: 'PETTY_CASH', label: 'Petty Cash', desc: 'Small cash fund for minor expenses' },
    { value: 'SAVINGS', label: 'Savings Account', desc: 'Interest-bearing savings' },
    { value: 'FOREIGN', label: 'Foreign Currency', desc: 'Account in non-base currency' },
    { value: 'ESCROW', label: 'Escrow Account', desc: 'Held funds pending conditions' },
    { value: 'INVESTMENT', label: 'Investment Account', desc: 'Long-term investment holdings' },
]

const COA_MAPPINGS: Record<string, string> = {
    'CASH': '5700 (Cash)',
    'BANK': '5120 (Bank)',
    'MOBILE': '5121 (Mobile)',
    'PETTY_CASH': '5300 (Petty Cash)',
    'SAVINGS': '5140 (Savings)',
    'FOREIGN': '5200 (Foreign Currency)',
    'ESCROW': '5500 (Escrow)',
    'INVESTMENT': '5600 (Investment)',
}

export default function NewFinancialAccountPage() {
    const router = useRouter()
    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
        defaultValues: {
            name: '',
            type: 'CASH' as string,
            currency: 'USD',
            description: '',
        }
    })

    const [loading, setLoading] = useState(false)
    const [currencyLoading, setCurrencyLoading] = useState(true)
    const type = watch('type')
    const currency = watch('currency')

    useEffect(() => {
        getOrgCurrency().then(code => {
            setValue('currency', code)
            setCurrencyLoading(false)
        }).catch(() => setCurrencyLoading(false))
    }, [setValue])

    const onSubmit = async (data: Record<string, any>) => {
        setLoading(true)
        try {
            await createFinancialAccount(data as { name: string; type: 'CASH' | 'BANK' | 'MOBILE'; currency: string })
            toast.success("Account created successfully")
            router.push('/finance/accounts')
        } catch (error: unknown) {
            toast.error((error instanceof Error ? error.message : String(error)))
        } finally {
            setLoading(false)
        }
    }

    const selectedType = ACCOUNT_TYPES.find(t => t.value === type)

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/finance/accounts">
                    <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                </Link>
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-[1.5rem] bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200">
                            <WalletCards size={28} className="text-white" />
                        </div>
                        New <span className="text-emerald-600">Account</span>
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Create Financial Account</p>
                    <p className="text-muted-foreground">Define a new physical money container.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Account Details</CardTitle>
                    <CardDescription>The system will automatically manage the accounting ledger link.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Account Name</label>
                            <Input placeholder="e.g. Front Desk Cash, Main Bank" {...register('name', { required: true })} />
                            {errors.name && <span className="text-red-500 text-xs">Required</span>}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Account Type</label>
                            <Select onValueChange={v => setValue('type', v)} defaultValue="CASH">
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {ACCOUNT_TYPES.map(t => (
                                        <SelectItem key={t.value} value={t.value}>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{t.label}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {selectedType && (
                                <p className="text-xs text-muted-foreground">{selectedType.desc}</p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Currency</label>
                            <div className="relative">
                                <Input value={currency} readOnly className="bg-muted pr-8" />
                                {currencyLoading && (
                                    <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Auto-set from organization&apos;s base currency
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Description <span className="text-muted-foreground">(optional)</span></label>
                            <Textarea placeholder="Notes about this account..." {...register('description')} rows={2} />
                        </div>

                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex gap-3 items-start">
                            <LinkIcon className="h-5 w-5 text-emerald-600 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-bold text-emerald-900 leading-none mb-1">Automated Ledger Link</h4>
                                <p className="text-xs text-emerald-700">
                                    A matching account will be created automatically in your Chart of Accounts (COA) under
                                    {' '}{COA_MAPPINGS[type] || 'the appropriate parent'}.
                                </p>
                            </div>
                        </div>

                        <Button type="submit" className="w-full" disabled={loading || currencyLoading}>
                            {loading ? "Initializing..." : "Create Account"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}