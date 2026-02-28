'use client'

import { QRCodeSVG } from 'qrcode.react'
import { Card } from "@/components/ui/card"
import { ShieldCheck, Package, QrCode as QrIcon } from "lucide-react"
import { Asset } from "@/types/erp"

interface AssetTagProps {
    asset: Asset
    size?: 'sm' | 'md' | 'lg'
}

export function AssetTag({ asset, size = 'md' }: AssetTagProps) {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    // Secure URL for auditors (mobile-friendly)
    const scanUrl = `${baseUrl}/m/asset/${asset.id}`

    const dimensions = {
        sm: 'w-48 h-24 p-2',
        md: 'w-64 h-32 p-3',
        lg: 'w-80 h-40 p-4'
    }

    const qrSizes = {
        sm: 64,
        md: 80,
        lg: 100
    }

    return (
        <Card className={`${dimensions[size]} bg-white border-2 border-stone-200 rounded-xl flex shadow-sm animate-in zoom-in-95 duration-300 overflow-hidden`}>
            {/* Left: Metadata */}
            <div className="flex-1 flex flex-col justify-between pr-3 border-r-2 border-dashed border-stone-100">
                <div className="flex items-center gap-1.5 mb-1">
                    <div className="p-1 bg-indigo-50 rounded-lg">
                        <ShieldCheck size={14} className="text-indigo-600" />
                    </div>
                    <span className="text-[10px] font-black text-stone-900 uppercase tracking-tighter truncate">
                        {asset.category || 'ASSET'} ID: {asset.id}
                    </span>
                </div>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className="text-xs font-black text-stone-900 leading-tight uppercase line-clamp-2">
                        {asset.name}
                    </h4>
                    <p className="text-[9px] text-stone-500 font-bold mt-1 tracking-tight">
                        Purchased: {asset.purchase_date}
                    </p>
                </div>

                <div className="flex items-end justify-between mt-1">
                    <div className="flex items-center gap-1">
                        <Package size={10} className="text-stone-300" />
                        <span className="text-[8px] font-black text-stone-400 uppercase tracking-widest">TSFSYSTEM</span>
                    </div>
                </div>
            </div>

            {/* Right: QR Code */}
            <div className="flex flex-col items-center justify-center pl-3">
                <div className="p-1 bg-white rounded-lg border border-stone-100 shadow-inner">
                    <QRCodeSVG
                        value={scanUrl}
                        size={qrSizes[size]}
                        level="H"
                        includeMargin={false}
                        fgColor="#1c1917" // stone-900
                    />
                </div>
                <div className="mt-2 flex items-center gap-1 bg-stone-900 text-white px-1.5 py-0.5 rounded-full">
                    <QrIcon size={8} />
                    <span className="text-[7px] font-black uppercase tracking-tighter">Scan to Audit</span>
                </div>
            </div>
        </Card>
    )
}
