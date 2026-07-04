import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useGramsPerBall() {
  const [gramsPerBall, setGramsPerBall] = useState(85)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase.from('settings').select('value').eq('key', 'grams_per_ball').maybeSingle()
      if (!cancelled && typeof data?.value === 'number') {
        setGramsPerBall(data.value)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return gramsPerBall
}
