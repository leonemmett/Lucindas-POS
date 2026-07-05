import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { MenuItemEditor } from './MenuItemEditor'
import type { Ingredient, MenuItem } from '../lib/types'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

type MenuManagerProps = {
  menuItems: MenuItem[]
  loading: boolean
  error: string | null
  ingredients: Ingredient[]
  onChanged: () => void
}

export function MenuManager({ menuItems, loading, error, ingredients, onChanged }: MenuManagerProps) {
  const [editingItem, setEditingItem] = useState<MenuItem | null | undefined>(undefined)

  const categories = useMemo(
    () => Array.from(new Set(menuItems.map((item) => item.category))).sort(),
    [menuItems],
  )

  const ingredientName = (id: string) => ingredients.find((ing) => ing.id === id)?.name ?? 'Unknown'

  function handleSaved() {
    setEditingItem(undefined)
    onChanged()
  }

  async function toggleFavourite(item: MenuItem) {
    await supabase.from('menu_items').update({ is_favourite: !item.is_favourite }).eq('id', item.id)
    onChanged()
  }

  return (
    <div className="menu-manager">
      <div className="menu-manager-header">
        <h2>Menu items</h2>
        <button type="button" className="menu-manager-add" onClick={() => setEditingItem(null)}>
          + New item
        </button>
      </div>

      {loading && <div className="menu-grid-status">Loading menu…</div>}
      {error && <div className="menu-grid-status menu-grid-error">Failed to load menu: {error}</div>}
      {!loading && !error && menuItems.length === 0 && (
        <div className="menu-grid-status">No menu items yet. Add your first one above.</div>
      )}

      {!loading && !error && menuItems.length > 0 && (
        <table className="menu-manager-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Price</th>
              <th>Container</th>
              <th>Recipe</th>
              <th>Favourite</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {menuItems.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.category}</td>
                <td>{currency.format(item.price)}</td>
                <td>{item.container_id ? ingredientName(item.container_id) : '—'}</td>
                <td>
                  {item.recipe.length === 0
                    ? '—'
                    : item.recipe.map((r) => `${ingredientName(r.ingredient_id)} ×${r.qty}`).join(', ')}
                </td>
                <td>
                  <button
                    type="button"
                    className={item.is_favourite ? 'menu-favourite-star active' : 'menu-favourite-star'}
                    onClick={() => toggleFavourite(item)}
                    title={item.is_favourite ? 'Remove from Favourites tab' : 'Add to Favourites tab'}
                  >
                    {item.is_favourite ? '★' : '☆'}
                  </button>
                </td>
                <td>
                  <button type="button" className="menu-manager-edit" onClick={() => setEditingItem(item)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingItem !== undefined && (
        <MenuItemEditor
          item={editingItem}
          categories={categories}
          ingredients={ingredients}
          onClose={() => setEditingItem(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
