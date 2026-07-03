import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Table } from '../lib/types'

export function useTables() {
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data } = await supabase.from('tables').select('*').order('sort_order', { ascending: true })
      if (!cancelled) {
        setTables((data as Table[]) ?? [])
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { tables, loading }
}
