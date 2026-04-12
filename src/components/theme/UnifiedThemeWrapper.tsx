/**
 * Unified Theme Wrapper — LEGACY COMPATIBILITY SHIM
 * ==================================================
 * Now just re-exports AppThemeProvider.
 * All theme logic lives in @/components/app/AppThemeProvider.tsx
 */

'use client'

import { AppThemeProvider } from '@/components/app/AppThemeProvider'

interface UnifiedThemeWrapperProps {
  children: React.ReactNode
}

export function UnifiedThemeWrapper({ children }: UnifiedThemeWrapperProps) {
  return (
    <AppThemeProvider>
      {children}
    </AppThemeProvider>
  )
}
