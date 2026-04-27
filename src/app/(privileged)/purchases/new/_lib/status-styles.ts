export type StatusKey = 'LOW' | 'OPTIONAL' | 'URGENT'

export const STATUS_STYLE: Record<StatusKey, { bg: string; text: string; border: string }> = {
    LOW: {
        bg: 'color-mix(in srgb, var(--app-warning) 10%, transparent)',
        text: 'var(--app-warning)',
        border: 'color-mix(in srgb, var(--app-warning) 25%, transparent)',
    },
    URGENT: {
        bg: 'color-mix(in srgb, var(--app-error) 10%, transparent)',
        text: 'var(--app-error)',
        border: 'color-mix(in srgb, var(--app-error) 25%, transparent)',
    },
    OPTIONAL: {
        bg: 'color-mix(in srgb, var(--app-info) 10%, transparent)',
        text: 'var(--app-info)',
        border: 'color-mix(in srgb, var(--app-info) 25%, transparent)',
    },
}

export const getStatusStyle = (status?: string) => STATUS_STYLE[(status as StatusKey) || 'OPTIONAL'] || STATUS_STYLE.OPTIONAL
