import { useState } from 'react'

type SendReceiptControlsProps = {
  receiptText: string
  emailSubject?: string
}

export function SendReceiptControls({ receiptText, emailSubject = "Lucinda's — your receipt" }: SendReceiptControlsProps) {
  const [contact, setContact] = useState('')
  const trimmed = contact.trim()

  function handleWhatsApp() {
    const digits = trimmed.replace(/[^\d]/g, '')
    if (!digits) return
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(receiptText)}`, '_blank', 'noopener,noreferrer')
  }

  function handleEmail() {
    if (!trimmed) return
    const to = trimmed.replace(/\s+/g, '')
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(receiptText)}`
  }

  return (
    <div className="send-receipt no-print">
      <label htmlFor="send-receipt-contact">Send to customer</label>
      <input
        id="send-receipt-contact"
        type="text"
        placeholder="Phone (+52…) or email"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
      />
      <div className="send-receipt-actions">
        <button type="button" onClick={handleWhatsApp} disabled={!trimmed}>
          WhatsApp
        </button>
        <button type="button" onClick={handleEmail} disabled={!trimmed}>
          Email
        </button>
      </div>
    </div>
  )
}
