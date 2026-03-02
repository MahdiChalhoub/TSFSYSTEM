"use client";

import { useTheme } from "next-themes";
import { Monitor, Apple, Moon } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle() {
 const { theme, setTheme, resolvedTheme } = useTheme();
 const [mounted, setMounted] = useState(false);

 useEffect(() => setMounted(true), []);

 if (!mounted) return null;

 const currentTheme = theme === 'system' ? resolvedTheme : theme;

 const toggleTheme = () => {
 if (currentTheme === 'light') setTheme('apple');
 else if (currentTheme === 'apple') setTheme('dark');
 else setTheme('light');
 };

 return (
 <button
 onClick={toggleTheme}
 className="flex items-center justify-center w-10 h-10 rounded-[1rem] bg-white/50 backdrop-blur-3xl border border-gray-200/50 shadow-sm hover:scale-110 hover:bg-white/80 active:scale-90 transition-all outline-none"
 title={`Switch Theme (Current: ${currentTheme})`}
 >
 {currentTheme === 'light' && <Monitor size={18} className="text-emerald-600 transition-all duration-300" />}
 {currentTheme === 'apple' && <Apple size={18} className="text-purple-600 drop-shadow-sm transition-all duration-300 scale-110" />}
 {currentTheme === 'dark' && <Moon size={18} className="text-app-text transition-all duration-300" />}
 </button>
 );
}
