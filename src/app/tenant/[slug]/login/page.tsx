'use client'

import { useTheme } from '@/storefront/engine/ThemeProvider'

export default function LoginPageRoute() {
 const { components, loading } = useTheme()

 if (loading || !components) {
 return (
 <div className="min-h-screen bg-app-bg flex items-center justify-center">
 <div className="w-8 h-8 border-2 border-app-primary border-t-transparent rounded-full animate-spin" />
 </div>
 )
 }

 const LoginPage = components.LoginPage
 if (!LoginPage) return <div className="p-20 text-app-text text-center">Login component not implemented in this theme.</div>

 return <LoginPage />
}
