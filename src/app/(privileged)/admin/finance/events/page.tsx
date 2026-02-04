import { getFinancialEvents } from "@/app/actions/finance/financial-events"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { format } from "date-fns"

// Need to define filter type to match Prisma enum roughly
type FilterType = 'PARTNER_CAPITAL_INJECTION' | 'PARTNER_LOAN' | 'PARTNER_WITHDRAWAL' | 'REFUND_RECEIVED'

export default async function FinancialEventsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
    const { type } = await searchParams
    const filterType = type as FilterType | undefined
    const events = await getFinancialEvents(filterType)

    const title = filterType ? filterType.replace(/_/g, " ") : "Financial Events"
    const newLink = filterType ? `/admin/finance/events/new?type=${filterType}` : "/admin/finance/events/new"

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                <Link href={newLink}>
                    <Button>New Event</Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>{filterType ? `recent ${title}` : "Recent Events"}</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Related Contact</TableHead>
                                <TableHead>Reference</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {events.map((event: any) => (
                                <TableRow key={event.id}>
                                    <TableCell>{format(event.date, "PPP")}</TableCell>
                                    <TableCell className="font-medium">
                                        {event.eventType.replace(/_/g, " ")}
                                    </TableCell>
                                    <TableCell>{event.contact?.name || "-"}</TableCell>
                                    <TableCell>{event.reference || "-"}</TableCell>
                                    <TableCell className="text-right">
                                        {event.amount.toString()} {event.currency}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${event.status === 'SETTLED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {event.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link href={`/admin/finance/events/${event.id}`}>
                                            <Button variant="ghost" size="sm">View</Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {events.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No financial events found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
