"use server"

import { createOrganization } from "../../admin/saas/organizations/actions"

export async function registerBusiness(data: { name: string, slug: string }) {
    // This is a wrapper around the admin action to allow public registration
    return await createOrganization(data)
}
