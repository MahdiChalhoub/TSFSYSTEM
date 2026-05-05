import { Loader2 } from 'lucide-react'

/* Route-level loading boundary — Next.js shows this *immediately* on
 * click, replacing the previous page (the list) until our client
 * component mounts and starts streaming. Without this, the user
 * perceives a "click did nothing → click again" hesitation because
 * Next keeps the old page on screen during the soft navigation.
 *
 * Shape mirrors design-language §10. */
export default function Loading() {
    return (
        <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--app-primary)' }} />
        </div>
    )
}
