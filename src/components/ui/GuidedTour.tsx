'use client'

/* ═══════════════════════════════════════════════════════════
 *  TSFSYSTEM — GuidedTour — Lightweight Tour Renderer
 *  Performance-first: uses CSS box-shadow spotlight instead
 *  of SVG masks. No backdrop-filter blur. GPU-composited.
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
    tourId: string
    autoStart?: boolean
    autoStartDelay?: number
    stepActions?: StepActions
    onComplete?: () => void
}) {
    const { activeTourId, startTour, dismissTour } = useTourContext()
    const [currentStep, setCurrentStep] = useState(0)
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
    const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
    const [actionExecuted, setActionExecuted] = useState(false)
    const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
    const tooltipRef = useRef<HTMLDivElement>(null)
    const clickListenerRef = useRef<(() => void) | null>(null)

    // Track mobile viewport — bottom sheet layout kicks in below 768 px
    useEffect(() => {
        const handler = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handler)
        window.addEventListener('orientationchange', handler)
        return () => {
            window.removeEventListener('resize', handler)
            window.removeEventListener('orientationchange', handler)
        }
    }, [])

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
            }, 250)
            return () => clearTimeout(timer)
        }
    }, [isActive, currentStep, behavior, stepActions, step, actionExecuted])

    // Set up click listener for 'click' behavior steps
    useEffect(() => {
        if (clickListenerRef.current) {
            clickListenerRef.current()
            clickListenerRef.current = null
        }

        if (!isActive || !step || behavior !== 'click' || !step.target) return

        const handler = async () => {
            if (stepActions[currentStep]) {
                await stepActions[currentStep]()
            }
            setTimeout(() => {
                if (isLast) {
                    completeTour()
                } else {
                    setCurrentStep(s => s + 1)
                    setActionExecuted(false)
                }
            }, step.actionDelay ?? 400)
        }

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

    // Position highlight + tooltip — with retry for dynamically created elements
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
        // Retry a few times for dynamically-created elements
        const t1 = setTimeout(positionTooltip, 150)
        const t2 = setTimeout(positionTooltip, 600)
        // Auto-skip steps whose target never resolves — lets the same tour
        // definition work on mobile + desktop even when some elements are
        // desktop-only (split panel, focus mode button, etc.)
        const t3 = setTimeout(() => {
            if (!step || step.isWelcome || !step.target) return
            const el = document.querySelector(step.target)
            if (el) return
            if (currentStep >= steps.length - 1) {
                completeTour()
            } else {
                setCurrentStep(s => s + 1)
                setActionExecuted(false)
            }
        }, 1400)
        window.addEventListener('resize', positionTooltip)
        window.addEventListener('scroll', positionTooltip, true)
        return () => {
            clearTimeout(t1); clearTimeout(t2); clearTimeout(t3)
            window.removeEventListener('resize', positionTooltip)
            window.removeEventListener('scroll', positionTooltip, true)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // CTA color — always primary so the Next / "Got it!" button is readable
    // regardless of what accentColor a step picks. (Light/muted accents make
    // white-on-accent buttons invisible; see past issues on COA + Posting Rules.)
    const ctaColor = 'var(--app-primary)'
    const isClickStep = behavior === 'click'

    /* ─── Spotlight geometry (for box-shadow approach) ─── */
    const spotlightStyle = targetRect ? {
        position: 'fixed' as const,
        left: targetRect.left - 8,
        top: targetRect.top - 8,
        width: targetRect.width + 16,
        height: targetRect.height + 16,
        borderRadius: 14,
        // The magic: a huge box-shadow acts as the overlay dimming
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
        transition: 'left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease',
        pointerEvents: 'none' as const,
        zIndex: 10000,
    } : null

    return (
        <div className="fixed inset-0 z-[10000]" style={{ opacity: 1 }}>
            {/* ── Overlay ── */}
            {isCentered ? (
                /* Centered modal: simple dark overlay, NO blur */
                <div
                    className="absolute inset-0"
                    style={{ background: 'rgba(0,0,0,0.5)' }}
                    onClick={completeTour}
                />
            ) : (
                <>
                    {/* Spotlight overlay via box-shadow — single div, GPU-composited */}
                    {spotlightStyle && <div style={spotlightStyle} />}

                    {/* Accent ring around target */}
                    {targetRect && (
                        <div
                            className="pointer-events-none"
                            style={{
                                position: 'fixed',
                                left: targetRect.left - 8, top: targetRect.top - 8,
                                width: targetRect.width + 16, height: targetRect.height + 16,
                                borderRadius: 14,
                                border: `2px solid ${accentColor}`,
                                boxShadow: `0 0 16px color-mix(in srgb, ${accentColor} 25%, transparent)`,
                                transition: 'left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease',
                                zIndex: 10000,
                            }}
                        />
                    )}

                    {/* Click-through: for 'click' steps, make the target clickable */}
                    {isClickStep && targetRect && (
                        <div className="absolute inset-0" style={{ pointerEvents: 'auto', zIndex: 9999 }} onClick={e => e.stopPropagation()} />
                    )}

                    {/* For non-click steps, block all interaction */}
                    {!isClickStep && (
                        <div className="absolute inset-0" style={{ zIndex: 9999 }} onClick={completeTour} />
                    )}
                </>
            )}

            {/* ── Click pulse indicator for 'click' steps ── */}
            {isClickStep && targetRect && (
                <div
                    className="pointer-events-none flex items-center justify-center"
                    style={{
                        position: 'fixed',
                        left: targetRect.left + targetRect.width / 2 - 14,
                        top: targetRect.top + targetRect.height / 2 - 14,
                        width: 28, height: 28,
                        zIndex: 10001,
                    }}
                >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{
                            background: accentColor,
                            boxShadow: `0 2px 10px color-mix(in srgb, ${accentColor} 40%, transparent)`,
                            animation: 'bounce 1s infinite',
                        }}>
                        <MousePointerClick size={12} className="text-white" />
                    </div>
                </div>
            )}

            {/* ── Tooltip Card (floating on desktop, bottom sheet on mobile) ── */}
            <div
                ref={tooltipRef}
                className={
                    isMobile && !isCentered
                        ? 'fixed left-3 right-3 bottom-3'
                        : isCentered
                            ? 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
                            : 'fixed'
                }
                style={{
                    ...(isMobile && !isCentered
                        ? { maxWidth: '100%' }
                        : !isCentered
                            ? { top: tooltipPos.top, left: tooltipPos.left, width: 360, maxWidth: 'calc(100vw - 32px)' }
                            : { width: 360, maxWidth: 'calc(100vw - 32px)' }),
                    borderRadius: isMobile && !isCentered ? 20 : 16,
                    overflow: 'hidden',
                    background: 'var(--app-surface)',
                    border: '1px solid var(--app-border)',
                    boxShadow: isMobile && !isCentered
                        ? '0 -8px 32px rgba(0,0,0,0.35)'
                        : '0 16px 48px rgba(0,0,0,0.25)',
                    zIndex: 10002,
                    transition: !isCentered && !isMobile ? 'top 0.3s ease, left 0.3s ease' : undefined,
                }}
                onClick={e => e.stopPropagation()}
            >
                {/* Progress bar */}
                <div style={{ height: 3, width: '100%', background: 'color-mix(in srgb, var(--app-border) 30%, transparent)' }}>
                    <div
                        style={{
                            height: '100%',
                            width: `${progress}%`,
                            background: accentColor,
                            transition: 'width 0.4s ease',
                        }}
                    />
                </div>

                {/* Header */}
                <div style={{ padding: '12px 16px 4px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div
                        style={{
                            width: 36, height: 36, borderRadius: 10,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0, marginTop: 2,
                            background: `color-mix(in srgb, ${accentColor} 12%, transparent)`,
                            color: accentColor,
                            border: `1px solid color-mix(in srgb, ${accentColor} 18%, transparent)`,
                        }}
                    >
                        {step.icon || <Sparkles size={16} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <h3 style={{
                                fontSize: 14, fontWeight: 900,
                                color: 'var(--app-foreground)',
                                letterSpacing: '-0.01em',
                                lineHeight: 1.25, margin: 0,
                            }}>
                                {step.title}
                            </h3>
                            <button
                                onClick={completeTour}
                                style={{
                                    width: 24, height: 24, borderRadius: 8,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--app-muted-foreground)',
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                    flexShrink: 0,
                                }}
                                title="Close tour (Esc)"
                            >
                                <X size={13} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                            <span style={{
                                fontSize: 9, fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.08em',
                                color: accentColor,
                            }}>
                                Step {currentStep + 1} of {steps.length}
                            </span>
                            {isClickStep && (
                                <span style={{
                                    fontSize: 8, fontWeight: 900,
                                    textTransform: 'uppercase', letterSpacing: '0.08em',
                                    padding: '2px 6px', borderRadius: 6,
                                    background: `color-mix(in srgb, ${accentColor} 10%, transparent)`,
                                    color: accentColor,
                                }}>
                                    ⬆ Click to continue
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '4px 16px 12px' }}>
                    <p style={{
                        fontSize: 12, lineHeight: 1.6, fontWeight: 500,
                        color: 'var(--app-muted-foreground)', margin: 0,
                    }}>
                        {step.description}
                    </p>
                    {step.actionHint && (
                        <div style={{
                            marginTop: 8, display: 'flex', alignItems: 'center', gap: 8,
                            fontSize: 11, fontWeight: 700, padding: '6px 10px', borderRadius: 8,
                            background: `color-mix(in srgb, ${accentColor} 6%, transparent)`,
                            color: accentColor,
                            border: `1px solid color-mix(in srgb, ${accentColor} 12%, transparent)`,
                        }}>
                            <MousePointerClick size={11} />
                            {step.actionHint}
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <div style={{
                    padding: '8px 16px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'color-mix(in srgb, var(--app-background) 50%, transparent)',
                    borderTop: '1px solid color-mix(in srgb, var(--app-border) 30%, transparent)',
                }}>
                    {/* Step dots */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        {steps.map((_, i) => (
                            <div
                                key={i}
                                style={{
                                    width: i === currentStep ? 16 : 5,
                                    height: 5,
                                    borderRadius: 3,
                                    background: i === currentStep
                                        ? accentColor
                                        : i < currentStep
                                            ? `color-mix(in srgb, ${accentColor} 35%, transparent)`
                                            : 'color-mix(in srgb, var(--app-border) 50%, transparent)',
                                    transition: 'width 0.25s ease, background 0.25s ease',
                                }}
                            />
                        ))}
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {!isFirst && (
                            <button
                                onClick={prev}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: 8,
                                    color: 'var(--app-muted-foreground)',
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                }}
                            >
                                <ChevronLeft size={12} /> Back
                            </button>
                        )}
                        {isFirst && (
                            <button
                                onClick={completeTour}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: 8,
                                    color: 'var(--app-muted-foreground)',
                                    background: 'transparent', border: 'none', cursor: 'pointer',
                                }}
                            >
                                <SkipForward size={10} /> Skip
                            </button>
                        )}
                        {!isClickStep && (
                            <button
                                onClick={next}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 4,
                                    fontSize: 10, fontWeight: 700, padding: '5px 14px', borderRadius: 8,
                                    color: '#fff', cursor: 'pointer',
                                    background: ctaColor, border: 'none',
                                    boxShadow: `0 2px 8px color-mix(in srgb, ${ctaColor} 30%, transparent)`,
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
