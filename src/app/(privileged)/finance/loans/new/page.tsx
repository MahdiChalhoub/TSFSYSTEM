'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createLoanContract } from "@/app/actions/finance/loans"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ContactPicker } from "@/components/finance/contact-picker"
import { ArrowLeft , Landmark } from "lucide-react"
import { toast } from 'sonner'
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function NewLoanPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        contactId: "",
        principal: "",
        interestRate: "0",
        interestType: "NONE",
        termMonths: "12",
        paymentFrequency: "MONTHLY",
        startDate: new Date().toISOString().split('T')[0]
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.contactId || !formData.principal) {
            toast.error("Partner and Principal Amount are required")
            return
        }

        setLoading(true)
        try {
            const res = await createLoanContract({
                contactId: parseInt(formData.contactId),
                principalAmount: parseFloat(formData.principal) || 0,
                interestRate: parseFloat(formData.interestRate) || 0,
                interestType: formData.interestType as any,
                termMonths: parseInt(formData.termMonths) || 12,
                startDate: new Date(formData.startDate),
                paymentFrequency: formData.paymentFrequency as any
            })

            if (res.success) {
                router.push(`/finance/loans/${res.loanId}`)
            }
        } catch (error: unknown) {
            console.error(error)
            toast.error("Failed to create contract: " + ((error instanceof Error ? error.message : String(error)) || "Unknown error"))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/finance/loans">
                    <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                </Link>
                <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[1.5rem] bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-200">
                        <Landmark size={28} className="text-white" />
                    </div>
                    New <span className="text-violet-600">Loan</span>
                </h1>
                <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Create Loan</p>
                <div className="ml-auto text-xs font-mono text-stone-400">
                    Draft Contract Numbering Active
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Loan Contract Terms</CardTitle>
                    <CardDescription>Define the terms for the new partner loan.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-6">
                            <ContactPicker
                                type="PARTNER"
                                label="Select Partner"
                                value={formData.contactId}
                                onChange={val => setFormData({ ...formData, contactId: val })}
                            />

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Principal Amount (USD)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.principal}
                                    onChange={e => setFormData({ ...formData, principal: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Interest Rate (%)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formData.interestRate}
                                    onChange={e => setFormData({ ...formData, interestRate: e.target.value })}
                                />
                                <p className="text-xs text-muted-foreground">0 for interest-free.</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Interest Type</label>
                                <Select
                                    value={formData.interestType}
                                    onValueChange={val => setFormData({ ...formData, interestType: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NONE">None</SelectItem>
                                        <SelectItem value="SIMPLE">Simple Interest</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Term (Months)</label>
                                <Input
                                    type="number"
                                    value={formData.termMonths}
                                    onChange={e => setFormData({ ...formData, termMonths: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Payment Frequency</label>
                                <Select
                                    value={formData.paymentFrequency}
                                    onValueChange={val => setFormData({ ...formData, paymentFrequency: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                                        <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Start Date</label>
                                <Input
                                    type="date"
                                    value={formData.startDate}
                                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Generating Contract..." : "Create Contract"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}