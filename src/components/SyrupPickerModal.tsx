import { useState } from 'react'
import type { MenuItem } from '../lib/types'

type SyrupPickerModalProps = {
  item: MenuItem
  syrupAddOns: MenuItem[]
  onCancel: () => void
  onConfirm: (syrupMenuItem: MenuItem | null) => void
}

export function SyrupPickerModal({ item, syrupAddOns, onCancel, onConfirm }: SyrupPickerModalProps) {
  // Defaults to "No" so the common case — no syrup — is just one tap to skip.
  const [wantsSyrup, setWantsSyrup] = useState(false)
  const [selectedId, setSelectedId] = useState('')

  function handleWantsSyrupChange(value: boolean) {
    setWantsSyrup(value)
    if (!value) setSelectedId('')
  }

  function handleConfirm() {
    if (!wantsSyrup) {
      onConfirm(null)
      return
    }
    const syrup = syrupAddOns.find((s) => s.id === selectedId)
    if (!syrup) return
    onConfirm(syrup)
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card checkout-modal">
        <h2>{item.name}</h2>

        <label>Add a syrup?</label>
        <div className="payment-options">
          <button
            type="button"
            className={!wantsSyrup ? 'payment-option active' : 'payment-option'}
            onClick={() => handleWantsSyrupChange(false)}
          >
            No
          </button>
          <button
            type="button"
            className={wantsSyrup ? 'payment-option active' : 'payment-option'}
            onClick={() => handleWantsSyrupChange(true)}
          >
            Yes
          </button>
        </div>

        {wantsSyrup && (
          <>
            <label>Flavour</label>
            <div className="payment-options">
              {syrupAddOns.map((syrup) => (
                <button
                  key={syrup.id}
                  type="button"
                  className={selectedId === syrup.id ? 'payment-option active' : 'payment-option'}
                  onClick={() => setSelectedId(syrup.id)}
                >
                  {syrup.name.replace(/^Add syrup - /, '')}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="checkout-actions">
          <button type="button" className="checkout-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="checkout-confirm"
            onClick={handleConfirm}
            disabled={wantsSyrup && !selectedId}
          >
            Add to order
          </button>
        </div>
      </div>
    </div>
  )
}
