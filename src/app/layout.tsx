import type { Metadata } from "next";
import { Outfit } from 'next/font/google';
import "./globals.css";

const outfit = Outfit({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: "TSF Global System",
    description: "Multi-Tenant Enterprise OS",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark scroll-smooth" suppressHydrationWarning data-scroll-behavior="smooth">
            <body className={outfit.className}>
                {children}
            </body>
        </html>
    );
}
