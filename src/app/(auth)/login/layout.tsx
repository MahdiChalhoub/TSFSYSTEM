import type { Metadata } from "next";
import { PLATFORM_CONFIG } from "@/lib/branding";

export const metadata: Metadata = {
    title: `${PLATFORM_CONFIG.name} | Sign In`,
    description: `Secure entry into the ${PLATFORM_CONFIG.name} ecosystem.`,
};

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {children}
        </>
    );
}
