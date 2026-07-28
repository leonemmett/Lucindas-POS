import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useExpiryAlertWindowDays() {
  const [windowDays, setWindowDays] = useState(5)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'expiry_alert_window_days')
        .maybeSingle()
      if (!cancelled && typeof data?.value === 'number') {
        setWindowDays(data.value)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return windowDays
}
