import type { Metadata } from "next";
import { Outfit } from 'next/font/google';
import "./globals.css";

const outfit = Outfit({ subsets: ['latin'] });

import { PLATFORM_CONFIG } from "@/lib/branding";

export const metadata: Metadata = {
    title: `${PLATFORM_CONFIG.name} | Global System`,
    description: "Multi-Tenant Enterprise OS",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="scroll-smooth" suppressHydrationWarning data-scroll-behavior="smooth">
            <head>
                <link rel="manifest" href="/manifest.json" />
                <meta name="theme-color" content="#6366f1" />
            </head>
            <body className={outfit.className}>
                {children}
                <script dangerouslySetInnerHTML={{
                    __html: `
                    if ('serviceWorker' in navigator) {
                        window.addEventListener('load', function() {
                            navigator.serviceWorker.register('/sw.js').then(function(reg) {
                                console.log('[SW] Registered:', reg.scope);
                            }).catch(function(err) {
                                console.warn('[SW] Registration failed:', err);
                            });
                        });
                    }
                `}} />
            </body>
        </html>
    );
}
