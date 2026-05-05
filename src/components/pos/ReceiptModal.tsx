'use client'

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Printer, Download, X, CheckCircle, FileText } from "lucide-react"
import { toast } from "sonner"

export function ReceiptModal({ orderId, refCode, isOpen, onClose }: {
    orderId: number | null,
    refCode: string | null,
    isOpen: boolean,
    onClose: () => void
}) {
    const [loading, setLoading] = useState(false)

    async function handleDownload() {
        if (!orderId) return
        setLoading(true)
        try {
            const { erpFetch } = await import("@/lib/erp-api")
            const blob = await erpFetch(`pos/${orderId}/invoice-pdf/`)

            if (!(blob instanceof Blob)) throw new Error("Invalid format")

            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `Invoice_${refCode || orderId}.pdf`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
            toast.success("Invoice downloaded")
        } catch {
            toast.error("Failed to download invoice")
        } finally {
            setLoading(false)
        }
    }

    function handlePrint() {
        // In a real scenario, this would generate a specific 80mm thermal receipt
        // For now, we reuse the official PDF for simplicity in this session
        handleDownload()
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
                <div className="bg-app-success p-8 text-center text-white relative">
                    <div className="absolute top-4 right-4 cursor-pointer hover:bg-white/20 p-2 rounded-full" onClick={onClose}>
                        <X size={20} />
                    </div>
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                        <CheckCircle size={32} className="text-white" />
                    </div>
                    <h2>Checkout Success!</h2>
                    <p className="opacity-80 mt-1">Order Ref: <span className="font-mono font-bold tracking-widest">{refCode || orderId}</span></p>
                </div>

                <div className="p-6 bg-white space-y-4">
                    <div className="text-center space-y-1 mb-6">
                        <p className="text-sm text-app-muted-foreground font-medium">What would you like to do next?</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button
                            onClick={handlePrint}
                            className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-app-border hover:border-app-success hover:bg-app-success-soft transition-all group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gray-50 group-hover:bg-app-success-soft flex items-center justify-center text-app-muted-foreground group-hover:text-app-success transition-colors">
                                <Printer size={24} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-app-muted-foreground group-hover:text-app-success">Print Receipt</span>
                        </button>

                        <button
                            onClick={handleDownload}
                            disabled={loading}
                            className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-app-border hover:border-app-info hover:bg-app-info-soft transition-all group"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gray-50 group-hover:bg-app-info-soft flex items-center justify-center text-app-muted-foreground group-hover:text-app-info transition-colors">
                                <FileText size={24} />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-wider text-app-muted-foreground group-hover:text-app-info">Get Invoice</span>
                        </button>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-4 mt-4 bg-gray-900 text-white rounded-2xl font-bold text-lg hover:bg-black transition-all shadow-lg active:scale-95"
                    >
                        New Transaction
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
