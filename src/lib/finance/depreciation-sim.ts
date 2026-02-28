'use client'

export type ProjectedPoint = {
    period: number
    bookValue: number
    depreciation: number
}

export function simulateDepreciation(
    method: string,
    cost: number,
    life: number,
    residual: number = 0,
    totalCapacity?: number
): ProjectedPoint[] {
    const points: ProjectedPoint[] = []
    let currentBookValue = cost
    const salvageValue = residual || 0

    // Linear Math
    if (method === 'LINEAR') {
        const annualDep = (cost - salvageValue) / life
        for (let i = 0; i <= life; i++) {
            points.push({
                period: i,
                bookValue: Math.max(salvageValue, cost - (annualDep * i)),
                depreciation: i === 0 ? 0 : annualDep
            })
        }
    }

    // Double Declining (200% DB)
    else if (method === 'DOUBLE_DECLINING' || method === 'DECLINING') {
        const factor = method === 'DOUBLE_DECLINING' ? 2 : 1.5
        const rate = (1 / life) * factor
        points.push({ period: 0, bookValue: cost, depreciation: 0 })

        for (let i = 1; i <= life; i++) {
            let dep = currentBookValue * rate
            // Adjust to not go below salvage
            if (currentBookValue - dep < salvageValue) {
                dep = currentBookValue - salvageValue
            }
            currentBookValue -= dep
            points.push({
                period: i,
                bookValue: currentBookValue,
                depreciation: dep
            })
        }
    }

    // Units of Production (Simulation assumes equal distribution)
    else if (method === 'PRODUCTION') {
        const totalCap = totalCapacity || 100
        const depPerUnit = (cost - salvageValue) / totalCap
        const annualProduction = totalCap / life

        points.push({ period: 0, bookValue: cost, depreciation: 0 })
        for (let i = 1; i <= life; i++) {
            const annualDep = depPerUnit * annualProduction
            currentBookValue -= annualDep
            points.push({
                period: i,
                bookValue: Math.max(salvageValue, currentBookValue),
                depreciation: annualDep
            })
        }
    }

    return points
}
