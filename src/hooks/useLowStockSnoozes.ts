import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const PREFIX = 'low_stock:'
const SNOOZE_DAYS = 14

function issueKey(ingredientId: string) {
  return `${PREFIX}${ingredientId}`
}

export type LowStockSnooze = { ingredientId: string; dismissedAt: string }

export function useLowStockSnoozes() {
  const [snoozes, setSnoozes] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('data_issue_dismissals')
      .select('issue_key, dismissed_at')
      .like('issue_key', `${PREFIX}%`)
    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setSnoozes(new Map((data ?? []).map((r) => [r.issue_key.slice(PREFIX.length), r.dismissed_at as string])))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Snoozed = has a dismissal row less than SNOOZE_DAYS old. An older row is
  // left in place (cheaper than deleting on a schedule) but simply stops
  // counting, so the ingredient reappears on its own without any cleanup job.
  const snoozedIds = new Set(
    [...snoozes.entries()]
      .filter(([, dismissedAt]) => Date.now() - new Date(dismissedAt).getTime() < SNOOZE_DAYS * 24 * 60 * 60 * 1000)
      .map(([ingredientId]) => ingredientId),
  )

  const snooze = useCallback(async (ingredientId: string, staffId: string | null) => {
    const dismissedAt = new Date().toISOString()
    setSnoozes((prev) => new Map(prev).set(ingredientId, dismissedAt))
    const { error } = await supabase
      .from('data_issue_dismissals')
      .upsert({ issue_key: issueKey(ingredientId), dismissed_at: dismissedAt, dismissed_by: staffId })
    if (error) {
      setError(error.message)
      setSnoozes((prev) => {
        const next = new Map(prev)
        next.delete(ingredientId)
        return next
      })
    }
  }, [])

  const unsnooze = useCallback(async (ingredientId: string) => {
    setSnoozes((prev) => {
      const next = new Map(prev)
      next.delete(ingredientId)
      return next
    })
    const { error } = await supabase.from('data_issue_dismissals').delete().eq('issue_key', issueKey(ingredientId))
    if (error) {
      setError(error.message)
      load()
    }
  }, [load])

  return { snoozedIds, snoozes, loading, error, snooze, unsnooze, snoozeDays: SNOOZE_DAYS, refetch: load }
}
