import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function safeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith('/dashboard') || raw.startsWith('//')) {
    return '/dashboard'
  }
  return raw
}

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
            cookiesToSet.forEach(({ name, value }) => {
              request.cookies.set(name, value)
            })
            response = NextResponse.next({
              request: {
                headers: request.headers,
              },
            })
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      }
    )

    // getUser refreshes the session cookie — required for SSR auth on refresh
    const { data: { user } } = await supabase.auth.getUser()

    const url = request.nextUrl.clone()
    const pathname = url.pathname

    if (!user && pathname.startsWith('/dashboard')) {
      url.pathname = '/login'
      url.searchParams.set('next', `${pathname}${url.search}`)
      return NextResponse.redirect(url)
    }

    if (user && (pathname === '/login' || pathname === '/')) {
      const destination = safeRedirectPath(url.searchParams.get('next'))
      const destUrl = new URL(destination, request.url)
      url.pathname = destUrl.pathname
      url.search = destUrl.search
      return NextResponse.redirect(url)
    }
  } catch (err) {
    console.error('Exception occurred in updateSession proxy:', err)
  }

  return response
}
