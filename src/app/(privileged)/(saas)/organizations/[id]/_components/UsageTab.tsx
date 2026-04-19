'use client'

import { Users, MapPin, HardDrive, FileText } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { UsageMeter } from './UsageMeter'
import type { SaasUsageData } from '@/types/erp'

interface UsageTabProps {
    usage: SaasUsageData | null
    onManageModules: () => void
}

export function UsageTab({ usage, onManageModules }: UsageTabProps) {
    return (
        <div className="space-y-6">
            <Card className="border-app-border shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg font-bold">Detailed Usage Metrics</CardTitle>
                    <CardDescription>Real-time resource consumption for this organization</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {usage ? (
                        <>
                            <UsageMeter label="Users" icon={Users} current={usage.users.current} limit={usage.users.limit} percent={usage.users.percent} />
                            <UsageMeter label="Sites / Locations" icon={MapPin} current={usage.sites.current} limit={usage.sites.limit} percent={usage.sites.percent} />
                            <UsageMeter label="Data Storage" icon={HardDrive} current={usage.storage.current_mb} limit={usage.storage.limit_mb} percent={usage.storage.percent} unit=" MB" />
                            <UsageMeter label="Invoices This Month" icon={FileText} current={usage.invoices.current} limit={usage.invoices.limit} percent={usage.invoices.percent} />
                            <div className="p-5 bg-app-surface rounded-2xl border border-app-border mt-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-app-muted-foreground uppercase tracking-wider">Active Modules</p>
                                        <p className="text-2xl font-black text-app-foreground mt-1">
                                            {usage.modules.current} <span className="text-sm font-medium text-app-muted-foreground">/ {usage.modules.total_available} available</span>
                                        </p>
                                    </div>
                                    <Button variant="outline" size="sm" className="rounded-xl" onClick={onManageModules}>Manage</Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="py-12 text-center text-app-muted-foreground italic">Usage data unavailable</div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
