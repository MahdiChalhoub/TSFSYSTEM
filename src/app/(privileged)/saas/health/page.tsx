'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Server, Database, Clock, CheckCircle2, AlertTriangle } from "lucide-react"

export default function HealthPage() {
    // Placeholder: In future, fetch real health metrics from backend
    const health = {
        api: { status: 'healthy', latency: '45ms' },
        database: { status: 'healthy', connections: 12 },
        cache: { status: 'healthy', hitRate: '94%' },
        uptime: '99.97%'
    }

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">Platform Health</h2>
                <p className="text-gray-500 mt-2 font-medium">Monitor system status and performance metrics</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="border-emerald-100 bg-emerald-50/30">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <Server className="text-emerald-600" size={24} />
                            <Badge className="bg-emerald-600 text-white">Operational</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <h3 className="font-bold text-lg text-gray-900">API Services</h3>
                        <p className="text-sm text-gray-500">Latency: {health.api.latency}</p>
                    </CardContent>
                </Card>

                <Card className="border-emerald-100 bg-emerald-50/30">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <Database className="text-emerald-600" size={24} />
                            <Badge className="bg-emerald-600 text-white">Healthy</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <h3 className="font-bold text-lg text-gray-900">Database</h3>
                        <p className="text-sm text-gray-500">Connections: {health.database.connections}</p>
                    </CardContent>
                </Card>

                <Card className="border-emerald-100 bg-emerald-50/30">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <Activity className="text-emerald-600" size={24} />
                            <Badge className="bg-emerald-600 text-white">Active</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <h3 className="font-bold text-lg text-gray-900">Cache</h3>
                        <p className="text-sm text-gray-500">Hit Rate: {health.cache.hitRate}</p>
                    </CardContent>
                </Card>

                <Card className="border-emerald-100 bg-emerald-50/30">
                    <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                            <Clock className="text-emerald-600" size={24} />
                            <Badge className="bg-emerald-600 text-white">{health.uptime}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <h3 className="font-bold text-lg text-gray-900">Uptime</h3>
                        <p className="text-sm text-gray-500">Last 30 days</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>System Status</CardTitle>
                    <CardDescription>Real-time monitoring dashboard (placeholder)</CardDescription>
                </CardHeader>
                <CardContent className="py-12 text-center text-gray-400">
                    <CheckCircle2 className="mx-auto text-emerald-500 mb-4" size={48} />
                    <p className="font-bold text-emerald-600">All Systems Operational</p>
                </CardContent>
            </Card>
        </div>
    )
}
