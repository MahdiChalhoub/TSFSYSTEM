/**
 * Unified Theme Wrapper
 * =====================
 * Wraps UnifiedThemeEngine provider around the app.
 * Place this in your layout hierarchy.
 */

'use client'

import { UnifiedThemeEngineProvider } from '@/contexts/UnifiedThemeEngine'

interface UnifiedThemeWrapperProps {
  children: React.ReactNode
}

export function UnifiedThemeWrapper({ children }: UnifiedThemeWrapperProps) {
  return (
    <UnifiedThemeEngineProvider defaultTheme="finance-pro" defaultColorMode="dark">
      {children}
    </UnifiedThemeEngineProvider>
  )
}
