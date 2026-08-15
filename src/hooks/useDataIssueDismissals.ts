import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useDataIssueDismissals() {
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('data_issue_dismissals').select('issue_key')
    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setDismissedKeys(new Set((data ?? []).map((r) => r.issue_key as string)))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const dismiss = useCallback(async (issueKey: string) => {
    // Optimistic: the list re-sorts immediately rather than after a round trip.
    setDismissedKeys((prev) => new Set(prev).add(issueKey))
    const { error } = await supabase.from('data_issue_dismissals').upsert({ issue_key: issueKey })
    if (error) {
      setError(error.message)
      setDismissedKeys((prev) => {
        const next = new Set(prev)
        next.delete(issueKey)
        return next
      })
    }
  }, [])

  const restore = useCallback(async (issueKey: string) => {
    setDismissedKeys((prev) => {
      const next = new Set(prev)
      next.delete(issueKey)
      return next
    })
    const { error } = await supabase.from('data_issue_dismissals').delete().eq('issue_key', issueKey)
    if (error) {
      setError(error.message)
      setDismissedKeys((prev) => new Set(prev).add(issueKey))
    }
  }, [])

  return { dismissedKeys, loading, error, dismiss, restore, refetch: load }
}
