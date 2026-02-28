/**
 * Core currency formatting logic.
 * Safe for both Server and Client components.
 */

export function formatCurrency(value: number, currency = 'XOF', locale = 'fr-FR'): string {
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(value)
    } catch {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'XOF',
            maximumFractionDigits: 0,
        }).format(value)
    }
}
