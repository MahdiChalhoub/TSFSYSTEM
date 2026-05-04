'use server'

import { erpFetch, handleAuthError } from "@/lib/erp-api"

export async function getUsers() {
    try {
        const data = await erpFetch('users/')
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch (error) {
        handleAuthError(error)
        return []
    }
}

/**
 * Users who can be assigned to follow a record in the given module.
 * Backend filter: role permission codes starting with `<module>.`,
 * staff, or superusers (see UserViewSet.get_queryset:can_assign).
 *
 * Use this for the Assignee dropdown on POs / sales orders / etc. so
 * the operator picks from "people who'd actually own this work" instead
 * of every user in the org (cashiers, drivers, supplier portal users…).
 */
export async function getAssignableUsers(module: 'purchase' | 'sales') {
    try {
        const data = await erpFetch(`users/?can_assign=${encodeURIComponent(module)}`)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch (error) {
        handleAuthError(error)
        return []
    }
}

/**
 * Drivers available to a given module. A user is a driver iff they own
 * a `Driver` row (OneToOneField); the module flag (`available_for_purchase`
 * / `available_for_sales`) gates per-module visibility once the migration
 * lands. Backend falls back to "any driver" if the flag column doesn't
 * exist yet, so this is safe to call before/after the migration.
 */
export async function getDrivers(module: 'purchase' | 'sales') {
    try {
        const data = await erpFetch(`users/?driver_for=${encodeURIComponent(module)}`)
        return Array.isArray(data) ? data : (data?.results ?? [])
    } catch (error) {
        handleAuthError(error)
        return []
    }
}
