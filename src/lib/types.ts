export type Staff = {
  id: string
  name: string
  email: string
  is_admin: boolean
  active: boolean
  created_at: string
}

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
  is_favourite: boolean
  iva_rate: number
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

export type FlavorSelection = {
  ingredient_id: string
  name: string
  grams: number
}

export type TicketLine = {
  key: string
  menuItem: MenuItem
  qty: number
  flavors?: FlavorSelection[]
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
  flavors?: FlavorSelection[]
}

export type SaleItem = {
  menu_item_id: string
  name: string
  price: number
  qty: number
  flavors?: FlavorSelection[]
}

export type Sale = {
  id: string
  ts: string
  table_name: string | null
  items: SaleItem[]
  subtotal: number
  discount_percent: number
  discount_amount: number
  total: number
  payment: PaymentMethod
  note: string | null
  customers: number
  staff_id: string | null
  voided_at: string | null
  void_reason: string | null
  voided_by: string | null
}

export type DenominationCounts = Record<string, number>

export type ReaderCounts = {
  card1?: number
  card2?: number
}

export type TillAdjustments = {
  removed: DenominationCounts
  added: DenominationCounts
}

export type Cashup = {
  id: string
  date: string
  staff_name: string | null
  counts: DenominationCounts | null
  card_tips: number
  petty_cash: number
  subtotal: number | null
  float_fixed_total: number | null
  total_cash_in_till: number | null
  system_cash: number | null
  cash_difference: number | null
  reader_counts: ReaderCounts | null
  system_card1: number | null
  system_card2: number | null
  system_transfer: number | null
  grand_counted: number | null
  grand_system: number | null
  grand_difference: number | null
  till_adjustments: TillAdjustments | null
  created_at: string
}
