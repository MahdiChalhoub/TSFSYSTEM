'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createFinancialEvent } from "@/app/actions/finance/financial-events"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ContactPicker } from "@/components/finance/contact-picker"
import { FinanceAccountSelector } from "@/components/finance/finance-account-selector"
import { ArrowLeft, Wallet, ArrowDownLeft, ArrowUpRight, RotateCcw } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner" // Assuming sonner or similar toast exists, otherwise handled simply

type EventType = 'PARTNER_CAPITAL_INJECTION' | 'PARTNER_LOAN' | 'PARTNER_WITHDRAWAL' | 'REFUND_RECEIVED'

const EVENT_TYPES: { id: EventType; label: string; icon: React.ElementType; description: string }[] = [
    {
        id: 'PARTNER_CAPITAL_INJECTION',
        label: "Capital Injection",
        icon: Wallet,
        description: "Partner deposits personal funds into the business."
    },
    {
        id: 'PARTNER_LOAN',
        label: "Partner Loan",
        icon: ArrowDownLeft,
        description: "Money received from a partner as a loan (liability)."
    },
    {
        id: 'PARTNER_WITHDRAWAL',
        label: "Partner Withdrawal",
        icon: ArrowUpRight,
        description: "Partner withdraws funds for personal use."
    },
    {
        id: 'REFUND_RECEIVED',
        label: "Refund Received",
        icon: RotateCcw,
        description: "Cash refund received from a supplier."
    }
]

import { useSearchParams } from "next/navigation"

export default function NewFinancialEventPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const typeParam = searchParams.get('type')

    // Auto-select type if valid param is provided
    // Wrap initialization in useEffect to avoid hydration mismatch? 
    // Actually, simple state init from searchParams is okay if Suspense boundary is used, but for simplicity:
    const initialType = (typeParam && EVENT_TYPES.find(t => t.id === typeParam))
        ? typeParam as EventType
        : null

    const [selectedType, setSelectedType] = useState<EventType | null>(initialType)
    const [loading, setLoading] = useState(false)

    // Form State
    const [formData, setFormData] = useState({
        contactId: "",
        amount: "",
        reference: "",
        notes: "",
        date: new Date().toISOString().split('T')[0],
        targetAccountId: "" // New field due to user request
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedType) return
        if (!formData.contactId || !formData.amount || !formData.targetAccountId) {
            toast.error("Please fill in all required fields (including Account)")
            return
        }

        setLoading(true)
        try {
            // Import dynamically to avoid server component issues if any, though 'use server' handles it.
            // Using the new combined action
            const { createAndPostFinancialEvent } = await import("@/app/actions/finance/ui-actions")

            const res = await createAndPostFinancialEvent({
                eventType: selectedType,
                amount: parseFloat(formData.amount),
                date: new Date(formData.date),
                reference: formData.reference,
                notes: formData.notes,
                contactId: parseInt(formData.contactId),
                currency: 'USD',
                targetAccountId: parseInt(formData.targetAccountId)
            })

            if (res.success && res.eventId) {
                router.push(`/finance/events/${res.eventId}`)
                router.refresh()
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to create event")
        } finally {
            setLoading(false)
        }
    }

    // Determine Contact Type based on Event Type
    const contactType = selectedType === 'REFUND_RECEIVED' ? 'SUPPLIER' : 'PARTNER'

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/finance/events">
                    <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                </Link>
                <h1 className="text-2xl font-bold">New Financial Event</h1>
            </div>

            {!selectedType ? (
                <div className="grid md:grid-cols-2 gap-4">
                    {EVENT_TYPES.map(type => (
                        <Card
                            key={type.id}
                            className="cursor-pointer hover:border-primary transition-all hover:shadow-md"
                            onClick={() => setSelectedType(type.id)}
                        >
                            <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <type.icon className="h-6 w-6" />
                                </div>
                                <CardTitle className="text-lg">{type.label}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <CardDescription>{type.description}</CardDescription>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>{EVENT_TYPES.find(t => t.id === selectedType)?.label}</CardTitle>
                        <CardDescription>
                            Enter details for this transaction.
                            <Button variant="link" className="px-2 h-auto" onClick={() => setSelectedType(null)}>Change Type</Button>
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Date</label>
                                    <Input
                                        type="date"
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        required
                                    />
                                </div>

                                <ContactPicker
                                    type={contactType}
                                    label={contactType === 'PARTNER' ? "Select Partner" : "Select Supplier"}
                                    value={formData.contactId}
                                    onChange={val => setFormData({ ...formData, contactId: val })}
                                />

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Amount (USD)</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <FinanceAccountSelector
                                        label={
                                            selectedType === 'PARTNER_WITHDRAWAL'
                                                ? "Withdraw From Account (Source)"
                                                : "Deposit To Account (Target)"
                                        }
                                        value={formData.targetAccountId}
                                        onChange={val => setFormData({ ...formData, targetAccountId: val })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Reference (Optional)</label>
                                    <Input
                                        placeholder="Check #, Slip #..."
                                        value={formData.reference}
                                        onChange={e => setFormData({ ...formData, reference: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Notes</label>
                                <Textarea
                                    placeholder="Add any additional details..."
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>

                            <div className="bg-yellow-50 p-3 rounded-md text-sm text-yellow-800 border border-yellow-200">
                                <strong>Note:</strong> This will immediately post the transaction to the Ledger and update the selected account balance.
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <Button type="button" variant="outline" onClick={() => setSelectedType(null)}>Cancel</Button>
                                <Button type="submit" disabled={loading} className="bg-green-600 hover:bg-green-700 text-white">
                                    {loading ? "Processing..." : "Create & Post Immediately"}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}