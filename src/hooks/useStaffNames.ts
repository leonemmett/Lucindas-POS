import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useStaffNames() {
  const [names, setNames] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase.from('staff').select('id, name')
      if (cancelled || !data) return
      const map: Record<string, string> = {}
      for (const row of data) map[row.id] = row.name
      setNames(map)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return names
}
