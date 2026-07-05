import { useMemo, useState } from 'react'
import { FlavorPickerModal } from './FlavorPickerModal'
import type { FlavorSelection, Ingredient, MenuItem } from '../lib/types'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

// Matches the generic scoop-count and weight tiles (e.g. "2 scoops (cup)",
// "2x1 Mondays (cone)", "400g gelato") but not named specialty items like
// "CONO DULCE DE LECHE" or "Affogato" that also happen to live in Gelato.
const GELATO_FAVOURITE_PATTERN = /^(\d+ scoops? \((cone|cup)\)|2x1 mondays \((cone|cup)\)|400g gelato|750g gelato|1kg gelato)$/i

function isFavourite(item: MenuItem): boolean {
  if (item.is_favourite) return true
  if (item.category === 'Coffee') return true
  if (item.category === 'Bakery' && item.name.trim().toLowerCase().startsWith('cookie')) return true
  if (item.category === 'Gelato' && GELATO_FAVOURITE_PATTERN.test(item.name.trim())) return true
  return false
}

type MenuGridProps = {
  menuItems: MenuItem[]
  loading: boolean
  error: string | null
  ingredients: Ingredient[]
  gramsPerBall: number
  popularity: Record<string, number>
  onSelect: (item: MenuItem, flavors?: FlavorSelection[]) => void
  onRetry: () => void
}

export function MenuGrid({
  menuItems,
  loading,
  error,
  ingredients,
  gramsPerBall,
  popularity,
  onSelect,
  onRetry,
}: MenuGridProps) {
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [search, setSearch] = useState('')
  const [flavorPickerItem, setFlavorPickerItem] = useState<MenuItem | null>(null)

  const flavours = useMemo(() => ingredients.filter((i) => i.is_flavour), [ingredients])

  const categories = useMemo(() => {
    const set = new Set(menuItems.map((item) => item.category))
    return ['All', 'Favourites', ...Array.from(set).sort()]
  }, [menuItems])

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (query) {
      return menuItems.filter((item) => item.name.toLowerCase().includes(query))
    }
    if (activeCategory === 'All') return menuItems
    if (activeCategory === 'Favourites') {
      return menuItems
        .filter(isFavourite)
        .slice()
        .sort((a, b) => (popularity[b.id] ?? 0) - (popularity[a.id] ?? 0))
    }
    return menuItems.filter((item) => item.category === activeCategory)
  }, [menuItems, activeCategory, search, popularity])

  function handleSelectCategory(category: string) {
    setActiveCategory(category)
    setSearch('')
  }

  function handleTileClick(item: MenuItem) {
    if (item.ball_count > 0 || item.weight_grams > 0) {
      setFlavorPickerItem(item)
    } else {
      onSelect(item)
    }
  }

  function handleFlavorsConfirmed(flavors: FlavorSelection[]) {
    if (flavorPickerItem) onSelect(flavorPickerItem, flavors)
    setFlavorPickerItem(null)
  }

  if (loading) {
    return <div className="menu-grid-status">Loading menu…</div>
  }

  if (error) {
    return (
      <div className="menu-grid-status menu-grid-error">
        Failed to load menu: {error}
        <button type="button" className="menu-manager-add" onClick={onRetry}>
          Retry
        </button>
      </div>
    )
  }

  if (menuItems.length === 0) {
    return <div className="menu-grid-status">No menu items yet. Add some in Supabase to get started.</div>
  }

  return (
    <div className="menu-grid-panel">
      <input
        type="search"
        className="menu-search"
        placeholder="Search items…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="category-tabs">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={!search && category === activeCategory ? 'category-tab active' : 'category-tab'}
            onClick={() => handleSelectCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {visibleItems.length === 0 ? (
        <div className="menu-grid-status">No items match &ldquo;{search}&rdquo;.</div>
      ) : (
        <div className="menu-grid">
          {visibleItems.map((item) => (
            <button key={item.id} type="button" className="menu-tile" onClick={() => handleTileClick(item)}>
              <span className="menu-tile-name">{item.name}</span>
              <span className="menu-tile-price">{currency.format(item.price)}</span>
            </button>
          ))}
        </div>
      )}

      {flavorPickerItem && (
        <FlavorPickerModal
          item={flavorPickerItem}
          flavours={flavours}
          gramsPerBall={gramsPerBall}
          onCancel={() => setFlavorPickerItem(null)}
          onConfirm={handleFlavorsConfirmed}
        />
      )}
    </div>
  )
}
