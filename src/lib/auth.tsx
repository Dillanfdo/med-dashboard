import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { setMockActor } from '@/api/actor'
import type { Actor, Role } from '@/types'

interface AuthContextValue {
  actor: Actor | null
  setSession: (actor: Actor | null) => void
  switchRole: (role: Role) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [actor, setActor] = useState<Actor | null>(null)

  const value = useMemo<AuthContextValue>(
    () => ({
      actor,
      setSession: (next) => {
        setMockActor(next)
        setActor(next)
      },
      switchRole: (role) => {
        setActor((prev) => {
          if (!prev || !prev.roles.includes(role)) return prev
          const next = { ...prev, activeRole: role }
          setMockActor(next)
          return next
        })
      },
    }),
    [actor],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
