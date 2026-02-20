'use client'

import { useState, useRef } from 'react'
import { Monitor, Tablet, Smartphone, ExternalLink, RotateCw, Eye } from 'lucide-react'

interface PortalPreviewProps {
    url: string
    title: string
    subtitle: string
    accentColor?: string
}

const DEVICES = [
    { key: 'desktop', label: 'Desktop', icon: Monitor, width: '100%', maxWidth: '100%' },
    { key: 'tablet', label: 'Tablet', icon: Tablet, width: '768px', maxWidth: '768px' },
    { key: 'mobile', label: 'Mobile', icon: Smartphone, width: '375px', maxWidth: '375px' },
] as const

export default function PortalPreview({ url, title, subtitle, accentColor = 'emerald' }: PortalPreviewProps) {
    const [device, setDevice] = useState<string>('desktop')
    const [refreshKey, setRefreshKey] = useState(0)
    const iframeRef = useRef<HTMLIFrameElement>(null)

    const currentDevice = DEVICES.find(d => d.key === device) || DEVICES[0]

    const colorMap: Record<string, { bg: string; border: string; text: string; dot: string; buttonBg: string; buttonHover: string }> = {
        emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', buttonBg: 'bg-emerald-600', buttonHover: 'hover:bg-emerald-700' },
        indigo: { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500', buttonBg: 'bg-indigo-600', buttonHover: 'hover:bg-indigo-700' },
        blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500', buttonBg: 'bg-blue-600', buttonHover: 'hover:bg-blue-700' },
    }
    const colors = colorMap[accentColor] || colorMap.emerald

    return (
        <div className="space-y-5 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl ${colors.bg} ${colors.border} border flex items-center justify-center`}>
                        <Eye size={22} className={colors.text} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight">{title}</h1>
                        <p className="text-sm text-gray-500 font-medium">{subtitle}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Device Picker */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                        {DEVICES.map(d => {
                            const Icon = d.icon
                            return (
                                <button
                                    key={d.key}
                                    onClick={() => setDevice(d.key)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${device === d.key
                                            ? 'bg-white shadow-sm text-gray-900'
                                            : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                >
                                    <Icon size={14} />
                                    <span className="hidden sm:inline">{d.label}</span>
                                </button>
                            )
                        })}
                    </div>
                    {/* Refresh */}
                    <button
                        onClick={() => setRefreshKey(k => k + 1)}
                        className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-500 transition-colors"
                        title="Refresh preview"
                    >
                        <RotateCw size={16} />
                    </button>
                    {/* Open in new tab */}
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 px-4 py-2.5 ${colors.buttonBg} ${colors.buttonHover} text-white rounded-xl text-xs font-bold transition-colors shadow-lg`}
                    >
                        <ExternalLink size={14} />
                        Open Portal
                    </a>
                </div>
            </div>

            {/* Browser Frame */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                {/* Browser Top Bar */}
                <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                    {/* Traffic Lights */}
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <div className="w-3 h-3 rounded-full bg-amber-400" />
                        <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    </div>
                    {/* URL Bar */}
                    <div className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-1.5 text-xs text-gray-500 font-mono truncate">
                        {url}
                    </div>
                    {/* Device Size Indicator */}
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {currentDevice.width === '100%' ? 'Full Width' : currentDevice.width}
                    </span>
                </div>

                {/* Iframe Container */}
                <div
                    className="bg-gray-100 flex justify-center transition-all duration-300"
                    style={{ minHeight: '75vh' }}
                >
                    <div
                        className="bg-white transition-all duration-300 shadow-sm"
                        style={{
                            width: currentDevice.width,
                            maxWidth: currentDevice.maxWidth,
                        }}
                    >
                        <iframe
                            key={refreshKey}
                            ref={iframeRef}
                            src={url}
                            className="w-full border-0"
                            style={{ height: '75vh' }}
                            title={`${title} Preview`}
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        />
                    </div>
                </div>
            </div>

            {/* Help Text */}
            <div className="text-center">
                <p className="text-xs text-gray-400 font-medium">
                    This is a live preview. Changes to your portal configuration are reflected in real-time.
                    Click <strong>Open Portal</strong> to visit the full page.
                </p>
            </div>
        </div>
    )
}
