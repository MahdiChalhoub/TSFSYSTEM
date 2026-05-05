/**
 * Layout Primitives
 * =================
 * Anti-overlap layout components with built-in safety
 */

import React from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// PAGE STRUCTURE
// ============================================================================

interface PageShellProps {
  children: React.ReactNode
  className?: string
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <div className={cn('page-shell', className)}>
      {children}
    </div>
  )
}

// ============================================================================
// PAGE HEADER
// ============================================================================

interface PageHeaderProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  breadcrumbs?: React.ReactNode
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  actions,
  breadcrumbs,
  className
}: PageHeaderProps) {
  return (
    <div className={cn('page-header', className)}>
      {breadcrumbs && (
        <div className="text-sm text-[var(--app-muted-foreground)]">
          {breadcrumbs}
        </div>
      )}
      <div className="page-header-row">
        <div className="flex-item-safe flex-grow">
          <h1 className="page-header-title text-truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-[var(--app-muted-foreground)] mt-1 text-truncate">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="page-header-actions">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// PAGE CONTENT
// ============================================================================

interface PageContentProps {
  children: React.ReactNode
  constrained?: boolean
  className?: string
}

export function PageContent({
  children,
  constrained = true,
  className
}: PageContentProps) {
  return (
    <div className={cn('page-content', className)}>
      <div className={cn(constrained && 'page-content-constrained')}>
        {children}
      </div>
    </div>
  )
}

// ============================================================================
// SECTION
// ============================================================================

interface SectionProps {
  children: React.ReactNode
  title?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function Section({
  children,
  title,
  actions,
  className
}: SectionProps) {
  return (
    <section className={cn('section', className)}>
      {(title || actions) && (
        <div className="section-header">
          {title && (
            <h2 className="section-title text-truncate">
              {title}
            </h2>
          )}
          {actions && (
            <div className="flex row-3 flex-no-shrink">
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

// ============================================================================
// STACK (Vertical)
// ============================================================================

interface StackProps {
  children: React.ReactNode
  spacing?: 1 | 2 | 3 | 4 | 5 | 6 | 8
  className?: string
}

export function Stack({ children, spacing = 4, className }: StackProps) {
  return (
    <div className={cn('stack', `stack-${spacing}`, className)}>
      {children}
    </div>
  )
}

// ============================================================================
// ROW (Horizontal)
// ============================================================================

interface RowProps {
  children: React.ReactNode
  spacing?: 1 | 2 | 3 | 4 | 5 | 6
  wrap?: boolean
  responsive?: boolean
  className?: string
}

export function Row({
  children,
  spacing = 3,
  wrap = false,
  responsive = false,
  className
}: RowProps) {
  const baseClass = responsive ? 'row-responsive' : wrap ? 'row-wrap' : 'row'
  return (
    <div className={cn(baseClass, !responsive && `row-${spacing}`, className)}>
      {children}
    </div>
  )
}

// ============================================================================
// CARD
// ============================================================================

interface CardProps {
  children: React.ReactNode
  title?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function Card({ children, title, actions, className }: CardProps) {
  return (
    <div className={cn('card-safe', className)}>
      {(title || actions) && (
        <div className="card-header">
          {title && (
            <h3 className="card-title text-truncate">
              {title}
            </h3>
          )}
          {actions && (
            <div className="card-actions">
              {actions}
            </div>
          )}
        </div>
      )}
      <div className="card-body">
        {children}
      </div>
    </div>
  )
}

// ============================================================================
// SIDEBAR ITEM
// ============================================================================

interface SidebarItemProps {
  icon?: React.ReactNode
  label: string
  badge?: React.ReactNode
  chevron?: boolean
  expanded?: boolean
  onClick?: () => void
  active?: boolean
  className?: string
}

export function SidebarItem({
  icon,
  label,
  badge,
  chevron = false,
  expanded = false,
  onClick,
  active = false,
  className
}: SidebarItemProps) {
  return (
    <button
      type="button"
      className={cn(
        'sidebar-item',
        active && 'bg-[var(--app-primary)] text-white',
        expanded && 'sidebar-item-expanded',
        className
      )}
      onClick={onClick}
    >
      {icon && (
        <span className="sidebar-item-icon">
          {icon}
        </span>
      )}
      <span className="sidebar-item-label">
        {label}
      </span>
      {badge && (
        <span className="sidebar-item-badge">
          {badge}
        </span>
      )}
      {chevron && (
        <span className="sidebar-item-chevron">
          →
        </span>
      )}
    </button>
  )
}

// ============================================================================
// TOOLBAR
// ============================================================================

interface ToolbarProps {
  left?: React.ReactNode
  right?: React.ReactNode
  className?: string
}

export function Toolbar({ left, right, className }: ToolbarProps) {
  return (
    <div className={cn('toolbar', className)}>
      {left && (
        <div className="toolbar-left">
          {left}
        </div>
      )}
      {right && (
        <div className="toolbar-right">
          {right}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// TABS
// ============================================================================

interface TabsProps {
  children: React.ReactNode
  className?: string
}

export function Tabs({ children, className }: TabsProps) {
  return (
    <div className={cn('tabs-safe', className)}>
      {children}
    </div>
  )
}

interface TabProps {
  children: React.ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
}

export function Tab({ children, active = false, onClick, className }: TabProps) {
  return (
    <button
      type="button"
      className={cn('tab-item', active && 'tab-item-active', className)}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

// ============================================================================
// EMPTY STATE
// ============================================================================

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className
}: EmptyStateProps) {
  return (
    <div className={cn('empty-state', className)}>
      {icon && (
        <div className="empty-state-icon">
          {icon}
        </div>
      )}
      <h3 className="empty-state-title">
        {title}
      </h3>
      {description && (
        <p className="empty-state-description">
          {description}
        </p>
      )}
      {action && action}
    </div>
  )
}

// ============================================================================
// STEP HEADER (For wizards/steppers)
// ============================================================================

interface StepHeaderProps {
  number: number
  title: string
  description?: string
  status?: 'current' | 'completed' | 'upcoming'
  className?: string
}

export function StepHeader({
  number,
  title,
  description,
  status = 'upcoming',
  className
}: StepHeaderProps) {
  return (
    <div className={cn('step-header', className)}>
      <div
        className={cn(
          'step-number',
          status === 'completed' && 'bg-green-600',
          status === 'upcoming' && 'bg-gray-400'
        )}
      >
        {status === 'completed' ? '✓' : number}
      </div>
      <div className="step-content">
        <div className="step-title text-truncate">
          {title}
        </div>
        {description && (
          <div className="step-description line-clamp-2">
            {description}
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// BADGE
// ============================================================================

interface BadgeProps {
  children: React.ReactNode
  variant?: 'primary' | 'success' | 'warning' | 'error' | 'info'
  className?: string
}

export function Badge({ children, variant = 'primary', className }: BadgeProps) {
  const variants = {
    primary: 'bg-[var(--app-primary)] text-white',
    success: 'bg-green-600 text-white',
    warning: 'bg-yellow-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-blue-600 text-white'
  }

  return (
    <span className={cn('badge-safe', variants[variant], className)}>
      {children}
    </span>
  )
}

// ============================================================================
// STATUS INDICATOR
// ============================================================================

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'busy' | 'away'
  label?: string
  className?: string
}

export function StatusIndicator({ status, label, className }: StatusIndicatorProps) {
  const colors = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    busy: 'bg-red-500',
    away: 'bg-yellow-500'
  }

  return (
    <div className={cn('status-indicator', className)}>
      <span className={cn('status-dot', colors[status])} />
      {label && (
        <span className="text-sm text-[var(--app-foreground)]">
          {label}
        </span>
      )}
    </div>
  )
}
