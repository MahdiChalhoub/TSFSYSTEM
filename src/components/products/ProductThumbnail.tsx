'use client'

/**
 * ProductThumbnail — image (when present) or Lucide icon fallback.
 *
 * Why it exists:
 *   - Image rendering must NEVER block list scroll. Browsers handle this if
 *     we set `loading="lazy"` + a fixed box; we just need a single component
 *     that does it consistently for list rows, hero cards, and detail panels.
 *   - The Product table stores `image` as a string (URL or relative path).
 *     This component handles both: bare `/media/...` paths get prefixed by
 *     the configured backend origin; full URLs pass through.
 *   - `onError` swaps to the icon fallback so a broken image never leaves a
 *     visual hole.
 */
import { useState } from 'react'
import { Box, Layers, Package } from 'lucide-react'

type IconComponent = typeof Box

const FALLBACK_ICONS: Record<string, IconComponent> = {
    COMBO: Layers,
    STOCKABLE: Box,
    SERVICE: Package,
}

interface Props {
    image?: string | null
    productType?: string | null
    name?: string | null
    /** Pixel size of the (square) box. Default 28 for list rows. */
    size?: number
    /** Tailwind classes on the outer wrapper (rounded, ring, etc.). */
    className?: string
    /** Optional background tint when no image; also used for the icon color. */
    color?: string
    /** Lucide icon size; defaults to ~half the wrapper. */
    iconSize?: number
}

export function ProductThumbnail({
    image, productType, name, size = 28, className = '', color = 'var(--app-muted-foreground)', iconSize,
}: Props) {
    // Track load failure so a broken URL falls back to the icon — better than
    // showing a browser's broken-image glyph forever.
    const [errored, setErrored] = useState(false)
    const FallbackIcon = FALLBACK_ICONS[productType || ''] || Package
    const px = `${size}px`
    const finalIconSize = iconSize ?? Math.round(size * 0.5)

    const showImage = !!image && !errored

    return (
        <div
            className={`flex items-center justify-center flex-shrink-0 overflow-hidden ${className}`}
            style={{
                width: px, height: px,
                background: showImage ? 'var(--app-bg)' : `color-mix(in srgb, ${color} 12%, transparent)`,
                color,
            }}
        >
            {showImage ? (
                <img
                    src={resolveImageUrl(image!)}
                    alt={name || 'product'}
                    loading="lazy"
                    decoding="async"
                    onError={() => setErrored(true)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
            ) : (
                <FallbackIcon size={finalIconSize} />
            )}
        </div>
    )
}

/**
 * Resolve a stored image string to a usable URL.
 *   - "https://…" → passthrough
 *   - "/media/…"  → prefix with the configured backend origin if the app and
 *      backend are on different hosts (otherwise leave relative).
 *   - "…"         → leave as-is; whoever set it must have written a complete value.
 */
function resolveImageUrl(image: string): string {
    if (/^https?:\/\//i.test(image)) return image
    if (image.startsWith('/')) {
        // The frontend proxy at /api/erp/proxy already forwards to the backend
        // for API calls; for /media/* we prefer NEXT_PUBLIC_BACKEND_URL when set.
        const backend = process.env.NEXT_PUBLIC_BACKEND_URL
        if (backend && image.startsWith('/media/')) {
            return `${backend.replace(/\/$/, '')}${image}`
        }
        return image
    }
    return image
}
