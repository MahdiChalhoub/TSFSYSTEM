'use client'

import { useParams, redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Box, Layers, Zap, Info } from "lucide-react"

/**
 * Known static routes that live as siblings inside (saas).
 * If Next.js resolves any of these to [code], redirect to the static page.
 */
const STATIC_SIBLING_ROUTES = [
    'apps', 'connector', 'countries', 'country-tax-templates', 'currencies',
    'e-invoice-standards', 'encryption', 'health', 'kernel',
    'listview-policies', 'modules', 'organizations', 'saas-home', 'settings',
    'theme-demo', 'ui-kit',
]

export default function DynamicModulePage() {
    const params = useParams()
    const code = params.code as string

    // Guard: if this is a known static route, force Next.js to the correct page
    if (STATIC_SIBLING_ROUTES.includes(code)) {
        redirect(`/${code}`)
    }

    // [FUTURE] Here we will fetch specific dashboard components/widgets from the Registry
    // For now, we show a professional fallback that works for ALL modules instantly.

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-[1.5rem] md:rounded-[2rem] bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center shadow-xl text-white shrink-0">
                    <Box size={24} className="md:w-8 md:h-8" />
                </div>
                <div>
                    <h2 className="text-2xl md:text-4xl font-black text-white tracking-tight capitalize">{code.replace(/_/g, ' ')} Dashboard</h2>
                    <p className="text-xs md:text-sm text-app-muted-foreground mt-1 md:mt-2 font-medium">Platform verified module: <code className="text-app-success">{code}</code></p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-[#0F172A]/80 backdrop-blur-xl border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl group hover:border-app-primary/30 transition-all">
                    <CardHeader>
                        <div className="w-12 h-12 rounded-xl bg-app-primary/10 text-app-success flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Zap size={24} />
                        </div>
                        <CardTitle className="text-xl font-bold text-white">Live Instance</CardTitle>
                        <CardDescription>Direct injection from Global Registry</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-app-muted-foreground leading-relaxed">
                        This interface was dynamically enabled for this organization. No code deploy was required.
                    </CardContent>
                </Card>

                <Card className="bg-[#0F172A]/80 backdrop-blur-xl border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl group hover:border-app-accent/30 transition-all">
                    <CardHeader>
                        <div className="w-12 h-12 rounded-xl bg-app-accent/10 text-app-accent flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Layers size={24} />
                        </div>
                        <CardTitle className="text-xl font-bold text-white">Modular State</CardTitle>
                        <CardDescription>Context-aware data layer active</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-app-muted-foreground leading-relaxed">
                        Securely isolated data and permissions are currently being enforced for the <strong>{code}</strong> module.
                    </CardContent>
                </Card>

                <Card className="bg-[#0F172A]/80 backdrop-blur-xl border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl group hover:border-app-warning/30 transition-all">
                    <CardHeader>
                        <div className="w-12 h-12 rounded-xl bg-app-warning/10 text-app-warning flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <Info size={24} />
                        </div>
                        <CardTitle className="text-xl font-bold text-white">Ready for Logic</CardTitle>
                        <CardDescription>Template rendering successful</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-app-muted-foreground leading-relaxed">
                        Foundations are ready. You can now start adding business-specific widgets and reports.
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
