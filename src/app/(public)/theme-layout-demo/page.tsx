"use client"

import React from 'react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { LayoutProvider } from '@/contexts/LayoutContext'
import { ThemeSwitcher } from '@/components/shared/ThemeSwitcher'
import { LayoutSwitcher } from '@/components/shared/LayoutSwitcher'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Zap, TrendingUp, Users, DollarSign, Package } from 'lucide-react'

export default function ThemeLayoutDemoPage() {
  return (
    <ThemeProvider defaultTheme="midnight-pro">
      <LayoutProvider defaultLayout="card-heavy">
        <DemoContent />
      </LayoutProvider>
    </ThemeProvider>
  )
}

function DemoContent() {
  return (
    <div
      className="min-h-screen"
      style={{
        background: 'var(--theme-bg)',
        color: 'var(--theme-text)',
      }}
    >
      {/* Header */}
      <header
        className="border-b"
        style={{
          borderColor: 'var(--theme-border)',
          background: 'var(--theme-surface)',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--theme-text)' }}>
              Theme & Layout System Demo
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--theme-text-muted)' }}>
              Live demonstration of the new dual-system architecture
            </p>
          </div>
          <div className="flex gap-3">
            <ThemeSwitcher />
            <LayoutSwitcher />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        className="max-w-7xl mx-auto"
        style={{
          padding: 'var(--layout-container-padding)',
        }}
      >
        {/* Hero Section */}
        <div
          className="rounded-lg p-8 mb-6"
          style={{
            background: 'var(--theme-surface)',
            border: '1px solid var(--theme-border)',
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <Sparkles
              className="h-8 w-8"
              style={{ color: 'var(--theme-primary)' }}
            />
            <h2 className="text-3xl font-bold" style={{ color: 'var(--theme-text)' }}>
              50 Visual Combinations
            </h2>
          </div>
          <p className="text-lg" style={{ color: 'var(--theme-text-muted)' }}>
            Mix any of 10 color themes with any of 5 layout structures. Try switching themes and
            layouts using the buttons above to see instant changes without page reload.
          </p>
        </div>

        {/* Features Grid */}
        <div
          className="grid gap-4 mb-6"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 'var(--layout-section-spacing)',
          }}
        >
          <FeatureCard
            icon={<Zap className="h-6 w-6" />}
            title="Instant Switching"
            description="Change themes and layouts in real-time with zero page reload"
          />
          <FeatureCard
            icon={<TrendingUp className="h-6 w-6" />}
            title="Performance"
            description="CSS variables ensure blazing-fast theme changes"
          />
          <FeatureCard
            icon={<Users className="h-6 w-6" />}
            title="Per-User Settings"
            description="Each user can customize their own workspace"
          />
          <FeatureCard
            icon={<Package className="h-6 w-6" />}
            title="Module-Level"
            description="Different modules can have different visual styles"
          />
        </div>

        {/* Dashboard Metrics Example */}
        <div
          className="grid gap-4 mb-6"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--layout-element-gap)',
          }}
        >
          <MetricCard label="Revenue" value="$45,231" change="+12.5%" />
          <MetricCard label="Orders" value="1,234" change="+23.1%" />
          <MetricCard label="Customers" value="8,124" change="+5.4%" />
          <MetricCard label="Conversion" value="3.24%" change="+0.4%" />
        </div>

        {/* Sample Cards with Layout Spacing */}
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 'var(--layout-section-spacing)',
          }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest updates from your workspace</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <ActivityItem
                  title="New order received"
                  time="2 minutes ago"
                  color="var(--theme-primary)"
                />
                <ActivityItem
                  title="Invoice #1234 paid"
                  time="15 minutes ago"
                  color="var(--theme-primary)"
                />
                <ActivityItem
                  title="Low stock alert"
                  time="1 hour ago"
                  color="var(--theme-primary)"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  Create New Invoice
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  Add Product
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  View Reports
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Info Footer */}
        <div
          className="mt-8 p-6 rounded-lg"
          style={{
            background: 'var(--theme-surface)',
            border: '1px solid var(--theme-border)',
          }}
        >
          <h3 className="font-semibold mb-2" style={{ color: 'var(--theme-text)' }}>
            How It Works
          </h3>
          <ul className="space-y-1 text-sm" style={{ color: 'var(--theme-text-muted)' }}>
            <li>• Themes control colors (primary, background, text, borders)</li>
            <li>• Layouts control structure (spacing, density, card styles)</li>
            <li>• Both use CSS variables for instant switching</li>
            <li>• Settings persist to localStorage automatically</li>
            <li>• Zero impact on existing code - fully backwards compatible</li>
          </ul>
        </div>
      </main>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div
      className="p-4 rounded-lg"
      style={{
        background: 'var(--theme-surface)',
        border: '1px solid var(--theme-border)',
        padding: 'var(--layout-card-padding)',
      }}
    >
      <div className="mb-3" style={{ color: 'var(--theme-primary)' }}>
        {icon}
      </div>
      <h3 className="font-semibold mb-1" style={{ color: 'var(--theme-text)' }}>
        {title}
      </h3>
      <p className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
        {description}
      </p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  change,
}: {
  label: string
  value: string
  change: string
}) {
  return (
    <div
      className="p-4 rounded-lg"
      style={{
        background: 'var(--theme-surface)',
        border: '1px solid var(--theme-border)',
        padding: 'var(--layout-card-padding)',
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm" style={{ color: 'var(--theme-text-muted)' }}>
          {label}
        </span>
        <DollarSign className="h-4 w-4" style={{ color: 'var(--theme-primary)' }} />
      </div>
      <div className="text-2xl font-bold mb-1" style={{ color: 'var(--theme-text)' }}>
        {value}
      </div>
      <div className="text-sm" style={{ color: 'var(--theme-primary)' }}>
        {change}
      </div>
    </div>
  )
}

function ActivityItem({
  title,
  time,
  color,
}: {
  title: string
  time: string
  color: string
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-2 h-2 rounded-full mt-2"
        style={{ background: color }}
      />
      <div className="flex-1">
        <p className="text-sm" style={{ color: 'var(--theme-text)' }}>
          {title}
        </p>
        <p className="text-xs" style={{ color: 'var(--theme-text-muted)' }}>
          {time}
        </p>
      </div>
    </div>
  )
}
