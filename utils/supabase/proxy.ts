import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase environment variables NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY are missing in updateSession proxy!')
    return response
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
              response = NextResponse.next({
                request: {
                  headers: request.headers,
                },
              })
            })
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    // Refresh session from cookies (works offline; no network unless token expired)
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null

    const url = request.nextUrl.clone()
    const pathname = url.pathname

    // Protected route redirects:
    // If user is not logged in and attempts to access dashboard, redirect to /login
    // Skip redirect when offline cache may still load on the client (PWA)
    if (!user && pathname.startsWith('/dashboard')) {
      const hasAuthCookie = request.cookies.getAll().some(
        (c) => c.name.includes('auth-token') || c.name.startsWith('sb-'),
      )
      if (!hasAuthCookie) {
        url.pathname = '/login'
        return NextResponse.redirect(url)
      }
    }

    // If user is logged in and attempts to access /login or landing, redirect to /dashboard
    if (user && (pathname === '/login' || pathname === '/')) {
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  } catch (err) {
    console.error('Exception occurred in updateSession proxy:', err)
  }

  return response
}
