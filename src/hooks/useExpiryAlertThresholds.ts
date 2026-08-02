import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useExpiryAlertThresholds() {
  const [amberDays, setAmberDays] = useState(14)
  const [redDays, setRedDays] = useState(5)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('settings')
      .select('key,value')
      .in('key', ['expiry_alert_amber_days', 'expiry_alert_red_days'])
    for (const row of data ?? []) {
      if (row.key === 'expiry_alert_amber_days' && typeof row.value === 'number') setAmberDays(row.value)
      if (row.key === 'expiry_alert_red_days' && typeof row.value === 'number') setRedDays(row.value)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function saveAmberDays(next: number) {
    await supabase.from('settings').upsert({ key: 'expiry_alert_amber_days', value: next })
    setAmberDays(next)
  }

  async function saveRedDays(next: number) {
    await supabase.from('settings').upsert({ key: 'expiry_alert_red_days', value: next })
    setRedDays(next)
  }

  return { amberDays, redDays, loading, saveAmberDays, saveRedDays }
}
