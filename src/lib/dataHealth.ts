import type { Ingredient, MenuItem } from './types'

export type IssueSeverity = 'error' | 'warning'

export type DataIssue = {
  key: string // stable across renames — check name + row id
  severity: IssueSeverity
  subject: string // what's wrong with, by name
  title: string
  detail: string
  fixHint: string
}

// An ingredient counts as "in use" if some menu item's recipe or container
// points at it, or if it's selectable at checkout (a gelato flavour or a
// milk). Ingredients nothing consumes are deliberately not flagged — the
// ~110 dormant reference flavours would otherwise drown out real problems.
function inUseIngredientIds(menuItems: MenuItem[]): Set<string> {
  const used = new Set<string>()
  for (const m of menuItems) {
    for (const r of m.recipe ?? []) used.add(r.ingredient_id)
    if (m.container_id) used.add(m.container_id)
  }
  return used
}

export function findDataIssues(menuItems: MenuItem[], ingredients: Ingredient[]): DataIssue[] {
  const issues: DataIssue[] = []
  const ingById = new Map(ingredients.map((i) => [i.id, i]))
  const used = inUseIngredientIds(menuItems)

  for (const m of menuItems) {
    if (!m.price || m.price <= 0) {
      issues.push({
        key: `menu_no_price:${m.id}`,
        severity: 'error',
        subject: m.name,
        title: 'No sale price',
        detail: `"${m.name}" is priced at $0, so it rings up as free.`,
        fixHint: 'Set a price in Menu, or ignore if it is deliberately free.',
      })
    }

    const deductsNothing =
      (m.recipe ?? []).length === 0 && !m.container_id && !m.ball_count && !m.weight_grams && !m.milk_ml
    if (deductsNothing) {
      issues.push({
        key: `menu_no_deduction:${m.id}`,
        severity: 'warning',
        subject: m.name,
        title: 'Deducts no stock when sold',
        detail: `Selling "${m.name}" does not reduce any ingredient, and it shows no cost in the margin report.`,
        fixHint: 'Add a recipe in Menu, or ignore for items with nothing to track.',
      })
    }

    for (const r of m.recipe ?? []) {
      if (!ingById.has(r.ingredient_id)) {
        issues.push({
          key: `menu_broken_recipe:${m.id}:${r.ingredient_id}`,
          severity: 'error',
          subject: m.name,
          title: 'Recipe points at a missing ingredient',
          detail: `"${m.name}" has a recipe line for an ingredient that no longer exists, so that part never deducts.`,
          fixHint: 'Re-add the ingredient, or remove the line from the recipe in Menu.',
        })
      }
    }

    if (m.container_id && !ingById.has(m.container_id)) {
      issues.push({
        key: `menu_broken_container:${m.id}`,
        severity: 'error',
        subject: m.name,
        title: 'Container no longer exists',
        detail: `"${m.name}" is set to use a container ingredient that has been deleted.`,
        fixHint: 'Pick a current container in Menu.',
      })
    }
  }

  for (const i of ingredients) {
    const isInUse = used.has(i.id) || i.is_flavour || i.is_milk
    if (isInUse && (!i.cost_per_unit || i.cost_per_unit <= 0)) {
      issues.push({
        key: `ingredient_no_cost:${i.id}`,
        severity: 'warning',
        subject: i.name,
        title: 'No cost per unit',
        detail: `"${i.name}" is used in sales but costs $0, so anything made with it looks more profitable than it is.`,
        fixHint: 'Enter a cost in Ingredients, or ignore if it genuinely costs nothing.',
      })
    }
  }

  // Errors first, then alphabetically within each tier so the list is stable
  // between renders rather than reshuffling as data loads.
  return issues.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1
    return a.subject.localeCompare(b.subject)
  })
}
