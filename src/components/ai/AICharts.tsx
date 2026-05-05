'use client'

/**
 * AI Chart Components
 * ===================
 * Dynamic chart rendering for AI-generated visualizations.
 */

import { useMemo } from 'react'
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    AreaChart, Area
} from 'recharts'

// Color palette for charts
const COLORS = [
    '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6',
    '#10b981', '#22c55e', '#84cc16', '#eab308', '#f97316',
    '#ef4444', '#ec4899', '#d946ef', '#a855f7'
]

interface ChartData {
    type: 'bar' | 'line' | 'pie' | 'area' | 'combo'
    title?: string
    data: Array<Record<string, any>>
    xKey?: string
    yKeys?: string[]
    colors?: string[]
}

interface AIChartProps {
    chart: ChartData
}

export function AIChart({ chart }: AIChartProps) {
    const { type, title, data, xKey = 'name', yKeys = ['value'], colors = COLORS } = chart

    const chartColors = useMemo(() => {
        return yKeys.map((_, i) => colors[i % colors.length])
    }, [yKeys, colors])

    if (!data || data.length === 0) {
        return (
            <div className="text-center py-8 text-app-muted-foreground">
                No data available for chart
            </div>
        )
    }

    const renderChart = () => {
        switch (type) {
            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                                dataKey={xKey}
                                tick={{ fontSize: 12 }}
                                stroke="#9ca3af"
                            />
                            <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255,255,255,0.95)',
                                    borderRadius: '12px',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                            />
                            <Legend />
                            {yKeys.map((key, index) => (
                                <Bar
                                    key={key}
                                    dataKey={key}
                                    fill={chartColors[index]}
                                    radius={[4, 4, 0, 0]}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                )

            case 'line':
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                            <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255,255,255,0.95)',
                                    borderRadius: '12px',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                            />
                            <Legend />
                            {yKeys.map((key, index) => (
                                <Line
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    stroke={chartColors[index]}
                                    strokeWidth={2}
                                    dot={{ fill: chartColors[index], strokeWidth: 2 }}
                                    activeDot={{ r: 6 }}
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                )

            case 'area':
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <defs>
                                {yKeys.map((key, index) => (
                                    <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={chartColors[index]} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={chartColors[index]} stopOpacity={0} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} stroke="#9ca3af" />
                            <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255,255,255,0.95)',
                                    borderRadius: '12px',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                            />
                            <Legend />
                            {yKeys.map((key, index) => (
                                <Area
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    stroke={chartColors[index]}
                                    fill={`url(#gradient-${key})`}
                                    strokeWidth={2}
                                />
                            ))}
                        </AreaChart>
                    </ResponsiveContainer>
                )

            case 'pie':
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={((entry: { name: string; percent?: number }) => `${entry.name}: ${((entry.percent ?? 0) * 100).toFixed(0)}%`) as any}
                                outerRadius={100}
                                fill="#8884d8"
                                dataKey={yKeys[0]}
                                nameKey={xKey}
                            >
                                {data.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'rgba(255,255,255,0.95)',
                                    borderRadius: '12px',
                                    border: '1px solid #e5e7eb',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}
                            />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                )

            default:
                return <p className="text-app-muted-foreground">Unsupported chart type: {type}</p>
        }
    }

    return (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-app-border">
            {title && (
                <h4 className="text-sm font-semibold text-app-muted-foreground mb-4">{title}</h4>
            )}
            {renderChart()}
        </div>
    )
}

// Helper to parse chart data from AI response
export function parseChartFromResponse(text: string): ChartData | null {
    try {
        // Look for JSON chart data in the response
        const chartMatch = text.match(/```chart\n([\s\S]*?)\n```/)
        if (chartMatch) {
            return JSON.parse(chartMatch[1])
        }

        // Look for inline JSON with chart type
        const jsonMatch = text.match(/\{[\s\S]*"type"\s*:\s*"(bar|line|pie|area)"[\s\S]*\}/)
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0])
        }

        return null
    } catch {
        return null
    }
}

// Component for rendering analysis insights
interface AnalysisInsight {
    type: 'success' | 'warning' | 'info' | 'trend_up' | 'trend_down'
    title: string
    value?: string
    description?: string
}

export function AIInsightCard({ insight }: { insight: AnalysisInsight }) {
    const colors = {
        success: 'bg-app-success-soft border-app-success text-app-success',
        warning: 'bg-app-warning-soft border-app-warning text-app-warning',
        info: 'bg-app-info-soft border-app-info text-app-info',
        trend_up: 'bg-app-success-soft border-app-success text-app-success',
        trend_down: 'bg-app-error-soft border-app-error text-app-error'
    }

    const icons = {
        success: '✓',
        warning: '⚠',
        info: 'ℹ',
        trend_up: '↑',
        trend_down: '↓'
    }

    return (
        <div className={`p-4 rounded-xl border ${colors[insight.type]}`}>
            <div className="flex items-start gap-3">
                <span className="text-lg">{icons[insight.type]}</span>
                <div>
                    <div className="font-semibold">{insight.title}</div>
                    {insight.value && (
                        <div className="text-2xl font-bold mt-1">{insight.value}</div>
                    )}
                    {insight.description && (
                        <p className="text-sm opacity-80 mt-1">{insight.description}</p>
                    )}
                </div>
            </div>
        </div>
    )
}

// Strategy recommendation component
interface StrategyRecommendation {
    priority: 'high' | 'medium' | 'low'
    category: string
    action: string
    impact: string
    timeline?: string
}

export function AIStrategyCard({ strategy }: { strategy: StrategyRecommendation }) {
    const priorityColors = {
        high: 'bg-app-error-soft text-app-error border-app-error',
        medium: 'bg-app-warning-soft text-app-warning border-app-warning',
        low: 'bg-app-info-soft text-app-info border-app-info'
    }

    return (
        <div className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white border border-app-border">
            <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${priorityColors[strategy.priority]}`}>
                    {strategy.priority.toUpperCase()}
                </span>
                <span className="text-sm font-medium text-app-muted-foreground">{strategy.category}</span>
            </div>
            <h4 className="font-bold text-app-foreground mb-2">{strategy.action}</h4>
            <p className="text-sm text-app-muted-foreground">{strategy.impact}</p>
            {strategy.timeline && (
                <p className="text-xs text-app-muted-foreground mt-2">Timeline: {strategy.timeline}</p>
            )}
        </div>
    )
}
