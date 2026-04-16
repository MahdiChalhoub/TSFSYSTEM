'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles, SkipForward, CheckCircle2 } from 'lucide-react'

/* ═══════════════════════════════════════════════════════════
 *  TYPES
 * ═══════════════════════════════════════════════════════════ */
export interface TourStep {
    /** CSS selector for the element to highlight. If null, shows a centered modal. */
    target: string | null
    /** Title for this step */
    title: string
    /** Description / body text */
    description: string
    /** Icon to display (React node) */
    icon?: React.ReactNode
    /** Accent color for this step's icon box */
    color?: string
    /** Preferred tooltip placement relative to the target */
    placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto'
    /** If true, this is a "welcome" step shown as a centered overlay, ignoring target */
    isWelcome?: boolean
}

export interface GuidedTourProps {
    /** Unique key for localStorage persistence (e.g., "categories-tour") */
    storageKey: string
    /** Array of tour steps */
    steps: TourStep[]
    /** Callback when tour completes or is dismissed */
    onComplete?: () => void
    /** If true, the tour auto-starts on first visit (default: true) */
    autoStart?: boolean
    /** Delay in ms before auto-starting (default: 800) */
    autoStartDelay?: number
}

/* ═══════════════════════════════════════════════════════════
 *  COMPONENT
 * ═══════════════════════════════════════════════════════════ */
