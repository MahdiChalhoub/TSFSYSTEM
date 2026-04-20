import type { WizardFormData } from '../_components/WizardModal'

/**
 * Compute smart wizard defaults based on existing fiscal years.
 * Detects gaps in coverage and suggests the right start/end dates.
 * Pure function — no side effects.
 */
export function computeWizardDefaults(years: Record<string, any>[]): Partial<WizardFormData> {
    const sorted = [...years].sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
    const today = new Date()
    let todayHasOpenPeriod = false
    let gapStart: Date | null = null
    let gapEnd: Date | null = null

    for (const y of sorted) {
        for (const p of (y.periods || [])) {
            const s = new Date(p.start_date), e = new Date(p.end_date)
            if (today >= s && today <= e && (p.status || 'OPEN') === 'OPEN' && !y.isHardLocked) {
                todayHasOpenPeriod = true
            }
        }
    }

    if (!todayHasOpenPeriod) {
        for (const y of sorted) {
            if (!y.isHardLocked) continue
            const yEnd = new Date(y.endDate), yStart = new Date(y.startDate)
            if (yEnd >= today || yStart <= today) {
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
                gapStart = firstDay
                gapEnd = yEnd.getMonth() === 11 && yEnd.getDate() === 31 ? yEnd : new Date(yEnd.getFullYear(), 11, 31)
                for (const otherY of sorted) {
                    if (otherY.isHardLocked || otherY.id === y.id) continue
                    const otherStart = new Date(otherY.startDate)
                    if (otherStart > gapStart && otherStart <= gapEnd) {
                        gapEnd = new Date(otherStart.getTime() - 86400000)
                    }
                }
                break
            }
        }
    }

    if (gapStart && gapEnd) {
        const startMonth = gapStart.toLocaleDateString('en', { month: 'short' })
        const endMonth = gapEnd.toLocaleDateString('en', { month: 'short' })
        const name = gapStart.getFullYear() === gapEnd.getFullYear()
            ? `FY ${gapStart.getFullYear()} (${startMonth}-${endMonth})`
            : `FY ${gapStart.getFullYear()}-${gapEnd.getFullYear()}`
        return { name, startDate: gapStart.toISOString().split('T')[0], endDate: gapEnd.toISOString().split('T')[0] }
    }

    // No gap — suggest next year after the latest
    const latest = [...years].sort((a, b) => (b.endDate || '').localeCompare(a.endDate || ''))[0]
    if (latest) {
        const ns = new Date(latest.endDate); ns.setDate(ns.getDate() + 1)
        const ne = new Date(ns); ne.setFullYear(ne.getFullYear() + 1); ne.setDate(ne.getDate() - 1)
        return { name: `FY ${ns.getFullYear()}`, startDate: ns.toISOString().split('T')[0], endDate: ne.toISOString().split('T')[0] }
    }

    return {}
}
