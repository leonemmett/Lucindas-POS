import { useMemo, useState } from 'react'
import { useMenuItems } from '../hooks/useMenuItems'
import type { MenuItem } from '../lib/types'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

export function MenuGrid({ onSelect }: { onSelect: (item: MenuItem) => void }) {
  const { menuItems, loading, error } = useMenuItems()
  const [activeCategory, setActiveCategory] = useState<string>('All')

  const categories = useMemo(() => {
    const set = new Set(menuItems.map((item) => item.category))
    return ['All', ...Array.from(set).sort()]
  }, [menuItems])

  const visibleItems = useMemo(() => {
    if (activeCategory === 'All') return menuItems
    return menuItems.filter((item) => item.category === activeCategory)
  }, [menuItems, activeCategory])

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
      <div className="category-tabs">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={category === activeCategory ? 'category-tab active' : 'category-tab'}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="menu-grid">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className="menu-tile"
            onClick={() => onSelect(item)}
          >
            <span className="menu-tile-name">{item.name}</span>
            <span className="menu-tile-price">{currency.format(item.price)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
