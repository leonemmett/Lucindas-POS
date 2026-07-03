export type RecipeEntry = { ingredient_id: string; qty: number }

export type MenuItem = {
  id: string
  name: string
  category: string
  price: number
  ball_count: number
  weight_grams: number
  container_id: string | null
  recipe: RecipeEntry[]
  updated_at: string
}

export type Ingredient = {
  id: string
  name: string
  unit: string
  stock: number
  low_threshold: number
  cost_per_unit: number
  is_flavour: boolean
  is_container: boolean
  updated_at: string
}

export type TicketLine = {
  key: string
  menuItem: MenuItem
  qty: number
}

export type PaymentMethod = 'cash' | 'card1' | 'card2' | 'transfer'

export type Table = {
  id: string
  name: string
  sort_order: number
}

export type OpenTicketItem = {
  menu_item_id: string
  qty: number
}
