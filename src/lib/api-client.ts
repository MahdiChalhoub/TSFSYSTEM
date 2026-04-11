/**
 * API Client Utility
 * ===================
 * Centralized fetch wrapper with authentication and error handling
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://saas.tsf.ci/api'

/**
 * Helper to get auth token from cookies/localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  // Try localStorage first (common pattern in TSF)
  return localStorage.getItem('auth_token') || localStorage.getItem('access_token')
}

/**
 * Authenticated fetch with proper headers and error handling
 */
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getAuthToken()

  // Build full URL if relative
  const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  // Only add Content-Type if not explicitly set (for FormData uploads)
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(fullUrl, {
    ...options,
    headers,
    credentials: 'include', // Include cookies
  })

  return response
}

/**
 * Authenticated fetch that automatically parses JSON and throws on error
 */
export async function fetchWithAuthJSON<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetchWithAuth(url, options)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: `HTTP ${response.status}: ${response.statusText}`,
    }))
    throw new Error(errorData.message || errorData.detail || 'API request failed')
  }

  return response.json()
}
