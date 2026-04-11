/**
 * ResponsiveLayout Component System
 *
 * Provides automatic layout transformation based on screen size tiers:
 * - Tier 1 (1280-1919px): Single column, centered
 * - Tier 2 (1920-2559px): 2-column split
 * - Tier 3 (2560-3439px): 3-column dashboard
 * - Tier 4 (3440px+):     4-panel workspace
 */

import React from 'react'

interface ResponsiveLayoutProps {
  children: React.ReactNode
  mode?: 'auto' | 'dual' | 'triple' | 'quad'
  variant?: 'default' | 'sidebar' | 'even'
  className?: string
}

/**
 * Adaptive layout container that transforms based on screen width
 */
export function ResponsiveLayout({
  children,
  mode = 'auto',
  variant = 'default',
  className = ''
}: ResponsiveLayoutProps) {
  const layoutClass = getLayoutClass(mode, variant)

  return (
    <div className={`${layoutClass} ${className}`}>
      {children}
    </div>
  )
}

function getLayoutClass(mode: string, variant: string): string {
  if (mode === 'auto') {
    // Auto mode: applies all tiers progressively
    if (variant === 'sidebar') {
      return 'layout-standard layout-dual-sidebar layout-triple-sidebar'
    }
    if (variant === 'even') {
      return 'layout-standard layout-dual-even layout-triple-even'
    }
    return 'layout-standard layout-dual layout-triple'
  }

  if (mode === 'dual') {
    return variant === 'sidebar' ? 'layout-dual-sidebar' :
           variant === 'even' ? 'layout-dual-even' : 'layout-dual'
  }

  if (mode === 'triple') {
    return variant === 'sidebar' ? 'layout-triple-sidebar' :
           variant === 'even' ? 'layout-triple-even' : 'layout-triple'
  }

  if (mode === 'quad') {
    return variant === 'sidebar' ? 'layout-quad-sidebar' : 'layout-quad'
  }

  return 'layout-standard'
}

/**
 * Main content area (left or center)
 */
export function MainContent({
  children,
  className = ''
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      {children}
    </div>
  )
}

/**
 * Sidebar panel (shows on wide+ screens)
 */
export function SidePanel({
  children,
  position = 'right',
  hideBelow = 'wide',
  className = ''
}: {
  children: React.ReactNode
  position?: 'left' | 'right'
  hideBelow?: 'wide' | 'ultra' | 'super'
  className?: string
}) {
  const hideClass = hideBelow === 'wide' ? 'hide-below-wide' :
                    hideBelow === 'ultra' ? 'hide-below-ultra' : ''

  return (
    <aside className={`${hideClass} ${className}`}>
      {children}
    </aside>
  )
}

/**
 * Context panel (shows on ultra+ screens)
 */
export function ContextPanel({
  children,
  className = ''
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <aside className={`hide-below-ultra ${className}`}>
      {children}
    </aside>
  )
}

/**
 * Analytics panel (shows on super+ screens)
 */
export function AnalyticsPanel({
  children,
  className = ''
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <aside className={`hide-super ${className}`}>
      {children}
    </aside>
  )
}
