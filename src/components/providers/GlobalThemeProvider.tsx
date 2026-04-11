// @ts-nocheck
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useEffect, useState } from "react";

export function GlobalThemeProvider({ children }: { children: React.ReactNode }) {
 const [mounted, setMounted] = useState(false);

 useEffect(() => {
 setMounted(true);
 }, []);

 if (!mounted) {
 return <div style={{ visibility: "hidden" }}>{children}</div>;
 }

 return (
 <NextThemesProvider
 attribute="data-theme"
 defaultTheme="apple"
 themes={['light', 'dark', 'apple']}
 enableSystem={false}
 disableTransitionOnChange
 >
 {children}
 </NextThemesProvider>
 );
}
