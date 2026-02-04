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
        redirect('/admin?error=unauthorized_saas_access');
    }

    return (
        <div className="bg-[#020617] min-h-full">
            <div className="p-4 md:p-8 max-w-[1800px] mx-auto">
                {children}
            </div>
        </div>
    );
}
