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

 useEffect(() => {
 if (isOpen) {
 // Auto print receipt by default when the modal opens
 const timer = setTimeout(() => {
 handlePrint();
 }, 700);
 return () => clearTimeout(timer);
 }
 }, [isOpen]);

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
 // Toggle the hidden receipt view and trigger print
 const printContent = document.getElementById('thermal-receipt-content');
 if (!printContent) return;

 const printWindow = window.open('', '_blank');
 if (!printWindow) return;

 printWindow.document.write(`
 <html>
 <head>
 <title>Print Receipt</title>
 <style>
 body { font-family: 'Courier New', Courier, monospace; width: 80mm; padding: 5mm; margin: 0; }
 .center { text-align: center; }
 .bold { font-weight: bold; }
 .hr { border-bottom: 1px dashed #000; margin: 5px 0; }
 .item { display: flex; justify-content: space-between; font-size: 12px; }
 .total { font-weight: bold; border-top: 1px solid #000; margin-top: 5px; padding-top: 5px; }
 @media print { body { width: 80mm; } }
 </style>
 </head>
 <body>
 ${printContent.innerHTML}
 </body>
 </html>
 `);
 printWindow.document.close();
 printWindow.focus();
 printWindow.print();
 printWindow.close();
 }

 return (
 <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
 <DialogContent className="max-w-md p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
 <DialogTitle className="sr-only">Receipt Options</DialogTitle>
 {/* Hidden Thermal Receipt for Printing */}
 <div id="thermal-receipt-content" className="hidden">
 <div className="center bold">TSF ERP - RETAIL</div>
 <div className="center">Point of Sale</div>
 <div className="hr"></div>
 <div>Date: ${new Date().toLocaleString()}</div>
 <div>Ref: ${refCode || orderId}</div>
 <div className="hr"></div>
 {/* Items would be mapped here from order data */}
 <div className="item">
 <span>Transaction Total</span>
 <span className="bold">$XX.XX</span>
 </div>
 <div className="hr"></div>
 <div className="center">THANK YOU</div>
 </div>

 <div className="bg-emerald-600 p-8 text-center text-white relative">
 <div className="absolute top-4 right-4 cursor-pointer hover:bg-white/20 p-2 rounded-full" onClick={onClose}>
 <X size={20} />
 </div>
 <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
 <CheckCircle size={32} className="text-white" />
 </div>
 <h2 className="text-2xl font-bold">Checkout Success!</h2>
 <p className="opacity-80 mt-1">Order Ref: <span className="font-mono font-bold tracking-widest">{refCode || orderId}</span></p>
 </div>

 <div className="p-6 bg-app-surface space-y-4">
 <div className="text-center space-y-1 mb-6">
 <p className="text-sm text-app-text-muted font-medium">What would you like to do next?</p>
 </div>

 <div className="grid grid-cols-2 gap-3">
 <button
 onClick={handlePrint}
 className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-app-border hover:border-emerald-500 hover:bg-emerald-50 transition-all group"
 >
 <div className="w-12 h-12 rounded-xl bg-app-bg group-hover:bg-emerald-100 flex items-center justify-center text-app-text-faint group-hover:text-emerald-600 transition-colors">
 <Printer size={24} />
 </div>
 <span className="text-xs font-bold uppercase tracking-wider text-app-text-muted group-hover:text-emerald-700">Print Receipt</span>
 </button>

 <button
 onClick={handleDownload}
 disabled={loading}
 className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-app-border hover:border-indigo-500 hover:bg-indigo-50 transition-all group"
 >
 <div className="w-12 h-12 rounded-xl bg-app-bg group-hover:bg-indigo-100 flex items-center justify-center text-app-text-faint group-hover:text-indigo-600 transition-colors">
 <FileText size={24} />
 </div>
 <span className="text-xs font-bold uppercase tracking-wider text-app-text-muted group-hover:text-indigo-700">Get Invoice</span>
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
