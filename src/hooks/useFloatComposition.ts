import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { sumDenominations } from '../lib/denominations'

export function useFloatComposition() {
  const [composition, setComposition] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('settings').select('value').eq('key', 'float_composition').maybeSingle()
    setComposition((data?.value as Record<string, number>) ?? {})
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function save(newComposition: Record<string, number>) {
    await supabase.from('settings').upsert({ key: 'float_composition', value: newComposition })
    setComposition(newComposition)
  }

  return { composition, floatTotal: sumDenominations(composition), loading, save }
}
