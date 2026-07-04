import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Table } from '../lib/types'

export function useTables() {
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('tables').select('*').order('sort_order', { ascending: true })
    setTables((data as Table[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { tables, loading, refetch: load }
}
