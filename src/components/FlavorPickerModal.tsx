import { useMemo, useState } from 'react'
import type { FlavorSelection, Ingredient, MenuItem } from '../lib/types'

type FlavorPickerModalProps = {
  item: MenuItem
  flavours: Ingredient[]
  gramsPerBall: number
  onCancel: () => void
  onConfirm: (flavors: FlavorSelection[]) => void
}

export function FlavorPickerModal({ item, flavours, gramsPerBall, onCancel, onConfirm }: FlavorPickerModalProps) {
  const isWeightBased = item.ball_count === 0 && item.weight_grams > 0
  const [weightSplit, setWeightSplit] = useState(1)
  const slotCount = isWeightBased ? weightSplit : item.ball_count
  const [selections, setSelections] = useState<string[]>(() => Array(slotCount).fill(''))

  const gramsPerSlot = isWeightBased ? item.weight_grams / slotCount : gramsPerBall

  function handleWeightSplitChange(n: number) {
    setWeightSplit(n)
    setSelections((prev) => {
      const next = [...prev]
      next.length = n
      return Array.from({ length: n }, (_, i) => next[i] ?? '')
    })
  }

  function handleSlotChange(index: number, ingredientId: string) {
    setSelections((prev) => prev.map((s, i) => (i === index ? ingredientId : s)))
  }

  const allSelected = useMemo(() => selections.every((s) => s), [selections])

  function handleConfirm() {
    const flavors: FlavorSelection[] = selections.map((ingredientId) => {
      const ing = flavours.find((f) => f.id === ingredientId)
      return { ingredient_id: ingredientId, name: ing?.name ?? 'Unknown', grams: gramsPerSlot }
    })
    onConfirm(flavors)
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card checkout-modal">
        <h2>{item.name}</h2>

        {isWeightBased && (
          <>
            <label>How many flavors?</label>
            <div className="payment-options">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={weightSplit === n ? 'payment-option active' : 'payment-option'}
                  onClick={() => handleWeightSplitChange(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </>
        )}

        {selections.map((selected, i) => (
          <div key={i}>
            <label htmlFor={`flavor-slot-${i}`}>
              {isWeightBased ? 'Flavor' : 'Scoop'} {i + 1} ({gramsPerSlot % 1 === 0 ? gramsPerSlot : gramsPerSlot.toFixed(1)}g)
            </label>
            <select id={`flavor-slot-${i}`} value={selected} onChange={(e) => handleSlotChange(i, e.target.value)}>
              <option value="">Select flavor…</option>
              {flavours.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        ))}

        <div className="checkout-actions">
          <button type="button" className="checkout-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="checkout-confirm" onClick={handleConfirm} disabled={!allSelected}>
            Add to order
          </button>
        </div>
      </div>
    </div>
  )
}
