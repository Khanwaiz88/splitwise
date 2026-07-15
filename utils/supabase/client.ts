import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (client) return client

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error(
      'Supabase environment variables NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY are missing!'
    )
  }

  client = createBrowserClient(
    supabaseUrl || 'https://missing-supabase-url.supabase.co',
    supabaseAnonKey || 'missing-anon-key',
    {
      cookies: {
        getAll() {
          if (typeof document === 'undefined') return []
          return document.cookie
            .split('; ')
            .filter(Boolean)
            .map((entry) => {
              const eq = entry.indexOf('=')
              const name = eq >= 0 ? entry.slice(0, eq) : entry
              const value = eq >= 0 ? entry.slice(eq + 1) : ''
              return { name, value: decodeURIComponent(value) }
            })
        },
        setAll(cookiesToSet) {
          if (typeof document === 'undefined') return
          cookiesToSet.forEach(({ name, value, options }) => {
            const parts = [`${name}=${encodeURIComponent(value)}`]
            if (options?.maxAge != null) parts.push(`Max-Age=${options.maxAge}`)
            if (options?.path) parts.push(`Path=${options.path}`)
            if (options?.domain) parts.push(`Domain=${options.domain}`)
            if (options?.sameSite) parts.push(`SameSite=${options.sameSite}`)
            if (options?.secure) parts.push('Secure')
            document.cookie = parts.join('; ')
          })
        },
      },
    }
  )
  return client
}
