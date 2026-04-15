'use client';

import React, { useMemo } from 'react';
import {
    Package,
    MapPin,
    Clock,
    CheckCircle2,
    TrendingUp,
    AlertCircle,
    Truck
} from 'lucide-react';

interface DriverStats {
    total_deliveries: number;
    today_deliveries: number;
    avg_delivery_time: number;
    rating: number;
    status: string;
}

interface DriverDashboardProps {
    driver: any;
    stats: DriverStats;
    deliveries: any[];
}

export default function DriverDashboard({ driver, stats, deliveries }: DriverDashboardProps) {
    const recentDeliveries = useMemo(() => {
        return deliveries.slice(0, 5);
    }, [deliveries]);

    return (
        <div className="space-y-6">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Total Deliveries"
                    value={stats.total_deliveries.toString()}
                    icon={<Package className="w-5 h-5 text-blue-400" />}
                    trend="+12% from last month"
                    trendPos={true}
                />
                <StatCard
                    label="Deliveries Today"
                    value={stats.today_deliveries.toString()}
                    icon={<Truck className="w-5 h-5 text-emerald-400" />}
                    trend="Currently Active"
                    trendPos={stats.status === 'BUSY'}
                />
                <StatCard
                    label="Avg. Transit Time"
                    value={`${stats.avg_delivery_time}m`}
                    icon={<Clock className="w-5 h-5 text-amber-400" />}
                    trend="-2m from average"
                    trendPos={true}
                />
                <StatCard
                    label="Performance Rating"
                    value={`${stats.rating}/5`}
                    icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
                    trend="Top 10% of fleet"
                    trendPos={true}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <div className="lg:col-span-2 GlassCard p-6 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                            <Clock className="w-5 h-5 text-blue-400" />
                            Recent Dispatch Activity
                        </h3>
                        <button className="text-xs text-blue-400 hover:underline">View All History</button>
                    </div>

                    <div className="space-y-4">
                        {recentDeliveries.length > 0 ? (
                            recentDeliveries.map((delivery) => (
                                <div key={delivery.id} className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-full ${getStatusColor(delivery.status)}`}>
                                            <Package className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">Order #{delivery.order_number || delivery.id}</p>
                                            <p className="text-xs text-white/50 flex items-center gap-1">
                                                <MapPin className="w-3 h-3" /> {delivery.zone_name || 'Global Zone'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${getStatusBadge(delivery.status)}`}>
                                                {delivery.status}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-white/40">
                                            {delivery.delivered_at ? new Date(delivery.delivered_at).toLocaleTimeString() : 'In Transit'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-xl">
                                <AlertCircle className="w-8 h-8 text-white/20 mx-auto mb-2" />
                                <p className="text-white/40 text-sm">No recent deliveries recorded</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Current Status Tracker */}
                <div className="GlassCard p-6 rounded-xl border border-white/5">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        Reliability Metrics
                    </h3>

                    <div className="space-y-6">
                        <MetricProgress label="On-Time Delivery" value={94} color="bg-emerald-500" />
                        <MetricProgress label="Customer Satisfaction" value={88} color="bg-blue-500" />
                        <MetricProgress label="Compliance Rate" value={100} color="bg-purple-500" />
                        <MetricProgress label="Fuel Efficiency" value={76} color="bg-amber-500" />
                    </div>

                    <div className="mt-8 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <p className="text-xs text-emerald-400 font-medium mb-1">Monthly Bonus Eligibility</p>
                        <p className="text-xs text-white/70">This driver is eligible for the performance bonus this month based on current metrics.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon, trend, trendPos }: any) {
    return (
        <div className="GlassCard p-5 rounded-xl border border-white/5 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-pointer">
            <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-medium text-white/60 tracking-wider uppercase">{label}</span>
                <div className="p-2 rounded-lg bg-white/5">
                    {icon}
                </div>
            </div>
            <div>
                <div className="text-2xl font-bold mb-1 tracking-tight">{value}</div>
                <p className={`text-[10px] ${trendPos ? 'text-emerald-400' : 'text-white/40'}`}>
                    {trend}
                </p>
            </div>
        </div>
    );
}

function MetricProgress({ label, value, color }: { label: string, value: number, color: string }) {
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-xs">
                <span className="text-white/60">{label}</span>
                <span className="font-bold">{value}%</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full ${color}`} style={{ width: `${value}%` }} />
            </div>
        </div>
    );
}

function getStatusColor(status: string) {
    switch (status) {
        case 'DELIVERED': return 'bg-emerald-500';
        case 'IN_TRANSIT': return 'bg-blue-500';
        case 'FAILED': return 'bg-rose-500';
        case 'CANCELLED': return 'bg-white/20';
        default: return 'bg-amber-500';
    }
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'DELIVERED': return 'bg-emerald-500/20 text-emerald-400';
        case 'IN_TRANSIT': return 'bg-blue-500/20 text-blue-400';
        case 'FAILED': return 'bg-rose-500/20 text-rose-400';
        case 'CANCELLED': return 'bg-white/10 text-white/40';
        default: return 'bg-amber-500/20 text-amber-400';
    }
}
