import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useReceiptsEnabled() {
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('settings').select('value').eq('key', 'receipts_enabled').maybeSingle()
    setEnabled(data?.value === false ? false : true)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function save(next: boolean) {
    await supabase.from('settings').upsert({ key: 'receipts_enabled', value: next })
    setEnabled(next)
  }

  return { enabled, loading, save }
}
