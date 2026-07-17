import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/proxy'

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  try {
    return await updateSession(request)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined

    console.error('[proxy] MIDDLEWARE CRASH', {
      path: pathname,
      method: request.method,
      message,
      stack,
      hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasSupabaseKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    })

    // Fail open — never take the whole site down because of middleware
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: [
    /*
     * Pages only — skip API routes, static assets, PWA files, and auth callbacks.
     * API routes use server-side createClient(); they don't need proxy session refresh.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-|api/|auth/callback|auth/signout|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ttf|ico)$).*)',
  ],
}
