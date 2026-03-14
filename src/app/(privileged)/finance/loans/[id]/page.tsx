import { getLoan } from "@/app/actions/finance/loans"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { format } from "date-fns"
import { ArrowLeft, Wallet, Landmark, Calendar, Calculator, DollarSign } from "lucide-react"
import { DisburseButton } from "./disburse-button" // Client component for action
import { EarlyPayoffCalculator } from "./early-payoff-calculator" // Client component for calculator

import { serialize } from "@/lib/utils/serialization"

export default async function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params
 let rawLoan: any = null
 try { rawLoan = await getLoan(parseInt(id)) } catch { }

 if (!rawLoan) return <div>Loan not found</div>

 const loan = serialize(rawLoan)

 // Check if disbursed: Does it have a PARTNER_LOAN event?
 const disbursementEvent = loan.financialEvents.find((e: Record<string, any>) => e.eventType === 'PARTNER_LOAN')
 const isDisbursed = !!disbursementEvent

 return (
 <div className="app-page space-y-6">
 <div className="flex items-center gap-4">
 <Link href="/finance/loans">
 <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
 </Link>
 <div>
 <h1 className="page-header-title tracking-tighter text-app-foreground flex items-center gap-4">
 <div className="w-14 h-14 rounded-[1.5rem] bg-app-primary flex items-center justify-center shadow-lg shadow-violet-200">
 <Landmark size={28} className="text-app-foreground" />
 </div>
 Loan <span className="text-app-primary">Details</span>
 </h1>
 <p className="text-sm font-medium text-app-muted-foreground mt-2 uppercase tracking-widest">Loan Overview</p>
 <p className="text-muted-foreground">{loan.contact.name}</p>
 </div>
 <div className="ml-auto flex gap-2">
 <Link href={`/finance/loans/${id}/schedule`}>
 <Button variant="outline" size="sm" className="rounded-xl gap-2">
 <Calendar size={16} />
 View Schedule
 </Button>
 </Link>
 {!isDisbursed && (
 <DisburseButton loanId={loan.id} amount={Number(loan.principalAmount)} />
 )}
 </div>
 </div>

 <div className="grid md:grid-cols-3 gap-6">
 <Card className="md:col-span-1">
 <CardHeader>
 <CardTitle>Terms</CardTitle>
 </CardHeader>
 <CardContent className="space-y-4">
 <div className="flex justify-between border-b pb-2">
 <span className="text-muted-foreground">Principal</span>
 <span className="font-bold">{Number(loan.principalAmount).toLocaleString()} USD</span>
 </div>
 <div className="flex justify-between border-b pb-2">
 <span className="text-muted-foreground">Interest Rate</span>
 <span>{Number(loan.interestRate)}% {loan.interestType !== 'NONE' && `(${loan.interestType})`}</span>
 </div>
 <div className="flex justify-between border-b pb-2">
 <span className="text-muted-foreground">Term</span>
 <span>{loan.termMonths} Months</span>
 </div>
 <div className="flex justify-between border-b pb-2">
 <span className="text-muted-foreground">Frequency</span>
 <span>{loan.paymentFrequency}</span>
 </div>
 <div className="flex justify-between pt-2">
 <span className="text-muted-foreground">Status</span>
 <span className="font-bold">{loan.status}</span>
 </div>

 {isDisbursed && (
 <div className="mt-4 p-3 bg-app-success-bg text-app-success rounded-md text-sm">
 <strong>Disbursed:</strong> {format(disbursementEvent.date, 'PPP')}
 <br />
 <Link href={`/finance/events/${disbursementEvent.id}`} className="underline">View Event</Link>
 </div>
 )}
 </CardContent>
 </Card>

 <Card className="md:col-span-2">
 <CardHeader>
 <div className="flex items-center justify-between">
 <CardTitle>Repayment Schedule (Next 5 Payments)</CardTitle>
 <Link href={`/finance/loans/${id}/schedule`}>
 <Button variant="ghost" size="sm" className="text-app-primary hover:text-app-primary/80">
 View Full Schedule →
 </Button>
 </Link>
 </div>
 </CardHeader>
 <CardContent>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Due Date</TableHead>
 <TableHead className="text-right">Principal</TableHead>
 <TableHead className="text-right">Interest</TableHead>
 <TableHead className="text-right">Total</TableHead>
 <TableHead>Status</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {loan.installments.slice(0, 5).map((inst: Record<string, any>) => (
 <TableRow key={inst.id}>
 <TableCell>{format(inst.dueDate, "PPP")}</TableCell>
 <TableCell className="text-right text-muted-foreground">{Number(inst.principalAmount).toLocaleString()}</TableCell>
 <TableCell className="text-right text-muted-foreground">{Number(inst.interestAmount).toLocaleString()}</TableCell>
 <TableCell className="text-right font-medium">{Number(inst.totalAmount).toLocaleString()}</TableCell>
 <TableCell>
 <span className={`px-2 py-1 rounded-full text-xs font-semibold ${inst.status === 'PAID' ? 'bg-app-success-bg text-app-success' :
 inst.status === 'OVERDUE' ? 'bg-app-error-bg text-app-error' :
 'bg-app-surface-2 text-app-foreground'
 }`}>
 {inst.status}
 </span>
 </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 </CardContent>
 </Card>
 </div>

 {/* Early Payoff Calculator */}
 <Card className="rounded-2xl border-2 border-app-primary/20 bg-gradient-to-br from-app-primary/5 to-transparent">
 <CardHeader>
 <div className="flex items-center gap-3">
 <div className="w-12 h-12 rounded-xl bg-app-primary/10 flex items-center justify-center">
 <Calculator size={24} className="text-app-primary" />
 </div>
 <div>
 <CardTitle>Early Payoff Calculator</CardTitle>
 <CardDescription>Calculate savings by paying off your loan early</CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent>
 <EarlyPayoffCalculator loanId={parseInt(id)} />
 </CardContent>
 </Card>
 </div>
 )
}