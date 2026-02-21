'use client'

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createFinancialAccount, getOrgCurrency } from "../actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ArrowLeft, Info, Link as LinkIcon, Loader2 } from "lucide-react"
import Link from "next/link"

export default function NewFinancialAccountPage() {
    const router = useRouter()
    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
        defaultValues: {
            name: '',
            type: 'CASH' as 'CASH' | 'BANK' | 'MOBILE',
            currency: 'USD'
        }
    })

    const [loading, setLoading] = useState(false)
    const [currencyLoading, setCurrencyLoading] = useState(true)
    const type = watch('type')
    const currency = watch('currency')

    // Fetch org's base currency on mount
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

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/finance/accounts">
                    <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold">New Financial Account</h1>
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

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Type</label>
                                <Select onValueChange={v => setValue('type', v as any)} defaultValue="CASH">
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CASH">Cash Drawer</SelectItem>
                                        <SelectItem value="BANK">Bank Account</SelectItem>
                                        <SelectItem value="MOBILE">Mobile Wallet</SelectItem>
                                    </SelectContent>
                                </Select>
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
                        </div>

                        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100 flex gap-3 items-start">
                            <LinkIcon className="h-5 w-5 text-emerald-600 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-bold text-emerald-900 leading-none mb-1">Automated Ledger Link</h4>
                                <p className="text-xs text-emerald-700">
                                    A matching account will be created automatically in your Chart of Accounts (COA) under
                                    {type === 'CASH' ? ' 5700 (Cash)' : type === 'BANK' ? ' 5120 (Bank)' : ' 5121 (Mobile)'}.
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