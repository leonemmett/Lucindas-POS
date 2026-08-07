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

// Ingredients have no stored category (unlike menu_items) — grouping is
// derived from flags/name the same way Favourites derives membership in
// MenuGrid, rather than adding a column every ingredient would need set.
export const INGREDIENT_CATEGORIES = [
  'Gelato',
  'Milk',
  'Containers & Cups',
  'Kombucha',
  'Cold Drinks',
  'Coffee',
  'Tea',
  'Bakery',
  'Extras',
] as const

export type IngredientCategory = (typeof INGREDIENT_CATEGORIES)[number]

const BAKERY_PATTERN = /cookie|alfajor|brownie|medialuna|crois?sant|pastafrola|tarta|pionono|banana bread|libros|power ball/i

export function categorizeIngredient(ingredient: Ingredient): IngredientCategory {
  const name = ingredient.name
  if (name.startsWith('Gelato - ')) return 'Gelato'
  if (ingredient.is_milk) return 'Milk'
  if (ingredient.is_container) return 'Containers & Cups'
  if (/kombucha/i.test(name)) return 'Kombucha'
  if (/\b(can|bottle)\b/i.test(name)) return 'Cold Drinks'
  if (/coffee/i.test(name)) return 'Coffee'
  if (/\btea\b|chai/i.test(name)) return 'Tea'
  if (BAKERY_PATTERN.test(name)) return 'Bakery'
  return 'Extras'
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
