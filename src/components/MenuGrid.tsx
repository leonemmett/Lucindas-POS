import { useMemo, useState } from 'react'
import type { MenuItem } from '../lib/types'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

type MenuGridProps = {
  menuItems: MenuItem[]
  loading: boolean
  error: string | null
  onSelect: (item: MenuItem) => void
}

export function MenuGrid({ menuItems, loading, error, onSelect }: MenuGridProps) {
  const [activeCategory, setActiveCategory] = useState<string>('All')
  const [search, setSearch] = useState('')

  const categories = useMemo(() => {
    const set = new Set(menuItems.map((item) => item.category))
    return ['All', ...Array.from(set).sort()]
  }, [menuItems])

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (query) {
      return menuItems.filter((item) => item.name.toLowerCase().includes(query))
    }
    if (activeCategory === 'All') return menuItems
    return menuItems.filter((item) => item.category === activeCategory)
  }, [menuItems, activeCategory, search])

  function handleSelectCategory(category: string) {
    setActiveCategory(category)
    setSearch('')
  }

  if (loading) {
    return <div className="menu-grid-status">Loading menu…</div>
  }

  if (error) {
    return <div className="menu-grid-status menu-grid-error">Failed to load menu: {error}</div>
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
            <button key={item.id} type="button" className="menu-tile" onClick={() => onSelect(item)}>
              <span className="menu-tile-name">{item.name}</span>
              <span className="menu-tile-price">{currency.format(item.price)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
