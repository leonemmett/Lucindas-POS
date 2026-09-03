import type { ReceiptContent } from './receiptContent'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

// Fixed light-theme brand colors — a PDF has no dark-mode viewer to adapt to,
// so this deliberately doesn't reuse the app's CSS custom properties.
const INK = '#211c16'
const MUTED = '#5a5248'
const ACCENT = '#c96a2e'
const RULE = '#d8cdb8'

const LOGO_ASPECT = 533 / 800 // public/logo.png is 800×533

async function loadLogoDataUrl(): Promise<string> {
  const res = await fetch('/logo.png')
  if (!res.ok) throw new Error('logo fetch failed')
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function generateReceiptPdf(input: ReceiptContent): Promise<Blob> {
  // Loaded on demand — jsPDF is only needed when someone actually taps
  // "Send receipt", not on every POS page load.
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 24
  let y = 20

  try {
    const logoDataUrl = await loadLogoDataUrl()
    const logoWidth = 52
    const logoHeight = logoWidth * LOGO_ASPECT
    doc.addImage(logoDataUrl, 'PNG', (pageWidth - logoWidth) / 2, y, logoWidth, logoHeight)
    y += logoHeight + 8
  } catch {
    // Logo couldn't load — fall back to a text wordmark so the receipt still generates.
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(INK)
    doc.text("Lucinda's", pageWidth / 2, y + 8, { align: 'center' })
    y += 16
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(MUTED)
  doc.text(input.ts.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' }), pageWidth / 2, y, {
    align: 'center',
  })
  y += 5
  doc.text(
    `${input.tableName ?? 'Counter'} · ${input.customers} guest${input.customers === 1 ? '' : 's'}`,
    pageWidth / 2,
    y,
    { align: 'center' },
  )
  y += 10

  doc.setDrawColor(ACCENT)
  doc.setLineWidth(0.6)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 10

  doc.setFontSize(11)
  for (const item of input.items) {
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(INK)
    doc.text(`${item.qty} × ${item.name}`, marginX, y)
    doc.text(currency.format(item.price * item.qty), pageWidth - marginX, y, { align: 'right' })
    y += 6
    if (item.flavors && item.flavors.length > 0) {
      doc.setFontSize(9)
      doc.setTextColor(MUTED)
      doc.text(item.flavors.map((f) => f.name).join(', '), marginX + 4, y)
      doc.setFontSize(11)
      y += 5
    }
  }

  y += 3
  doc.setDrawColor(RULE)
  doc.setLineWidth(0.3)
  doc.line(marginX, y, pageWidth - marginX, y)
  y += 8

  doc.setFontSize(11)
  doc.setTextColor(INK)
  doc.text('Subtotal', marginX, y)
  doc.text(currency.format(input.subtotal), pageWidth - marginX, y, { align: 'right' })
  y += 6

  if (input.discountAmount > 0) {
    doc.text(`Discount (${input.discountPercent}%)`, marginX, y)
    doc.text(`-${currency.format(input.discountAmount)}`, pageWidth - marginX, y, { align: 'right' })
    y += 6
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(ACCENT)
  doc.text('Total', marginX, y)
  doc.text(currency.format(input.total), pageWidth - marginX, y, { align: 'right' })
  y += 9

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(MUTED)
  doc.text(`Payment: ${input.paymentLabel}`, marginX, y)
  y += 18

  doc.setFont('helvetica', 'italic')
  doc.setFontSize(12)
  doc.setTextColor(ACCENT)
  doc.text('Thank you for visiting!', pageWidth / 2, y, { align: 'center' })

  return doc.output('blob')
}
