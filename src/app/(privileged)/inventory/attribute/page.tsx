import { redirect } from 'next/navigation'

/**
 * Singular `/inventory/attribute` is a common typo for the plural
 * route `/inventory/attributes`. Without this stub the request falls
 * through to the catch-all "Module Page Under Construction" page.
 * Permanent (308) redirect so browsers cache the rewrite.
 */
export default function AttributeSingularRedirect() {
    redirect('/inventory/attributes')
}
