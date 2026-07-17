import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  if (skipSessionRefresh(request.nextUrl.pathname)) {
    return response
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      '[proxy] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY',
    )
    return response
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    })

    const { data: { user } } = await supabase.auth.getUser()
    const pathname = request.nextUrl.pathname

    if (user && (pathname === '/login' || pathname === '/')) {
      const destination = safeRedirectPath(
        request.nextUrl.searchParams.get('next'),
      )
      return NextResponse.redirect(new URL(destination, request.url))
    }
  } catch (err) {
    console.error('[proxy] updateSession failed:', err)
  }

  return response
}
