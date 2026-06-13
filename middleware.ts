import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Simple path-based redirect without database access
  const path = request.nextUrl.pathname
  
  // Allow public routes
  if (path === '/login' || path.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // For other routes, let the page handle auth via SessionProvider
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

