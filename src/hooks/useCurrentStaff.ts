import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

export function useCurrentStaff() {
  const { session } = useAuth()
  const [staffId, setStaffId] = useState<string | null>(null)
  const [staffName, setStaffName] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [active, setActive] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const email = session?.user.email

    if (!email) {
      setStaffId(null)
      setStaffName(null)
      setIsAdmin(false)
      setActive(true)
      setLoaded(false)
      return
    }

    async function load() {
      const { data } = await supabase
        .from('staff')
        .select('id, name, is_admin, active')
        .eq('email', email)
        .maybeSingle()
      if (!cancelled) {
        setStaffId(data?.id ?? null)
        setStaffName(data?.name ?? null)
        setIsAdmin(data?.is_admin ?? false)
        setActive(data?.active ?? true)
        setLoaded(true)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session?.user.email])

  return { staffId, staffName, isAdmin, active, loaded }
}
