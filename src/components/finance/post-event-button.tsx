'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { postFinancialEvent } from "@/app/actions/finance/financial-events"
import { Button } from "@/components/ui/button"
import { FinanceAccountSelector } from "@/components/finance/finance-account-selector"
import { Loader2 } from "lucide-react"
import { toast } from 'sonner'

export function PostEventButton({
 eventId,
 eventType,
 disabled = false
}: {
 eventId: number,
 eventType?: string,
 disabled?: boolean
}) {
 const router = useRouter()
 const [loading, setLoading] = useState(false)
 const [financialAccountId, setFinancialAccountId] = useState("")
 // We also need the Ledger Account ID effectively. 
 // Ideally the user selects the "Main Safe", and we look up its ledger account in the backend or frontend.
 // Simplifying assumption: The UI Selector will return the ID of FinancialAccount.
 // The Backend needs to solve the mapping. 
 // BUT the current postFinancialEvent requires 3 args: id, financialAccountId, ledgerAccountId.
 // This implies the UI needs to know the ledger ID.
 // Let's assume for now we hardcode or fetch the mapping.
 // Actually, let's update `getFinancialAccounts` to return the linked ledger account ID if possible?
 // OR create a mapping action.

 // WORKAROUND: For now, I will fetch accounts with their ledger mapping (if schema allowed) 
 // or just ask user for the ChartOfAccount separately (bad UX).
 // Better: Allow `postFinancialEvent` to lookup the default cash account (5700) if not provided, 
 // or assume the Financial Account is linked to a generic 5700.
 // 
 // In my test script I passed: safeAcc.id, cashAcc.id
 // Realistically, the FinancialAccount should have a 'linkedLedgerAccountId' field. It currently doesn't.
 // So for this MVP, I will pass the HARDCODED 5700 (or fetch it) as the Ledger ID for Cash.
 // OR I add a Ledger Account Selector too.

 // Let's add a second selector for "Ledger Account" to be precise, defaulting to 5700?
 // No, that's too technical for user.
 // I will fetch the "Main Cash" account (5700) ID via a server action helper here.
 // But I can't easily call DB here.

 // Alternative: Update `postFinancialEvent` to find the 5700 account itself if not provided.
 // I will change the UI to just asking for Financial Account (Safe) and assume 5700 for now, 
 // or better, I will assume the `financial-events.ts` logic can handle looking up the default Cash account.

 const getLabel = () => {
 if (!eventType) return "Deposit/Withdraw To"

 const receipts = ['PARTNER_LOAN', 'PARTNER_CAPITAL_INJECTION', 'REFUND_RECEIVED', 'SALE_PAYMENT']
 const payments = ['PARTNER_WITHDRAWAL', 'PURCHASE_PAYMENT', 'EXPENSE_PAYMENT']

 if (receipts.includes(eventType)) return "Deposit To Account"
 if (payments.includes(eventType)) return "Withdraw From Account"

 return "Target Financial Account"
 }

 // Actually, I'll cheat slightly for MVP speed: 
 // I will require the user to pick the Financial Account.
 // I will pass a placeholder for Ledger Account (e.g. 0) and let the backend find "5700" 
 // OR I will fix the backend to find 5700 if 0 is passed.

 // Let's do this: 
 // 1. User picks Financial Account (Safe 1).
 // 2. We submit.
 // 3. Backend looks up '5700'.

 // BUT `postFinancialEvent` signature is Strict.
 // I should create a wrapper action `postFinancialEventUI` that handles the lookup.

 const handlePost = async () => {
 if (!financialAccountId) {
 toast.error("Please select a target account (Safe/Bank)")
 return
 }

 setLoading(true)
 try {
 // We need a server action that fills the gap.
 // I will call a new action `postFinancialEventFromUI` which I will Create.
 // It will find the default 5700 account and then call the real post.

 const res = await callPostAction(eventId, parseInt(financialAccountId))

 if (res.success) {
 router.refresh()
 }
 } catch (error) {
 console.error(error)
 toast.error("Failed to post event")
 } finally {
 setLoading(false)
 }
 }

 return (
 <div className="flex items-end gap-4 border p-4 rounded-lg bg-muted/20">
 <div className="flex-1">
 <FinanceAccountSelector
 label={getLabel()}
 value={financialAccountId}
 onChange={setFinancialAccountId}
 />
 </div>
 <Button onClick={handlePost} disabled={disabled || loading || !financialAccountId}>
 {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
 Post to Ledger
 </Button>
 </div>
 )
}

// Wrapper Action (Internal to this file or separate? Separate is better for 'use server')
import { postFinancialEventFromUI } from "@/app/actions/finance/ui-actions"

async function callPostAction(eventId: number, financialAccountId: number) {
 return await postFinancialEventFromUI(eventId, financialAccountId)
}
