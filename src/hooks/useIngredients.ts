import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { Ingredient } from '../lib/types'

export function useIngredients() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('ingredients').select('*').order('name', { ascending: true })
    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setIngredients(data as Ingredient[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { ingredients, loading, error, refetch: load }
}
