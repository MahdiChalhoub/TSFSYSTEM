import { Suspense } from 'react';
import { headers } from 'next/headers';
import { Loader2 } from 'lucide-react';
import { LoginContent } from './LoginContent';

// Server component — reads hostname from request headers so SSR renders
// the correct form immediately (no client-side flash from workspace → login).
export default async function LoginPage() {
    const headerList = await headers();
    const host = headerList.get('host') || '';
    const hostname = host.split(':')[0].toLowerCase();
    const parts = hostname.split('.');

    let initialSubdomain = '';
    const isIp = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(hostname);

    if (!isIp) {
        if (hostname.includes('localhost')) {
            if (parts.length > 1) initialSubdomain = parts[0];
        } else {
            if (parts.length > 2) initialSubdomain = parts[0];
        }
    }

    return (
        <Suspense fallback={
            <div className="min-h-screen bg-app-bg flex items-center justify-center">
                <Loader2 className="animate-spin text-app-foreground" />
            </div>
        }>
            <LoginContent initialSubdomain={initialSubdomain} />
        </Suspense>
    );
}
