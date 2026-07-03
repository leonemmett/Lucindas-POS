import type { Ingredient } from './types'

// low_threshold=0 marks an ingredient as untracked/reference-only (e.g. flavours
// not currently carried) — it should never trigger a low-stock alert.
export function isLowStock(ingredient: Ingredient): boolean {
  return ingredient.low_threshold > 0 && ingredient.stock <= ingredient.low_threshold
}
