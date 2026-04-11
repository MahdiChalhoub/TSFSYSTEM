/**
 * Calculate config health score based on field analysis.
 * Returns 0-100 score with category breakdown.
 */
export interface HealthCategory {
    name: string;
    score: number;
    weight: number;
    issues: string[];
}

export function calculateHealthScore(
    config: Record<string, any>,
    rules: Array<{
        field: string;
        category: string;
        weight: number;
        check: (value: any) => { score: number; issue?: string };
    }>
): { total: number; categories: HealthCategory[] } {
    const categoryMap = new Map<string, HealthCategory>();

    for (const rule of rules) {
        const value = config[rule.field];
        const result = rule.check(value);

        if (!categoryMap.has(rule.category)) {
            categoryMap.set(rule.category, { name: rule.category, score: 0, weight: 0, issues: [] });
        }

        const cat = categoryMap.get(rule.category)!;
        cat.score += result.score * rule.weight;
        cat.weight += rule.weight;
        if (result.issue) cat.issues.push(result.issue);
    }

    let totalScore = 0;
    let totalWeight = 0;
    const categories: HealthCategory[] = [];

    for (const cat of categoryMap.values()) {
        const normalized = cat.weight > 0 ? Math.round(cat.score / cat.weight) : 0;
        categories.push({ ...cat, score: normalized });
        totalScore += cat.score;
        totalWeight += cat.weight;
    }

    return {
        total: totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0,
        categories,
    };
}
