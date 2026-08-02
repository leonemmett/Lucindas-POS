import type { Ingredient, IngredientBatch } from './types'

// low_threshold=0 marks an ingredient as untracked/reference-only (e.g. flavours
// not currently carried) — it should never trigger a low-stock alert.
export function isLowStock(ingredient: Ingredient): boolean {
  return ingredient.low_threshold > 0 && ingredient.stock <= ingredient.low_threshold
}

function daysUntil(dateStr: string): number {
  const msPerDay = 24 * 60 * 60 * 1000
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(dateStr)
  expiry.setHours(0, 0, 0, 0)
  return Math.round((expiry.getTime() - today.getTime()) / msPerDay)
}

export function isEmptied(batch: IngredientBatch): boolean {
  return batch.emptied_at !== null
}

export type ExpiryTier = 'red' | 'amber' | 'ok'

// Applies to any ingredient with tracked containers, gelato or otherwise —
// red (already expired or expiring within redDays) always outranks amber.
export function expiryTier(batch: IngredientBatch, amberDays: number, redDays: number): ExpiryTier {
  const days = daysUntil(batch.expiry_date)
  if (days <= redDays) return 'red'
  if (days <= amberDays) return 'amber'
  return 'ok'
}
