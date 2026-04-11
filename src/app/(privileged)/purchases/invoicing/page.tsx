import { Suspense } from 'react'
import InvoicingScreen from './InvoicingScreen'
import { Loader2 } from 'lucide-react'

export const metadata = {
    title: 'PO Invoicing | TSFSYSTEM',
    description: 'Convert Purchase Orders into Supplier Invoices'
}

export default function InvoicingPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
                <p className="text-sm font-black uppercase tracking-widest theme-text-muted">Initializing Invoicing Interface...</p>
            </div>
        }>
            <InvoicingScreen />
        </Suspense>
    )
}
