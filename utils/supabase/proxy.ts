import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const AUTH_TIMEOUT_MS = 4_000

function safeRedirectPath(raw: string | null): string {
  if (!raw || raw.startsWith('//')) {
    return '/dashboard'
  }
  if (raw.startsWith('/dashboard') || raw.startsWith('/join/')) {
    return raw
  }
  return '/dashboard'
}

/** Routes where we must not refresh auth — OAuth callback exchanges its own code */
function skipSessionRefresh(pathname: string): boolean {
  return (
    pathname.startsWith('/auth/callback') ||
    pathname.startsWith('/auth/signout')
  )
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`auth.getUser timed out after ${ms}ms`)),
      ms,
    )
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch((err) => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  let response = NextResponse.next({ request })

  if (skipSessionRefresh(pathname)) {
    return response
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[proxy] missing Supabase env — skipping session refresh', {
      path: pathname,
      hasUrl: Boolean(supabaseUrl),
      hasKey: Boolean(supabaseAnonKey),
    })
    return response
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
          if (headers) {
            Object.entries(headers).forEach(([key, value]) => {
              response.headers.set(key, value)
            })
          }
        },
      },
    })

    const {
      data: { user },
      error,
    } = await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT_MS)

    if (error) {
      console.warn('[proxy] getUser returned error', {
        path: pathname,
        message: error.message,
      })
      return response
    }

    if (user && (pathname === '/login' || pathname === '/')) {
      const destination = safeRedirectPath(
        request.nextUrl.searchParams.get('next'),
      )
      return NextResponse.redirect(new URL(destination, request.url))
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[proxy] updateSession failed', {
      path: pathname,
      message,
      stack,
    })
  }

  return response
}
