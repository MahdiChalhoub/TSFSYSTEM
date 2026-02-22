import { getFinancialEvent } from "@/app/actions/finance/financial-events"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PostEventButton } from "@/components/finance/post-event-button"
import { format } from "date-fns"
import { ArrowLeft, CheckCircle2, AlertCircle , Calendar } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function FinancialEventDetailPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const id = parseInt(params.id)
    if (isNaN(id)) notFound()

    let event: any = null
    try { event = await getFinancialEvent(id) } catch { }
    if (!event) notFound()

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/finance/events">
                        <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                    </Link>
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter text-gray-900 flex items-center gap-4">
                            <div className="w-14 h-14 rounded-[1.5rem] bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                                <Calendar size={28} className="text-white" />
                            </div>
                            Event <span className="text-indigo-600">Details</span>
                        </h1>
                        <p className="text-sm font-medium text-gray-400 mt-2 uppercase tracking-widest">Financial Event</p>
                        <p className="text-muted-foreground">{event.eventType.replace(/_/g, " ")}</p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Transaction Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Date</label>
                                    <p className="text-lg">{format(event.date, "PPP")}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Amount</label>
                                    <p className="text-lg font-bold">{Number(event.amount).toFixed(2)} {event.currency}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Reference</label>
                                    <p>{event.reference || "-"}</p>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-muted-foreground">Contact</label>
                                    <p>{event.contact?.name || "-"}</p>
                                </div>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                                <p className="mt-1 bg-muted/30 p-3 rounded-md min-h-[60px]">{event.notes || "No notes provided."}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Action Area */}
                    {event.status === 'DRAFT' ? (
                        <Card className="border-blue-200 bg-blue-50/50">
                            <CardHeader>
                                <CardTitle className="text-primary flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5" />
                                    Review & Post
                                </CardTitle>
                                <CardDescription>
                                    This event is currently a Draft. To affect the ledger, you must post it.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <PostEventButton eventId={event.id} eventType={event.eventType} />
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="border-green-200 bg-green-50/50">
                            <CardHeader>
                                <CardTitle className="text-green-700 flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5" />
                                    Settled
                                </CardTitle>
                                <CardDescription>
                                    This event has been posted to the ledger effectively.
                                </CardDescription>
                            </CardHeader>
                        </Card>
                    )}
                </div>

                {/* Sidebar / Associated Records */}
                <div className="space-y-6">
                    {event.transaction && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Money Voucher</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm">
                                <p><strong>ID:</strong> {event.transaction.id}</p>
                                <p><strong>Ref:</strong> {event.transaction.referenceId}</p>
                                <p><strong>Type:</strong> {event.transaction.type}</p>
                            </CardContent>
                        </Card>
                    )}

                    {event.journalEntry && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">Journal Entry</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm space-y-3">
                                <p><strong>JE ID:</strong> {event.journalEntry.id}</p>
                                <Separator />
                                <div className="space-y-2">
                                    {event.journalEntry.lines.map((line: Record<string, any>) => (
                                        <div key={line.id} className="flex justify-between items-start text-xs">
                                            <span>
                                                <span className="font-semibold block">{line.account.code}</span>
                                                <span className="text-muted-foreground">{line.account.name}</span>
                                            </span>
                                            <span className="text-right">
                                                {line.debit > 0 ? (
                                                    <span className="text-green-600">Dr {Number(line.debit).toFixed(2)}</span>
                                                ) : (
                                                    <span className="text-red-600">Cr {Number(line.credit).toFixed(2)}</span>
                                                )}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}