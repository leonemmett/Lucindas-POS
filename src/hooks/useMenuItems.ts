import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { MenuItem } from '../lib/types'

export function useMenuItems() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setMenuItems(data as MenuItem[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { menuItems, loading, error, refetch: load }
}
