import { type NextRequest, NextResponse } from 'next/server'

// Middleware disabled - using localStorage-based auth instead of Supabase Auth
export async function middleware(request: NextRequest) {
  // Just pass through all requests
  return NextResponse.next()
}

export const config = {
  matcher: [],  // Empty matcher = middleware won't run on any routes
}
