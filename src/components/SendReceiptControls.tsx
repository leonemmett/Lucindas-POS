import { useRef, useState } from 'react'
import { formatReceiptText } from '../lib/receiptText'
import { generateReceiptPdf } from '../lib/receiptPdf'
import { uploadReceiptPdf } from '../lib/receiptStorage'
import type { ReceiptContent } from '../lib/receiptContent'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

type SendReceiptControlsProps = {
  receipt: ReceiptContent
}

export function SendReceiptControls({ receipt }: SendReceiptControlsProps) {
  const [contact, setContact] = useState('')
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pdfUrlRef = useRef<string | null>(null)

  async function getMessage(): Promise<string> {
    if (pdfUrlRef.current) {
      return `Thanks for visiting Lucinda's! Here's your receipt (${currency.format(receipt.total)}): ${pdfUrlRef.current}`
    }
    try {
      const blob = await generateReceiptPdf(receipt)
      const url = await uploadReceiptPdf(blob)
      pdfUrlRef.current = url
      setError(null)
      return `Thanks for visiting Lucinda's! Here's your receipt (${currency.format(receipt.total)}): ${url}`
    } catch {
      setError("Couldn't attach a PDF (offline?) — sent as text instead.")
      return formatReceiptText(receipt)
    }
  }

  async function handleSend(kind: 'whatsapp' | 'email') {
    const trimmed = contact.trim()
    if (!trimmed) return
    setPreparing(true)
    const message = await getMessage()
    setPreparing(false)

    if (kind === 'whatsapp') {
      const digits = trimmed.replace(/[^\d]/g, '')
      if (!digits) return
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
    } else {
      const to = trimmed.replace(/\s+/g, '')
      window.location.href = `mailto:${to}?subject=${encodeURIComponent("Lucinda's — your receipt")}&body=${encodeURIComponent(message)}`
    }
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
        <button type="button" onClick={() => handleSend('whatsapp')} disabled={!contact.trim() || preparing}>
          {preparing ? 'Preparing…' : 'WhatsApp'}
        </button>
        <button type="button" onClick={() => handleSend('email')} disabled={!contact.trim() || preparing}>
          {preparing ? 'Preparing…' : 'Email'}
        </button>
      </div>
      <p className="send-receipt-hint">
        WhatsApp opens whichever app this device treats as default for wa.me links — check this device's
        settings if it should always be WhatsApp Business.
      </p>
      {error && <p className="checkout-error">{error}</p>}
    </div>
  )
}
