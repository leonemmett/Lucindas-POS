import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Table } from '../lib/types'

export function useTables() {
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('tables').select('*').order('sort_order', { ascending: true })
    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setTables(data as Table[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { tables, loading, error, refetch: load }
}
