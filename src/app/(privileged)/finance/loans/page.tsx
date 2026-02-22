import { getLoans } from "@/app/actions/finance/loans"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { format } from "date-fns"
import { erpFetch } from "@/lib/erp-api"
import { serialize } from "@/lib/utils/serialization"

async function getOrgCurrency(): Promise<string> {
    try {
        const orgs = await erpFetch('organizations/')
        const org = Array.isArray(orgs) ? orgs[0] : orgs
        return org?.currency || org?.settings?.currency || 'USD'
    } catch { return 'USD' }
}

export default async function LoansPage() {
    const [rawLoans, currency] = await Promise.all([getLoans(), getOrgCurrency()])
    const loans = serialize(rawLoans)

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Partner Loans</h1>
                <Link href="/finance/loans/new">
                    <Button>New Contract</Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Active Contracts</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Partner</TableHead>
                                <TableHead className="text-right">Principal</TableHead>
                                <TableHead className="text-right">Rate</TableHead>
                                <TableHead>Term</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loans.map((loan: Record<string, any>) => (
                                <TableRow key={loan.id}>
                                    <TableCell>{format(loan.startDate, "PPP")}</TableCell>
                                    <TableCell className="font-medium">{loan.contact.name}</TableCell>
                                    <TableCell className="text-right">{Number(loan.principalAmount).toLocaleString()} {currency}</TableCell>
                                    <TableCell className="text-right">{Number(loan.interestRate)}%</TableCell>
                                    <TableCell>{loan.termMonths} Months</TableCell>
                                    <TableCell>
                                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${loan.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                            loan.status === 'PAID' ? 'bg-blue-100 text-blue-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {loan.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link href={`/finance/loans/${loan.id}`}>
                                            <Button variant="ghost" size="sm">View</Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {loans.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                        No loan contracts found.
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