export function GuidedTour({
    storageKey,
    steps,
    onComplete,
    autoStart = true,
    autoStartDelay = 800,
}: GuidedTourProps) {
    const [isActive, setIsActive] = useState(false)
    const [currentStep, setCurrentStep] = useState(0)
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
    const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number; placement: string }>({ top: 0, left: 0, placement: 'bottom' })
    const tooltipRef = useRef<HTMLDivElement>(null)
    const rafRef = useRef<number>(0)

    const step = steps[currentStep]
    const isFirst = currentStep === 0
    const isLast = currentStep === steps.length - 1
    const progress = ((currentStep + 1) / steps.length) * 100

    // Check localStorage on mount
    useEffect(() => {
        if (!autoStart) return
        const dismissed = localStorage.getItem(`tour-${storageKey}`)
        if (dismissed === 'done') return
        const timer = setTimeout(() => setIsActive(true), autoStartDelay)
        return () => clearTimeout(timer)
    }, [storageKey, autoStart, autoStartDelay])

    // Position the highlight and tooltip when step changes
    const positionTooltip = useCallback(() => {
        if (!step || step.isWelcome || !step.target) {
            setTargetRect(null)
            return
        }
        const el = document.querySelector(step.target)
        if (!el) {
            setTargetRect(null)
            return
        }
        const rect = el.getBoundingClientRect()
        setTargetRect(rect)

        // Scroll element into view if needed
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [step])

    useEffect(() => {
        if (!isActive) return
        // Small delay to let DOM settle
        const timer = setTimeout(positionTooltip, 100)
        window.addEventListener('resize', positionTooltip)
        window.addEventListener('scroll', positionTooltip, true)
        return () => {
            clearTimeout(timer)
            window.removeEventListener('resize', positionTooltip)
            window.removeEventListener('scroll', positionTooltip, true)
            cancelAnimationFrame(rafRef.current)
        }
    }, [isActive, currentStep, positionTooltip])

    // Calculate tooltip position after targetRect updates
    useEffect(() => {
        if (!targetRect || !tooltipRef.current) return
        const tooltip = tooltipRef.current
        const tw = tooltip.offsetWidth || 340
        const th = tooltip.offsetHeight || 200
        const pad = 16
        const gap = 12

        let placement = step?.placement || 'auto'
        if (placement === 'auto') {
            const spaceBelow = window.innerHeight - targetRect.bottom
            const spaceAbove = targetRect.top
            const spaceRight = window.innerWidth - targetRect.right
            const spaceLeft = targetRect.left
            if (spaceBelow >= th + gap + pad) placement = 'bottom'
            else if (spaceAbove >= th + gap + pad) placement = 'top'
            else if (spaceRight >= tw + gap + pad) placement = 'right'
            else if (spaceLeft >= tw + gap + pad) placement = 'left'
            else placement = 'bottom'
        }

        let top = 0, left = 0
        switch (placement) {
            case 'bottom':
                top = targetRect.bottom + gap
                left = targetRect.left + targetRect.width / 2 - tw / 2
                break
            case 'top':
                top = targetRect.top - th - gap
                left = targetRect.left + targetRect.width / 2 - tw / 2
                break
            case 'right':
                top = targetRect.top + targetRect.height / 2 - th / 2
                left = targetRect.right + gap
                break
            case 'left':
                top = targetRect.top + targetRect.height / 2 - th / 2
                left = targetRect.left - tw - gap
                break
        }

        // Clamp to viewport
        left = Math.max(pad, Math.min(left, window.innerWidth - tw - pad))
        top = Math.max(pad, Math.min(top, window.innerHeight - th - pad))

        setTooltipPos({ top, left, placement })
    }, [targetRect, step])

    // Actions
    const dismiss = useCallback(() => {
        localStorage.setItem(`tour-${storageKey}`, 'done')
        setIsActive(false)
        setCurrentStep(0)
        onComplete?.()
    }, [storageKey, onComplete])

    const next = useCallback(() => {
        if (isLast) { dismiss(); return }
        setCurrentStep(s => s + 1)
    }, [isLast, dismiss])

    const prev = useCallback(() => {
        if (!isFirst) setCurrentStep(s => s - 1)
    }, [isFirst])

    // Keyboard
    useEffect(() => {
        if (!isActive) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') dismiss()
            if (e.key === 'ArrowRight' || e.key === 'Enter') next()
            if (e.key === 'ArrowLeft') prev()
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isActive, next, prev, dismiss])

    if (!isActive || !step) return null

    const isCentered = step.isWelcome || !step.target || !targetRect
    const accentColor = step.color || 'var(--app-primary)'

    return (
        <div className="fixed inset-0 z-[200] animate-in fade-in duration-300">
            {/* ── Overlay with spotlight cutout ── */}
            {isCentered ? (
                <div
                    className="absolute inset-0"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
                    onClick={dismiss}
                />
            ) : (
                <>
                    {/* SVG mask for spotlight effect */}
                    <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                        <defs>
                            <mask id="tour-spotlight-mask">
                                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                                {targetRect && (
                                    <rect
                                        x={targetRect.left - 6}
                                        y={targetRect.top - 6}
                                        width={targetRect.width + 12}
                                        height={targetRect.height + 12}
                                        rx="12"
                                        fill="black"
                                    />
                                )}
                            </mask>
                        </defs>
                        <rect
                            x="0" y="0" width="100%" height="100%"
                            fill="rgba(0,0,0,0.55)"
                            mask="url(#tour-spotlight-mask)"
                            style={{ backdropFilter: 'blur(2px)' }}
                        />
                    </svg>

                    {/* Spotlight ring glow */}
                    {targetRect && (
                        <div
                            className="absolute rounded-xl pointer-events-none animate-pulse"
                            style={{
                                left: targetRect.left - 6,
                                top: targetRect.top - 6,
                                width: targetRect.width + 12,
                                height: targetRect.height + 12,
                                boxShadow: `0 0 0 3px ${accentColor}, 0 0 20px color-mix(in srgb, ${accentColor} 40%, transparent)`,
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            }}
                        />
                    )}

                    {/* Click-through blocker (prevents interaction outside spotlight) */}
                    <div className="absolute inset-0" onClick={dismiss} />
                </>
            )}

            {/* ── Tooltip Card ── */}
            <div
                ref={tooltipRef}
                className={`
                    ${isCentered ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : 'fixed'}
                    w-[340px] max-w-[calc(100vw-32px)] rounded-2xl overflow-hidden
                    animate-in zoom-in-95 fade-in slide-in-from-bottom-2 duration-300
                `}
                style={{
                    ...(!isCentered ? { top: tooltipPos.top, left: tooltipPos.left } : {}),
                    background: 'var(--app-surface)',
                    border: '1px solid var(--app-border)',
                    boxShadow: `0 20px 60px rgba(0,0,0,0.3), 0 0 40px color-mix(in srgb, ${accentColor} 10%, transparent)`,
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Progress bar */}
                <div className="h-1 w-full" style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                    <div
                        className="h-full transition-all duration-500 ease-out"
                        style={{
                            width: `${progress}%`,
                            background: `linear-gradient(90deg, ${accentColor}, color-mix(in srgb, ${accentColor} 70%, #6366f1))`,
                        }}
                    />
                </div>

                {/* Header */}
                <div className="px-4 pt-3 pb-2 flex items-start gap-3">
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                            background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
                            color: accentColor,
                        }}
                    >
                        {step.icon || <Sparkles size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-sm font-black text-app-foreground tracking-tight leading-tight">
                                {step.title}
                            </h3>
                            <button
                                onClick={dismiss}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all flex-shrink-0"
                            >
                                <X size={12} />
                            </button>
                        </div>
                        <span
                            className="text-[9px] font-bold uppercase tracking-widest"
                            style={{ color: accentColor }}
                        >
                            Step {currentStep + 1} of {steps.length}
                        </span>
                    </div>
                </div>

                {/* Body */}
                <div className="px-4 pb-3">
                    <p className="text-[12px] leading-relaxed font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                        {step.description}
                    </p>
                </div>

                {/* Navigation */}
                <div
                    className="px-4 py-2.5 flex items-center justify-between"
                    style={{
                        background: 'color-mix(in srgb, var(--app-background) 50%, transparent)',
                        borderTop: '1px solid color-mix(in srgb, var(--app-border) 40%, transparent)',
                    }}
                >
                    {/* Step dots */}
                    <div className="flex items-center gap-1.5">
                        {steps.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentStep(i)}
                                className="transition-all duration-300"
                                style={{
                                    width: i === currentStep ? 16 : 6,
                                    height: 6,
                                    borderRadius: 3,
                                    background: i === currentStep
                                        ? accentColor
                                        : i < currentStep
                                            ? `color-mix(in srgb, ${accentColor} 40%, transparent)`
                                            : 'color-mix(in srgb, var(--app-border) 60%, transparent)',
                                }}
                            />
                        ))}
                    </div>

                    {/* Buttons */}
                    <div className="flex items-center gap-1.5">
                        {!isFirst && (
                            <button
                                onClick={prev}
                                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all"
                                style={{ color: 'var(--app-muted-foreground)' }}
                            >
                                <ChevronLeft size={12} />
                                Back
                            </button>
                        )}
                        {isFirst && (
                            <button
                                onClick={dismiss}
                                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all"
                                style={{ color: 'var(--app-muted-foreground)' }}
                            >
                                <SkipForward size={10} />
                                Skip Tour
                            </button>
                        )}
                        <button
                            onClick={next}
                            className="flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg text-white transition-all hover:brightness-110"
                            style={{
                                background: accentColor,
                                boxShadow: `0 2px 8px color-mix(in srgb, ${accentColor} 30%, transparent)`,
                            }}
                        >
                            {isLast ? (
                                <>
                                    <CheckCircle2 size={12} />
                                    Finish
                                </>
                            ) : (
                                <>
                                    Next
                                    <ChevronRight size={12} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  TOUR TRIGGER BUTTON — reusable "?" or info icon button
 * ═══════════════════════════════════════════════════════════ */
export function TourTriggerButton({
    onClick,
    label = 'Tour',
}: {
    onClick: () => void
    label?: string
}) {
    return (
        <button
            onClick={onClick}
            title="Start guided tour"
            className="flex items-center gap-1.5 text-[11px] font-bold text-app-muted-foreground hover:text-app-foreground border border-app-border px-2.5 py-1.5 rounded-xl hover:bg-app-surface transition-all group"
        >
            <Sparkles size={13} className="group-hover:text-amber-400 transition-colors" />
            <span className="hidden md:inline">{label}</span>
        </button>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  HOOK — for manual tour control
 * ═══════════════════════════════════════════════════════════ */
export function useTour(storageKey: string) {
    const [forceStart, setForceStart] = useState(0)

    const startTour = useCallback(() => {
        localStorage.removeItem(`tour-${storageKey}`)
        setForceStart(k => k + 1)
    }, [storageKey])

    const resetTour = useCallback(() => {
        localStorage.removeItem(`tour-${storageKey}`)
    }, [storageKey])

    return { forceStart, startTour, resetTour }
}
