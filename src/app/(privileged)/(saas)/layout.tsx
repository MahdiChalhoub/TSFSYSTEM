import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";

export default async function SaasLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // 1. Double-Check Authentication & Authorization
    const user = await getUser();

    // 2. Strict Superuser Gate
    // Just being in the "SaaS" organization is NOT enough.
    // You must be a system-level Superuser.
    if (!user || !user.is_superuser) {
        console.warn(`[SECURITY] Unauthorized access attempt to SaaS Panel by ${user?.username || 'Guest'}`);
        redirect('/login?error=unauthorized_saas_access');
    }

    // Match the finance/inventory pattern: no padding here, no max-width.
    // Pages own their own layout (TreeMasterPage handles its own spacing).
    // The previous wrapper forced p-4..p-8 + max-w-[1800px] which double-
    // padded master-page screens (Countries) and wasted horizontal space.
    return <>{children}</>;
}
