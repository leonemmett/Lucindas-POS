import { useMemo, useState } from 'react'
import { useSalesInRange } from '../hooks/useSalesInRange'
import { useStaffNames } from '../hooks/useStaffNames'
import { useCardLabels } from '../hooks/useCardLabels'
import { SaleDetailsModal } from './SaleDetailsModal'
import { paymentLabel } from '../lib/payments'
import { todayLocalDateString, addDaysLocal, startOfWeekLocal, startOfMonthLocal, toLocalDateString } from '../lib/dates'
import { downloadCsv, toCsv } from '../lib/csv'
import type { Sale } from '../lib/types'

const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'custom'

const PRESET_LABELS: Record<Preset, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'This week',
  month: 'This month',
  custom: 'Custom',
}

function presetRange(preset: Preset, custom: { start: string; end: string }) {
  const today = todayLocalDateString()
  switch (preset) {
    case 'today':
      return { start: today, end: today }
    case 'yesterday': {
      const y = addDaysLocal(today, -1)
      return { start: y, end: y }
    }
    case 'week':
      return { start: startOfWeekLocal(today), end: today }
    case 'month':
      return { start: startOfMonthLocal(today), end: today }
    case 'custom':
      return custom
  }
}

export function SalesReport() {
  const [preset, setPreset] = useState<Preset>('today')
  const [customStart, setCustomStart] = useState(todayLocalDateString())
  const [customEnd, setCustomEnd] = useState(todayLocalDateString())
  const [viewingSale, setViewingSale] = useState<Sale | null>(null)

  const { start, end } = presetRange(preset, { start: customStart, end: customEnd })
  const { sales, loading, refetch } = useSalesInRange(start, end)
  const staffNames = useStaffNames()
  const { card1Label, card2Label } = useCardLabels()

  const activeSales = useMemo(() => sales.filter((s) => !s.voided_at), [sales])
  const voidedSales = useMemo(() => sales.filter((s) => s.voided_at), [sales])

  function handleDownload() {
    const rows = sales.map((sale) => ({
      date: new Date(sale.ts).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }),
      table: sale.table_name ?? 'Counter',
      items: sale.items.map((i) => `${i.qty}x ${i.name}`).join('; '),
      subtotal: sale.subtotal,
      discount: sale.discount_amount,
      total: sale.total,
      payment: paymentLabel(sale.payment, card1Label, card2Label),
      staff: sale.staff_id ? (staffNames[sale.staff_id] ?? '') : '',
      voided: sale.voided_at ? 'yes' : 'no',
    }))
    downloadCsv(
      `sales-${start}-to-${end}.csv`,
      toCsv(rows, ['date', 'table', 'items', 'subtotal', 'discount', 'total', 'payment', 'staff', 'voided']),
    )
  }

  const stats = useMemo(() => {
    const revenue = activeSales.reduce((sum, s) => sum + s.total, 0)
    const count = activeSales.length
    const avg = count ? revenue / count : 0
    const discount = activeSales.reduce((sum, s) => sum + s.discount_amount, 0)
    const refundedTotal = voidedSales.reduce((sum, s) => sum + s.total, 0)
    return { revenue, count, avg, discount, refundedTotal, refundedCount: voidedSales.length }
  }, [activeSales, voidedSales])

  const byPayment = useMemo(() => {
    const totals: Record<string, number> = { cash: 0, card1: 0, card2: 0, transfer: 0 }
    for (const s of activeSales) totals[s.payment] = (totals[s.payment] ?? 0) + s.total
    return totals
  }, [activeSales])

  const byDay = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>()
    for (const s of activeSales) {
      const day = toLocalDateString(s.ts)
      const prev = map.get(day) ?? { revenue: 0, count: 0 }
      prev.revenue += s.total
      prev.count += 1
      map.set(day, prev)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }))
  }, [activeSales])

  const topItems = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>()
    for (const s of activeSales) {
      for (const item of s.items) {
        const prev = map.get(item.menu_item_id) ?? { name: item.name, qty: 0, revenue: 0 }
        prev.qty += item.qty
        prev.revenue += item.price * item.qty
        map.set(item.menu_item_id, prev)
      }
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10)
  }, [activeSales])

  const byStaff = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>()
    for (const s of activeSales) {
      const key = s.staff_id ?? 'unassigned'
      const prev = map.get(key) ?? { revenue: 0, count: 0 }
      prev.revenue += s.total
      prev.count += 1
      map.set(key, prev)
    }
    return [...map.entries()]
      .sort(([, a], [, b]) => b.revenue - a.revenue)
      .map(([staffId, v]) => ({
        staffId,
        name: staffId === 'unassigned' ? 'Unassigned' : (staffNames[staffId] ?? 'Unknown'),
        ...v,
      }))
  }, [activeSales, staffNames])

  const maxDayRevenue = Math.max(1, ...byDay.map((d) => d.revenue))
  const maxPayment = Math.max(1, ...Object.values(byPayment))
  const maxItemRevenue = Math.max(1, ...topItems.map((i) => i.revenue))
  const dayLabelStep = byDay.length > 10 ? Math.ceil(byDay.length / 8) : 1

  const paymentRows = [
    { key: 'cash', label: 'Cash', value: byPayment.cash, color: 'var(--chart-1)' },
    { key: 'card1', label: card1Label, value: byPayment.card1, color: 'var(--chart-2)' },
    { key: 'card2', label: card2Label, value: byPayment.card2, color: 'var(--chart-3)' },
    { key: 'transfer', label: 'Transfer', value: byPayment.transfer, color: 'var(--chart-4)' },
  ]

  return (
    <div className="menu-manager">
      <div className="menu-manager-header">
        <h2>Sales report</h2>
      </div>

      <div className="report-toolbar">
        <div className="category-tabs">
          {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
            <button
              key={p}
              type="button"
              className={preset === p ? 'category-tab active' : 'category-tab'}
              onClick={() => setPreset(p)}
            >
              {PRESET_LABELS[p]}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="report-custom-range">
            <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            <span>to</span>
            <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        )}
        <button type="button" className="menu-manager-edit" onClick={handleDownload} disabled={sales.length === 0}>
          Download CSV
        </button>
      </div>

      {loading && <div className="menu-grid-status">Loading…</div>}
      {!loading && sales.length === 0 && <div className="menu-grid-status">No sales in this range.</div>}

      {!loading && sales.length > 0 && (
        <>
          <div className="stat-tiles">
            <div className="stat-tile">
              <span className="stat-tile-label">Revenue</span>
              <span className="stat-tile-value">{currency.format(stats.revenue)}</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">Sales</span>
              <span className="stat-tile-value">{stats.count}</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">Average sale</span>
              <span className="stat-tile-value">{currency.format(stats.avg)}</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">Discounts given</span>
              <span className="stat-tile-value">{currency.format(stats.discount)}</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-label">Voided ({stats.refundedCount})</span>
              <span className="stat-tile-value stat-tile-danger">{currency.format(stats.refundedTotal)}</span>
            </div>
          </div>

          <div className="cashup-grid">
            <section className="cashup-section">
              <h3>Revenue by day</h3>
              <div className="chart-columns">
                {byDay.map((d, i) => (
                  <div
                    className="chart-column"
                    key={d.date}
                    title={`${d.date}: ${currency.format(d.revenue)} (${d.count} sale${d.count === 1 ? '' : 's'})`}
                  >
                    <div
                      className="chart-column-bar"
                      style={{ height: `${Math.max(4, (d.revenue / maxDayRevenue) * 120)}px` }}
                    />
                    {i % dayLabelStep === 0 && <span className="chart-column-label">{d.date.slice(5)}</span>}
                  </div>
                ))}
              </div>
            </section>

            <section className="cashup-section">
              <h3>Payment methods</h3>
              <div className="chart-hbars">
                {paymentRows.map((row) => (
                  <div className="chart-hbar-row" key={row.key}>
                    <span className="chart-hbar-label">{row.label}</span>
                    <div className="chart-hbar-track">
                      <div
                        className="chart-hbar-fill"
                        style={{ width: `${(row.value / maxPayment) * 100}%`, background: row.color }}
                      />
                    </div>
                    <span className="chart-hbar-value">{currency.format(row.value)}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="cashup-grid">
            <section className="cashup-section">
              <h3>Top items</h3>
              {topItems.length === 0 ? (
                <p className="menu-grid-status">No items</p>
              ) : (
                <div className="chart-hbars">
                  {topItems.map((item) => (
                    <div className="chart-hbar-row" key={item.name}>
                      <span className="chart-hbar-label">
                        {item.name} ×{item.qty}
                      </span>
                      <div className="chart-hbar-track">
                        <div
                          className="chart-hbar-fill"
                          style={{ width: `${(item.revenue / maxItemRevenue) * 100}%`, background: 'var(--chart-sequential)' }}
                        />
                      </div>
                      <span className="chart-hbar-value">{currency.format(item.revenue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="cashup-section">
              <h3>By staff</h3>
              <table className="menu-manager-table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Sales</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {byStaff.map((row) => (
                    <tr key={row.staffId}>
                      <td>{row.name}</td>
                      <td>{row.count}</td>
                      <td>{currency.format(row.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <section className="cashup-section report-sales-list">
            <h3>Sales</h3>
            <table className="menu-manager-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Table</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Staff</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sales.map((sale) => (
                  <tr key={sale.id} className={sale.voided_at ? 'report-sale-voided' : ''}>
                    <td>{new Date(sale.ts).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td>{sale.table_name ?? 'Counter'}</td>
                    <td>{sale.items.reduce((n, i) => n + i.qty, 0)}</td>
                    <td>
                      {currency.format(sale.total)}
                      {sale.voided_at && <span className="void-badge">Voided</span>}
                    </td>
                    <td>{paymentLabel(sale.payment, card1Label, card2Label)}</td>
                    <td>{sale.staff_id ? (staffNames[sale.staff_id] ?? '—') : '—'}</td>
                    <td>
                      <button type="button" className="menu-manager-edit" onClick={() => setViewingSale(sale)}>
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {viewingSale && (
        <SaleDetailsModal
          sale={viewingSale}
          staffNames={staffNames}
          onClose={() => setViewingSale(null)}
          onVoided={() => {
            setViewingSale(null)
            refetch()
          }}
        />
      )}
    </div>
  )
}
