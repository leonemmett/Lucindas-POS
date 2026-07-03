import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'

export function useCurrentStaff() {
  const { session } = useAuth()
  const [staffId, setStaffId] = useState<string | null>(null)
  const [staffName, setStaffName] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const email = session?.user.email

    if (!email) {
      setStaffId(null)
      setStaffName(null)
      return
    }

    async function load() {
      const { data } = await supabase.from('staff').select('id, name').eq('email', email).maybeSingle()
      if (!cancelled) {
        setStaffId(data?.id ?? null)
        setStaffName(data?.name ?? null)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [session?.user.email])

  return { staffId, staffName }
}
