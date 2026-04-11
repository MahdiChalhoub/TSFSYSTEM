'use client'

/**
 * Toggle Switch
 * ==============
 * Minimal on/off toggle switch using app theme variables.
 * Reusable across all modules.
 */

import React from 'react'

interface ToggleSwitchProps {
  on: boolean
  size?: 'sm' | 'md'
}

export const ToggleSwitch = React.memo(function ToggleSwitch({ on, size = 'sm' }: ToggleSwitchProps) {
  const w = size === 'md' ? 'w-10 h-[22px]' : 'w-8 h-[18px]'
  const dot = size === 'md' ? 'w-[18px] h-[18px]' : 'w-[14px] h-[14px]'
  const pos = size === 'md' ? (on ? 'left-[20px]' : 'left-[2px]') : (on ? 'left-[18px]' : 'left-[2px]')

  return (
    <div className={`${w} rounded-full transition-all relative ${on ? 'bg-app-primary' : 'bg-app-border'}`}>
      <div className={`absolute top-[2px] ${dot} rounded-full bg-white shadow-sm transition-all ${pos}`} />
    </div>
  )
})
