import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { Outfit } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'] });

export default async function SaasRootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // 1. Strict Authentication Check
    const user = await getUser();

    // 2. Privilege Check (Only True Superusers can access the Kernel Channel)
    if (!user || (!user.is_superuser && !user.is_staff)) {
        console.warn(`[SECURITY] Blocked non-privileged access to Kernel Channel: ${user?.username || 'Guest'}`);
        redirect('/login?error=kernel_access_denied');
    }

    return (
        <div className={`min-h-screen bg-[#020617] font-sans text-gray-200 ${outfit.className}`}>
            {children}
        </div>
    );
}