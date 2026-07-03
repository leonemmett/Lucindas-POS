import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useCardLabels() {
  const [card1Label, setCard1Label] = useState('Card 1')
  const [card2Label, setCard2Label] = useState('Card 2')

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['card1_label', 'card2_label'])

      if (cancelled || !data) return

      for (const row of data) {
        const label = typeof row.value === 'string' ? row.value : String(row.value)
        if (row.key === 'card1_label') setCard1Label(label)
        if (row.key === 'card2_label') setCard2Label(label)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { card1Label, card2Label }
}
