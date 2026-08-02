import { useState } from 'react'
import { FlavorSearchSelect } from './FlavorSearchSelect'
import type { FlavorSelection, Ingredient, MenuItem } from '../lib/types'

type MilkPickerModalProps = {
  item: MenuItem
  milks: Ingredient[]
  onCancel: () => void
  onConfirm: (milk: FlavorSelection) => void
}

export function MilkPickerModal({ item, milks, onCancel, onConfirm }: MilkPickerModalProps) {
  const [selected, setSelected] = useState('')

  function handleConfirm() {
    const ing = milks.find((m) => m.id === selected)
    if (!ing) return
    onConfirm({ ingredient_id: ing.id, name: ing.name, grams: item.milk_ml })
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card checkout-modal">
        <h2>{item.name}</h2>

        <label htmlFor="milk-select">Milk</label>
        <FlavorSearchSelect id="milk-select" flavours={milks} value={selected} onChange={setSelected} />

        <div className="checkout-actions">
          <button type="button" className="checkout-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="checkout-confirm" onClick={handleConfirm} disabled={!selected}>
            Add to order
          </button>
        </div>
      </div>
    </div>
  )
}
