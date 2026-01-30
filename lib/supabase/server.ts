import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server-side Supabase client for App Router (Server Components, Route Handlers)
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  
  // Get tenant config from cookie (set during login)
  const tenantConfig = cookieStore.get('tenant_config')?.value
  let supabaseUrl = process.env.SUPABASE_URL!
  let supabaseKey = process.env.SUPABASE_ANON_KEY!
  
  if (tenantConfig) {
    try {
      const config = JSON.parse(tenantConfig)
      supabaseUrl = config.url || supabaseUrl
      supabaseKey = config.anonKey || supabaseKey
    } catch (e) {
      console.error('Failed to parse tenant config:', e)
    }
  }

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  )
}

// Get current user from session (server-side)
export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return null
  }
  
  // Get profile with LINE info
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  
  return profile ? { ...user, profile } : user
}
