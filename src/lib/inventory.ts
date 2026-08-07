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

// Soonest expiry date among an ingredient's active (non-emptied) containers,
// or null if it isn't batch-tracked / has nothing active — used to sort
// ingredients lists by expiry without duplicating the batch lookup per call site.
export function earliestExpiry(ingredientId: string, batches: IngredientBatch[]): string | null {
  const dates = batches
    .filter((b) => b.ingredient_id === ingredientId && !isEmptied(b))
    .map((b) => b.expiry_date)
    .sort()
  return dates[0] ?? null
}

export type IngredientSortBy = 'name' | 'weight' | 'expiry'

// Shared sort for any ingredients list (Ingredients tab, Low Stock tab) so
// "by name/weight/expiry" behaves identically everywhere it's offered.
// Ingredients with no active batch sort to the end under 'expiry'.
export function sortIngredients(
  list: Ingredient[],
  sortBy: IngredientSortBy,
  batches: IngredientBatch[],
): Ingredient[] {
  const sorted = [...list]
  if (sortBy === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sortBy === 'weight') {
    sorted.sort((a, b) => b.stock - a.stock)
  } else {
    sorted.sort((a, b) => {
      const aExpiry = earliestExpiry(a.id, batches)
      const bExpiry = earliestExpiry(b.id, batches)
      if (aExpiry && bExpiry) return aExpiry.localeCompare(bExpiry)
      if (aExpiry) return -1
      if (bExpiry) return 1
      return a.name.localeCompare(b.name)
    })
  }
  return sorted
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
