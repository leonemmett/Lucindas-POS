import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'

// Shared walk-up account so the POS works without a personal login. Any
// staff member can still sign in over the top via the "Staff sign in" button.
const COUNTER_EMAIL = import.meta.env.VITE_COUNTER_EMAIL as string | undefined
const COUNTER_PASSWORD = import.meta.env.VITE_COUNTER_PASSWORD as string | undefined

async function signInAsCounter() {
  if (!COUNTER_EMAIL || !COUNTER_PASSWORD) return null
  const { data } = await supabase.auth.signInWithPassword({
    email: COUNTER_EMAIL,
    password: COUNTER_PASSWORD,
  })
  return data.session ?? null
}

type AuthContextValue = {
  session: Session | null
  loading: boolean
  isCounterSession: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session ?? (await signInAsCounter()))
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
    await signInAsCounter()
  }

  const isCounterSession = Boolean(COUNTER_EMAIL) && session?.user.email === COUNTER_EMAIL

  return (
    <AuthContext.Provider value={{ session, loading, isCounterSession, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
