"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import type { User, Session } from '@supabase/supabase-js'

// User profile type
export interface UserProfile {
  id: string
  email: string
  name: string | null
  phone: string | null
  role: string
  status: string
  line_user_id: string | null
  line_display_name: string | null
  line_avatar_url: string | null
  line_status_message: string | null
  created_at: string
  updated_at: string
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  isLoading: boolean
  isLineBound: boolean
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (email: string, password: string, name?: string, phone?: string) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Get tenant config from cookie or localStorage
function getTenantConfig() {
  if (typeof window === 'undefined') return null
  
  // Try cookie first
  const cookies = document.cookie.split(';')
  const tenantCookie = cookies.find(c => c.trim().startsWith('tenant_config='))
  if (tenantCookie) {
    try {
      return JSON.parse(decodeURIComponent(tenantCookie.split('=')[1]))
    } catch (e) {
      console.error('Failed to parse tenant cookie:', e)
    }
  }
  
  // Fallback to localStorage
  const stored = localStorage.getItem('tenantConfig')
  return stored ? JSON.parse(stored) : null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  // Create Supabase client
  const getSupabase = () => {
    const config = getTenantConfig()
    const url = config?.url || process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_URL!
    const key = config?.anonKey || process.env.NEXT_PUBLIC_TENANT_A_SUPABASE_ANON_KEY!
    return createBrowserClient(url, key)
  }

  // Fetch user profile
  const fetchProfile = async (userId: string) => {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) {
      console.error('Failed to fetch profile:', error)
      return null
    }
    return data as UserProfile
  }

  // Refresh profile data
  const refreshProfile = async () => {
    if (!user) return
    const newProfile = await fetchProfile(user.id)
    if (newProfile) {
      setProfile(newProfile)
    }
  }

  // Initialize auth state
  useEffect(() => {
    const supabase = getSupabase()
    
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        const userProfile = await fetchProfile(session.user.id)
        setProfile(userProfile)
      }
      
      setIsLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event)
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          const userProfile = await fetchProfile(session.user.id)
          setProfile(userProfile)
        } else {
          setProfile(null)
        }
        
        setIsLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Sign in with email/password
  const signIn = async (email: string, password: string) => {
    const supabase = getSupabase()
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    if (data.user) {
      const userProfile = await fetchProfile(data.user.id)
      setProfile(userProfile)
    }

    return { success: true }
  }

  // Sign up with email/password
  const signUp = async (email: string, password: string, name?: string, phone?: string) => {
    const supabase = getSupabase()
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    if (data.user) {
      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          email,
          name: name || null,
          phone: phone || null,
          role: 'user',
          status: 'active',
        })

      if (profileError) {
        console.error('Failed to create profile:', profileError)
        return { success: false, error: '建立用戶資訊失敗' }
      }

      const userProfile = await fetchProfile(data.user.id)
      setProfile(userProfile)
    }

    return { success: true }
  }

  // Sign out
  const signOut = async () => {
    const supabase = getSupabase()
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setSession(null)
    
    // Clear tenant config
    document.cookie = 'tenant_config=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT'
    localStorage.removeItem('tenantConfig')
    localStorage.removeItem('currentUser')
    localStorage.removeItem('user')
    
    router.push('/auth')
  }

  const value = {
    user,
    profile,
    session,
    isLoading,
    isLineBound: !!profile?.line_user_id,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
