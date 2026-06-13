'use client'

import { useSession } from 'next-auth/react'

export function useAuth() {
  const { data: session } = useSession()

  return {
    session,
    isAuthenticated: !!session,
  }
}