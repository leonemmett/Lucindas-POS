import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { MenuItem } from '../lib/types'

export function useMenuItems() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .order('category', { ascending: true })
        .order('name', { ascending: true })

      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        setError(null)
        setMenuItems(data as MenuItem[])
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { menuItems, loading, error }
}
