export type MenuItem = {
  id: string
  name: string
  category: string
  price: number
  ball_count: number
  weight_grams: number
  container_id: string | null
  recipe: { ingredient_id: string; qty: number }[]
  updated_at: string
}

export type TicketLine = {
  key: string
  menuItem: MenuItem
  qty: number
}
