'use client'

/* ═══════════════════════════════════════════════════════════
 *  TSFSYSTEM — GuidedTour — Interactive Tour Renderer
 *  Part of the platform-wide tour system.
 *
 *  Supports 3 step behaviors:
 *    'info'   → Passive tooltip, user clicks Next
 *    'click'  → Highlights target, waits for user click  
 *    'action' → Programmatically performs a UI action via callback
 *
 *  Usage:
 *    import '@/lib/tours/definitions/my-page'
 *    const { start } = usePageTour('my-page')
 *    <GuidedTour tourId="my-page" stepActions={{ 3: () => openPanel() }} />
 * ═══════════════════════════════════════════════════════════ */

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronRight, ChevronLeft, Sparkles, SkipForward, CheckCircle2, MousePointerClick } from 'lucide-react'
import { useTourContext } from '@/lib/tours/context'
import { getTour } from '@/lib/tours/registry'
import { markTourCompleted, shouldAutoStart } from '@/lib/tours/storage'
import type { StepActions } from '@/lib/tours/types'

/* ═══════════════════════════════════════════════════════════
 *  MAIN COMPONENT
 * ═══════════════════════════════════════════════════════════ */
export function GuidedTour({
    tourId,
    autoStart = true,
    autoStartDelay = 800,
    stepActions = {},
    onComplete,
}: {
    /** The registered tour ID */
    tourId: string
    /** Auto-start on first visit (default: true) */
    autoStart?: boolean
    /** Delay before auto-start in ms (default: 800) */
    autoStartDelay?: number
    /**
     * Action callbacks keyed by step index.
     * For 'action' steps: called when the step activates (performs UI change).
     * For 'click' steps: called when user clicks the target element.
     */
    stepActions?: StepActions
    /** Callback when tour completes */
    onComplete?: () => void
}) {
    const { activeTourId, startTour, dismissTour } = useTourContext()
    const [currentStep, setCurrentStep] = useState(0)
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
    const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
    const [actionExecuted, setActionExecuted] = useState(false)
    const tooltipRef = useRef<HTMLDivElement>(null)
    const clickListenerRef = useRef<(() => void) | null>(null)

    const tourConfig = getTour(tourId)
    const isActive = activeTourId === tourId
    const steps = tourConfig?.steps ?? []
    const step = steps[currentStep]
    const isFirst = currentStep === 0
    const isLast = currentStep === steps.length - 1
    const progress = steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0
    const behavior = step?.behavior || 'info'

    // Auto-start on first visit
    useEffect(() => {
        if (!autoStart || !tourConfig) return
        if (!shouldAutoStart(tourId, tourConfig.version)) return
        const timer = setTimeout(() => startTour(tourId), autoStartDelay)
        return () => clearTimeout(timer)
    }, [tourId, autoStart, autoStartDelay, tourConfig, startTour])

    // Reset step index when tour activates
    useEffect(() => {
        if (isActive) {
            setCurrentStep(0)
            setActionExecuted(false)
        }
    }, [isActive])

    // Execute action when entering an 'action' step
    useEffect(() => {
        if (!isActive || !step || actionExecuted) return
        if (behavior === 'action' && stepActions[currentStep]) {
            const timer = setTimeout(async () => {
                await stepActions[currentStep]()
                setActionExecuted(true)
            }, 300) // Small delay to let tooltip render first
            return () => clearTimeout(timer)
        }
    }, [isActive, currentStep, behavior, stepActions, step, actionExecuted])

    // Set up click listener for 'click' behavior steps
    useEffect(() => {
        // Clean up previous listener
        if (clickListenerRef.current) {
            clickListenerRef.current()
            clickListenerRef.current = null
        }

        if (!isActive || !step || behavior !== 'click' || !step.target) return

        const handler = async () => {
            // Execute the action callback if provided
            if (stepActions[currentStep]) {
                await stepActions[currentStep]()
            }
            // Auto-advance to next step after a brief delay
            setTimeout(() => {
                if (isLast) {
                    completeTour()
                } else {
                    setCurrentStep(s => s + 1)
                    setActionExecuted(false)
                }
            }, step.actionDelay ?? 400)
        }

        // Wait for element to exist, then attach listener
        const timer = setTimeout(() => {
            const el = document.querySelector(step.target!)
            if (el) {
                el.addEventListener('click', handler, { once: true })
                clickListenerRef.current = () => el.removeEventListener('click', handler)
            }
        }, 200)

        return () => {
            clearTimeout(timer)
            if (clickListenerRef.current) {
                clickListenerRef.current()
                clickListenerRef.current = null
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive, currentStep, behavior])

    // Position highlight + tooltip
    const positionTooltip = useCallback(() => {
        if (!step || step.isWelcome || !step.target) {
            setTargetRect(null)
            return
        }
        const el = document.querySelector(step.target)
        if (!el) { setTargetRect(null); return }
        const rect = el.getBoundingClientRect()
        setTargetRect(rect)
        if (rect.top < 80 || rect.bottom > window.innerHeight - 20) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [step])

    useEffect(() => {
        if (!isActive) return
        // For action steps that create DOM elements dynamically,
        // retry positioning multiple times until the element appears
        const delays = [200, 500, 800, 1200]
        const timers = delays.map(d => setTimeout(positionTooltip, d))
        window.addEventListener('resize', positionTooltip)
        window.addEventListener('scroll', positionTooltip, true)
        return () => {
            timers.forEach(t => clearTimeout(t))
            window.removeEventListener('resize', positionTooltip)
            window.removeEventListener('scroll', positionTooltip, true)
        }
    }, [isActive, currentStep, positionTooltip, actionExecuted])

    // Calculate tooltip position
    useEffect(() => {
        if (!targetRect || !tooltipRef.current) return
        const tw = tooltipRef.current.offsetWidth || 360
        const th = tooltipRef.current.offsetHeight || 200
        const pad = 16, gap = 14

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
                top = targetRect.bottom + gap; left = targetRect.left + targetRect.width / 2 - tw / 2; break
            case 'top':
                top = targetRect.top - th - gap; left = targetRect.left + targetRect.width / 2 - tw / 2; break
            case 'right':
                top = targetRect.top + targetRect.height / 2 - th / 2; left = targetRect.right + gap; break
            case 'left':
                top = targetRect.top + targetRect.height / 2 - th / 2; left = targetRect.left - tw - gap; break
        }
        left = Math.max(pad, Math.min(left, window.innerWidth - tw - pad))
        top = Math.max(pad, Math.min(top, window.innerHeight - th - pad))
        setTooltipPos({ top, left })
    }, [targetRect, step])

    // Actions
    const completeTour = useCallback(() => {
        if (tourConfig) markTourCompleted(tourId, tourConfig.version)
        // Clean up click listener
        if (clickListenerRef.current) {
            clickListenerRef.current()
            clickListenerRef.current = null
        }
        dismissTour()
        setCurrentStep(0)
        setActionExecuted(false)
        onComplete?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tourId, tourConfig, dismissTour, onComplete])

    const next = useCallback(() => {
        if (isLast) { completeTour(); return }
        setCurrentStep(s => s + 1)
        setActionExecuted(false)
    }, [isLast, completeTour])

    const prev = useCallback(() => {
        if (!isFirst) {
            setCurrentStep(s => s - 1)
            setActionExecuted(false)
        }
    }, [isFirst])

    // Keyboard
    useEffect(() => {
        if (!isActive) return
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') completeTour()
            if (behavior !== 'click') {
                if (e.key === 'ArrowRight' || e.key === 'Enter') next()
                if (e.key === 'ArrowLeft') prev()
            }
        }
        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [isActive, next, prev, completeTour, behavior])

    if (!isActive || !step || steps.length === 0) return null

    const isCentered = step.isWelcome || !step.target || !targetRect
    const accentColor = step.color || 'var(--app-primary)'
    const isClickStep = behavior === 'click'

    return (
        <div className="fixed inset-0 z-[10000] animate-in fade-in duration-300" key={`tour-step-${currentStep}`}>
            {/* ── Overlay ── */}
            {isCentered ? (
                <div
                    className="absolute inset-0"
                    style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
                    onClick={completeTour}
                />
            ) : (
                <>
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                        <defs>
                            <mask id={`tour-mask-${tourId}-${currentStep}`}>
                                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                                {targetRect && (
                                    <rect
                                        x={targetRect.left - 8} y={targetRect.top - 8}
                                        width={targetRect.width + 16} height={targetRect.height + 16}
                                        rx="14" fill="black"
                                    />
                                )}
                            </mask>
                        </defs>
                        <rect x="0" y="0" width="100%" height="100%"
                            fill="rgba(0,0,0,0.5)"
                            mask={`url(#tour-mask-${tourId}-${currentStep})`}
                        />
                    </svg>

                    {/* Spotlight ring */}
                    {targetRect && (
                        <div
                            className="absolute rounded-2xl pointer-events-none"
                            style={{
                                left: targetRect.left - 8, top: targetRect.top - 8,
                                width: targetRect.width + 16, height: targetRect.height + 16,
                                boxShadow: isClickStep
                                    ? `0 0 0 3px ${accentColor}, 0 0 0 6px color-mix(in srgb, ${accentColor} 20%, transparent), 0 0 30px color-mix(in srgb, ${accentColor} 40%, transparent)`
                                    : `0 0 0 3px ${accentColor}, 0 0 24px color-mix(in srgb, ${accentColor} 30%, transparent)`,
                                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                                animation: isClickStep ? 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite' : undefined,
                            }}
                        />
                    )}

                    {/* Click-through: for 'click' steps, make the target clickable */}
                    {isClickStep && targetRect && (
                        <>
                            {/* Block clicks everywhere EXCEPT the target */}
                            <div className="absolute inset-0" style={{ pointerEvents: 'auto' }} onClick={(e) => e.stopPropagation()} />
                            {/* Hole over target: allow clicks through */}
                            <div
                                className="absolute"
                                style={{
                                    left: targetRect.left - 8, top: targetRect.top - 8,
                                    width: targetRect.width + 16, height: targetRect.height + 16,
                                    pointerEvents: 'none',
                                }}
                            />
                        </>
                    )}

                    {/* For non-click steps, block all interaction */}
                    {!isClickStep && <div className="absolute inset-0" onClick={completeTour} />}
                </>
            )}

            {/* ── Click pulse indicator for 'click' steps ── */}
            {isClickStep && targetRect && (
                <div
                    className="absolute pointer-events-none flex items-center justify-center"
                    style={{
                        left: targetRect.left + targetRect.width / 2 - 16,
                        top: targetRect.top + targetRect.height / 2 - 16,
                        width: 32, height: 32,
                        zIndex: 10001,
                    }}
                >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center animate-bounce"
                        style={{
                            background: accentColor,
                            boxShadow: `0 4px 16px color-mix(in srgb, ${accentColor} 50%, transparent)`,
                        }}>
                        <MousePointerClick size={14} className="text-white" />
                    </div>
                </div>
            )}

            {/* ── Tooltip Card ── */}
            <div
                ref={tooltipRef}
                className={`
                    ${isCentered ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : 'fixed'}
                    w-[370px] max-w-[calc(100vw-32px)] rounded-2xl overflow-hidden
                    animate-in zoom-in-95 fade-in slide-in-from-bottom-2 duration-300
                `}
                style={{
                    ...(!isCentered ? { top: tooltipPos.top, left: tooltipPos.left } : {}),
                    background: 'var(--app-surface)',
                    border: '1px solid var(--app-border)',
                    boxShadow: `0 24px 64px rgba(0,0,0,0.35), 0 0 40px color-mix(in srgb, ${accentColor} 10%, transparent)`,
                    zIndex: 10002,
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Progress bar */}
                <div className="h-1 w-full" style={{ background: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                    <div
                        className="h-full transition-all duration-500 ease-out"
                        style={{
                            width: `${progress}%`,
                            background: `linear-gradient(90deg, ${accentColor}, color-mix(in srgb, ${accentColor} 60%, #818cf8))`,
                        }}
                    />
                </div>

                {/* Header */}
                <div className="px-4 pt-3.5 pb-1 flex items-start gap-3">
                    <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                            background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 15%, transparent), color-mix(in srgb, ${accentColor} 8%, transparent))`,
                            color: accentColor,
                            border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)`,
                        }}
                    >
                        {step.icon || <Sparkles size={18} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                            <h3 className="text-[14px] font-black text-app-foreground tracking-tight leading-tight">
                                {step.title}
                            </h3>
                            <button
                                onClick={completeTour}
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-app-muted-foreground hover:text-app-foreground hover:bg-app-border/50 transition-all flex-shrink-0"
                                title="Close tour (Esc)"
                            >
                                <X size={13} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>
                                Step {currentStep + 1} of {steps.length}
                            </span>
                            {isClickStep && (
                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md animate-pulse"
                                    style={{
                                        background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
                                        color: accentColor,
                                    }}>
                                    ⬆ Click to continue
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="px-4 pt-1 pb-3">
                    <p className="text-[12px] leading-[1.65] font-medium" style={{ color: 'var(--app-muted-foreground)' }}>
                        {step.description}
                    </p>
                    {step.actionHint && (
                        <div className="mt-2 flex items-center gap-2 text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
                            style={{
                                background: `color-mix(in srgb, ${accentColor} 6%, transparent)`,
                                color: accentColor,
                                border: `1px solid color-mix(in srgb, ${accentColor} 15%, transparent)`,
                            }}>
                            <MousePointerClick size={12} />
                            {step.actionHint}
                        </div>
                    )}
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
                    <div className="flex items-center gap-1">
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                className="transition-all duration-300"
                                style={{
                                    width: i === currentStep ? 18 : 6,
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
                                className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all hover:bg-app-border/30"
                                style={{ color: 'var(--app-muted-foreground)' }}
                            >
                                <ChevronLeft size={12} /> Back
                            </button>
                        )}
                        {isFirst && (
                            <button
                                onClick={completeTour}
                                className="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all hover:bg-app-border/30"
                                style={{ color: 'var(--app-muted-foreground)' }}
                            >
                                <SkipForward size={10} /> Skip
                            </button>
                        )}
                        {/* For 'click' steps, hide Next (user must click target). For others, show Next/Finish */}
                        {!isClickStep && (
                            <button
                                onClick={next}
                                className="flex items-center gap-1 text-[10px] font-bold px-3.5 py-1.5 rounded-lg text-white transition-all hover:brightness-110"
                                style={{
                                    background: accentColor,
                                    boxShadow: `0 2px 8px color-mix(in srgb, ${accentColor} 30%, transparent)`,
                                }}
                            >
                                {isLast ? (
                                    <><CheckCircle2 size={12} /> Got it!</>
                                ) : (
                                    <>Next <ChevronRight size={12} /></>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

/* ═══════════════════════════════════════════════════════════
 *  TOUR TRIGGER BUTTON — reusable sparkle button
 * ═══════════════════════════════════════════════════════════ */
export function TourTriggerButton({ onClick, label = 'Tour' }: { onClick: () => void; label?: string }) {
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
