import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useItemPopularity() {
  const [popularity, setPopularity] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.rpc('get_item_popularity')
    const map: Record<string, number> = {}
    for (const row of (data ?? []) as { menu_item_id: string; total_qty: number }[]) {
      map[row.menu_item_id] = row.total_qty
    }
    setPopularity(map)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { popularity, loading, refetch: load }
}
