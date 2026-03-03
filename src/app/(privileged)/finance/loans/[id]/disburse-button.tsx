'use client'
// Force TS Refresh

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { FinanceAccountSelector } from "@/components/finance/finance-account-selector"
import { disburseLoan } from "@/app/actions/finance/loans"
import { useRouter } from "next/navigation"
import { Wallet } from "lucide-react"
import { toast } from 'sonner'

export function DisburseButton({ loanId, amount }: { loanId: number, amount: number }) {
 const [open, setOpen] = useState(false)
 const [loading, setLoading] = useState(false)
 const [accountId, setAccountId] = useState("")
 const router = useRouter()

 const handleDisburse = async () => {
 if (!accountId) return
 setLoading(true)
 try {
 const res = await disburseLoan(loanId, parseInt(accountId))
 if (res.success) {
 setOpen(false)
 router.refresh()
 // Optional: router.push(`/finance/events/${res.eventId}`)
 }
 } catch (error) {
 console.error(error)
 toast.error("Failed to disburse")
 } finally {
 setLoading(false)
 }
 }

 return (
 <Dialog open={open} onOpenChange={setOpen}>
 <DialogTrigger asChild>
 <Button className="bg-app-success hover:bg-app-success">
 <Wallet className="mr-2 h-4 w-4" /> Disburse Funds
 </Button>
 </DialogTrigger>
 <DialogContent>
 <DialogHeader>
 <DialogTitle>Disburse Loan Funds</DialogTitle>
 <DialogDescription>
 This will create a Financial Event for the receipt of <strong>{amount.toLocaleString()} USD</strong>.
 Please select the account where the money is received.
 </DialogDescription>
 </DialogHeader>

 <div className="py-4">
 <FinanceAccountSelector
 label="Deposit To Account"
 value={accountId}
 onChange={setAccountId}
 />
 </div>

 <DialogFooter>
 <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
 <Button onClick={handleDisburse} disabled={!accountId || loading} className="bg-app-success">
 {loading ? "Processing..." : "Confirm Disbursement"}
 </Button>
 </DialogFooter>
 </DialogContent>
 </Dialog>
 )
}