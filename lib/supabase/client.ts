import { getSupabaseClient } from "@/lib/supabase"

// Re-export createClient as an alias for getSupabaseClient for compatibility
export const createClient = getSupabaseClient
