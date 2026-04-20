'use client'

/* ═══════════════════════════════════════════════════════════
 *  PageTour — one-line tour integration for any page.
 *
 *  Bundles the ✨ trigger button and the <GuidedTour> overlay
 *  renderer into a single component. Modify this file to tweak
 *  the tour UX globally.
 *
 *  Usage — standalone page (renders button + overlay):
 *    import '@/lib/tours/definitions/my-page'
 *    <PageTour tourId="my-page" stepActions={stepActions} />
 *
 *  Usage — inside a template that already renders its own
 *  TourTriggerButton (e.g. TreeMasterPage). Only mount the
 *  renderer:
 *    <PageTour tourId="my-page" renderButton={false} stepActions={...} />
 * ═══════════════════════════════════════════════════════════ */

import { GuidedTour, TourTriggerButton } from './GuidedTour'
import { usePageTour } from '@/lib/tours/useTour'
import type { StepActions } from '@/lib/tours/types'

export interface PageTourProps {
    tourId: string
    stepActions?: StepActions
    renderButton?: boolean
    buttonLabel?: string
    autoStart?: boolean
    autoStartDelay?: number
    onComplete?: () => void
}

export function PageTour({
    tourId,
    stepActions,
    renderButton = true,
    buttonLabel,
    autoStart = true,
    autoStartDelay,
    onComplete,
}: PageTourProps) {
    const { start, currentTour } = usePageTour(tourId)
    // If the tour isn't registered, render nothing — avoids dead buttons.
    if (!currentTour) return null
    return (
        <>
            {renderButton && <TourTriggerButton onClick={start} label={buttonLabel} />}
            <GuidedTour
                tourId={tourId}
                stepActions={stepActions}
                autoStart={autoStart}
                autoStartDelay={autoStartDelay}
                onComplete={onComplete}
            />
        </>
    )
}
