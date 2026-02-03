'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

// Original schema
const LoginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
})

// Schema for root login (requires slug)
const RootLoginSchema = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
    slug: z.string().optional() // Optional because tenant login doesn't need it
})

export async function loginAction(prevState: any, formData: FormData) {
    const data = Object.fromEntries(formData.entries())

    // Check if we are validating with slug or without
    // If we are on root (determined by frontend state or hidden field?), we need slug.
    // However, simplest is to check if 'slug' key exists in formData and is not empty

    // Actually, handling redirection:
    // If slug is provided, we should redirect the user to the tenant login page
    // So they can login there (ensures cookies are set on correct subdomain).
    // OR, if the user expects "Single Sign On" feel, we login against backend and get token.
    // Backend supports Host header tenant resolution.
    // If we are on localhost:3000, we can't easily set a cookie for sub.localhost:3000 
    // unless domain is .localhost (which is tricky on some browsers/local setup).

    // SAFE APPROACH: If slug provided, redirect to that tenant's login page with username prefilled?
    // User asked: "add name of business to be able to log in"
    // He implies doing it in one step.

    // Let's try "Smart Login":
    // 1. If slug is present: 
    //    - Verify slug exists (optional call to config or just redirect)
    //    - Redirect to `http://${slug}.localhost:3000/login`
    //    - Maybe pass `?username=...` for convenience?
    //    - RETURN "Redirecting..." to frontend.

    if (data.slug && data.slug.toString().trim() !== '') {
        const slug = data.slug.toString().trim();
        // Force redirect to tenant domain
        // In prod: slug.tsfcloud.com
        // In local: slug.localhost:3000

        // We need to know if we are local or prod to construct URL.
        const headerStore = await import('next/headers');
        const headersList = await headerStore.headers();
        const host = headersList.get('host') || "";

        let protocol = "http";
        if (headersList.get('x-forwarded-proto') === 'https' || host.includes('vercel.app')) {
            protocol = "https";
        }

        // Construct new host
        let newHost = "";
        if (host.includes('localhost')) {
            newHost = `${slug}.localhost:3000`;
        } else {
            // Assume prod is *.domain.com
            // If current host is `app.domain.com`, replace `app`? 
            // Or if root `domain.com`, prepend slug.
            // Simplest: `slug.tsfcloud.com` if we hardcode or env var.
            const baseDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "tsfcloud.com";
            newHost = `${slug}.${baseDomain}`;
        }

        redirect(`${protocol}://${newHost}/login?u=${btoa(data.username as string)}`);
        return; // Unreachable
    }

    // Normal Login (Tenant Context detected or ignored)
    const validated = LoginSchema.safeParse(data)

    if (!validated.success) {
        return { error: validated.error.flatten().fieldErrors }
    }

    const { username, password } = validated.data
    const { erpFetch } = await import("@/lib/erp-api")

    try {
        const responseData = await erpFetch('auth/login/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                password,
                site_id: data.site_id
            }),
        })

        const token = responseData.token
        const cookieStore = await cookies()
        cookieStore.set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 30, // 30 minutes session for security
        })

    } catch (error: any) {
        console.error('Login Tactical Error:', error)
        let message = 'Vantage Uplink Failure'
        try {
            const errData = JSON.parse(error.message)
            if (errData.non_field_errors) message = errData.non_field_errors[0]
            else if (errData.detail) message = errData.detail
            else if (errData.error) message = errData.error
        } catch (e) {
            message = error.message || 'Service unavailable'
        }
        return { error: { root: [message] } }
    }

    redirect('/admin')
}

export async function logoutAction() {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth_token')?.value
    const djangoUrl = process.env.DJANGO_URL || 'http://localhost:8000'

    if (token) {
        try {
            await fetch(`${djangoUrl}/api/auth/logout/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Token ${token}`
                },
            })
        } catch (e) { }
    }

    cookieStore.delete('auth_token')
    redirect('/login')
}

export async function getUser() {
    const { erpFetch } = await import("@/lib/erp-api")
    try {
        const user = await erpFetch('auth/me/')
        return user
    } catch (error) {
        return null
    }
}
