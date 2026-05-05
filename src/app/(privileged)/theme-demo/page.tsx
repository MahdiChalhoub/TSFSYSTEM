"use client"

import { useAppTheme } from '@/components/app/AppThemeProvider'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Sparkles, Zap, TrendingUp, Users, DollarSign, Package, ShoppingCart, BarChart } from 'lucide-react'

export default function ThemeDemoPage() {
  const { currentTheme, allThemes, setTheme, activeColors, activeLayout } = useAppTheme()
  const theme = currentTheme?.slug || 'midnight-pro'
  const themeConfig = {
    name: currentTheme?.name || 'Default',
    description: currentTheme?.description || '',
    colors: activeColors,
  }
  const layoutConfig = {
    name: activeLayout?.density || 'medium',
    description: `${activeLayout?.whitespace || 'balanced'} whitespace`,
    characteristics: { density: activeLayout?.density || 'medium', whitespace: activeLayout?.whitespace || 'balanced' },
    spacing: activeLayout?.spacing || { container: '1.5rem', section: '1.75rem', card: '1.25rem', element: '0.875rem' },
    cards: { borderRadius: 'var(--card-radius)' },
  }
  const availableThemes = allThemes.map(t => ({ id: t.slug, name: t.name, colors: t.presetData?.colors?.dark || activeColors }))

  return (
    <div style={{ padding: 'var(--layout-container-padding)' }}>
      {/* Header Section */}
      <div
        className="rounded-lg p-6 mb-6"
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
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-app-foreground)' }}>
            Theme & Layout System Demo
          </h1>
        </div>
        <p className="text-lg" style={{ color: 'var(--text-app-muted-foreground)' }}>
          Explore 50 unique visual combinations by mixing themes and layouts.
          Your preferences are saved automatically!
        </p>
      </div>

      {/* Current Selection Info */}
      <div
        className="grid md:grid-cols-2 gap-4 mb-6"
        style={{ gap: 'var(--layout-element-gap)' }}
      >
        <div
          className="p-4 rounded-lg"
          style={{
            background: 'var(--theme-surface)',
            border: '2px solid var(--theme-primary)',
          }}
        >
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--theme-primary)' }}>
            Current Theme
          </h3>
          <p className="text-xl font-bold mb-1" style={{ color: 'var(--text-app-foreground)' }}>
            {themeConfig.name}
          </p>
          <p className="text-sm mb-2" style={{ color: 'var(--text-app-muted-foreground)' }}>
            {themeConfig.description}
          </p>
          <div className="flex gap-2 mt-3">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded"
                style={{ background: themeConfig.colors.primary }}
              />
              <span className="text-xs" style={{ color: 'var(--text-app-muted-foreground)' }}>
                Primary
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded border"
                style={{
                  background: themeConfig.colors.surface,
                  borderColor: 'var(--theme-border)',
                }}
              />
              <span className="text-xs" style={{ color: 'var(--text-app-muted-foreground)' }}>
                Surface
              </span>
            </div>
          </div>
        </div>

        <div
          className="p-4 rounded-lg"
          style={{
            background: 'var(--theme-surface)',
            border: '2px solid var(--theme-primary)',
          }}
        >
          <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--theme-primary)' }}>
            Current Layout
          </h3>
          <p className="text-xl font-bold mb-1" style={{ color: 'var(--text-app-foreground)' }}>
            {layoutConfig.name}
          </p>
          <p className="text-sm mb-2" style={{ color: 'var(--text-app-muted-foreground)' }}>
            {layoutConfig.description}
          </p>
          <div className="flex gap-3 mt-3">
            <div>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-app-muted-foreground)' }}>
                Density:
              </span>
              <span className="text-xs ml-1" style={{ color: 'var(--text-app-foreground)' }}>
                {layoutConfig.characteristics.density}
              </span>
            </div>
            <div>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-app-muted-foreground)' }}>
                Whitespace:
              </span>
              <span className="text-xs ml-1" style={{ color: 'var(--text-app-foreground)' }}>
                {layoutConfig.characteristics.whitespace}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Theme Switcher */}
      <div
        className="p-6 rounded-lg mb-6"
        style={{
          background: 'var(--theme-surface)',
          border: '1px solid var(--theme-border)',
        }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-app-foreground)' }}>
          Quick Theme Switch
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {availableThemes.slice(0, 10).map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              className="p-3 rounded-lg transition-all"
              style={{
                background: theme === t.id ? 'var(--theme-primary)' : 'var(--bg-app-bg)',
                border: '2px solid',
                borderColor: theme === t.id ? 'var(--theme-primary)' : 'var(--theme-border)',
                color: theme === t.id ? '#fff' : 'var(--text-app-foreground)',
              }}
            >
              <div className="text-sm font-semibold mb-1">{t.name}</div>
              <div
                className="w-full h-6 rounded"
                style={{
                  background: `linear-gradient(135deg, ${t.colors.primary} 0%, ${t.colors.surface} 100%)`,
                }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Current Layout Info */}
      <div
        className="p-6 rounded-lg mb-6"
        style={{
          background: 'var(--theme-surface)',
          border: '1px solid var(--theme-border)',
        }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-app-foreground)' }}>
          Active Layout Config
        </h2>
        <div className="grid md:grid-cols-3 gap-3">
          {(['sparse', 'medium', 'dense'] as const).map((d) => (
            <div
              key={d}
              className="p-3 rounded-lg transition-all text-left"
              style={{
                background: activeLayout?.density === d ? 'var(--theme-primary)' : 'var(--bg-app-bg)',
                border: '2px solid',
                borderColor: activeLayout?.density === d ? 'var(--theme-primary)' : 'var(--theme-border)',
                color: activeLayout?.density === d ? '#fff' : 'var(--text-app-foreground)',
              }}
            >
              <div className="text-sm font-semibold mb-1 capitalize">{d}</div>
              <div className="text-xs opacity-75">Density</div>
            </div>
          ))}
        </div>
      </div>

      {/* Dashboard Metrics Example */}
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-app-foreground)' }}>
        Sample Dashboard Cards
      </h2>
      <div
        className="grid gap-4 mb-6"
        style={{
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--layout-element-gap)',
        }}
      >
        <MetricCard
          label="Total Revenue"
          value="$45,231"
          change="+12.5%"
          icon={<DollarSign className="h-5 w-5" />}
        />
        <MetricCard
          label="Total Orders"
          value="1,234"
          change="+23.1%"
          icon={<ShoppingCart className="h-5 w-5" />}
        />
        <MetricCard
          label="Active Customers"
          value="8,124"
          change="+5.4%"
          icon={<Users className="h-5 w-5" />}
        />
        <MetricCard
          label="Products"
          value="456"
          change="+8.2%"
          icon={<Package className="h-5 w-5" />}
        />
      </div>

      {/* Feature Cards */}
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-app-foreground)' }}>
        Sample Feature Cards
      </h2>
      <div
        className="grid md:grid-cols-3 gap-4"
        style={{ gap: 'var(--layout-section-spacing)' }}
      >
        <FeatureCard
          icon={<Zap className="h-6 w-6" />}
          title="Instant Switching"
          description="Change themes and layouts in real-time with zero page reload. See changes immediately."
        />
        <FeatureCard
          icon={<TrendingUp className="h-6 w-6" />}
          title="Performance"
          description="CSS variables ensure blazing-fast theme changes with minimal performance impact."
        />
        <FeatureCard
          icon={<BarChart className="h-6 w-6" />}
          title="50 Combinations"
          description="Mix any of 10 themes with any of 5 layouts for unlimited customization."
        />
      </div>

      {/* CSS Variables Display */}
      <div
        className="mt-6 p-6 rounded-lg"
        style={{
          background: 'var(--theme-surface)',
          border: '1px solid var(--theme-border)',
        }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-app-foreground)' }}>
          Active CSS Variables
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--theme-primary)' }}>
              Theme Variables
            </h3>
            <div className="space-y-2 font-mono text-xs">
              <CSSVarDisplay name="--theme-primary" value={themeConfig.colors.primary} />
              <CSSVarDisplay name="--bg-app-bg" value={themeConfig.colors.bg} />
              <CSSVarDisplay name="--theme-surface" value={themeConfig.colors.surface} />
              <CSSVarDisplay name="--text-app-foreground" value={themeConfig.colors.text} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--theme-primary)' }}>
              Layout Variables
            </h3>
            <div className="space-y-2 font-mono text-xs">
              <CSSVarDisplay name="--layout-container-padding" value={layoutConfig.spacing.container} />
              <CSSVarDisplay name="--layout-section-spacing" value={layoutConfig.spacing.section} />
              <CSSVarDisplay name="--layout-card-padding" value={layoutConfig.spacing.card} />
              <CSSVarDisplay name="--layout-card-radius" value={layoutConfig.cards.borderRadius} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  label,
  value,
  change,
  icon,
}: {
  label: string
  value: string
  change: string
  icon: React.ReactNode
}) {
  return (
    <div
      className="p-4 rounded-lg"
      style={{
        background: 'var(--theme-surface)',
        border: '1px solid var(--theme-border)',
        padding: 'var(--layout-card-padding)',
        borderRadius: 'var(--layout-card-radius)',
        boxShadow: 'var(--layout-card-shadow)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm" style={{ color: 'var(--text-app-muted-foreground)' }}>
          {label}
        </span>
        <div style={{ color: 'var(--theme-primary)' }}>{icon}</div>
      </div>
      <div className="text-2xl font-bold mb-1" style={{ color: 'var(--text-app-foreground)' }}>
        {value}
      </div>
      <div className="text-sm" style={{ color: 'var(--theme-primary)' }}>
        {change}
      </div>
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
      className="p-6 rounded-lg"
      style={{
        background: 'var(--theme-surface)',
        border: '1px solid var(--theme-border)',
        padding: 'var(--layout-card-padding)',
        borderRadius: 'var(--layout-card-radius)',
      }}
    >
      <div className="mb-3" style={{ color: 'var(--theme-primary)' }}>
        {icon}
      </div>
      <h3 className="font-semibold mb-2" style={{ color: 'var(--text-app-foreground)' }}>
        {title}
      </h3>
      <p className="text-sm" style={{ color: 'var(--text-app-muted-foreground)' }}>
        {description}
      </p>
    </div>
  )
}

function CSSVarDisplay({ name, value }: { name: string; value: string }) {
  return (
    <div
      className="p-2 rounded flex justify-between items-center"
      style={{
        background: 'var(--bg-app-bg)',
        border: '1px solid var(--theme-border)',
      }}
    >
      <span style={{ color: 'var(--text-app-muted-foreground)' }}>{name}</span>
      <span style={{ color: 'var(--text-app-foreground)' }}>{value}</span>
    </div>
  )
}
