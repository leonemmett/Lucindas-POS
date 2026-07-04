import { useState } from 'react'
import { StaffEditor } from './StaffEditor'
import type { Staff } from '../lib/types'

type StaffManagerProps = {
  staff: Staff[]
  loading: boolean
  onChanged: () => void
}

export function StaffManager({ staff, loading, onChanged }: StaffManagerProps) {
  const [editingStaff, setEditingStaff] = useState<Staff | null | undefined>(undefined)

  function handleSaved() {
    setEditingStaff(undefined)
    onChanged()
  }

  return (
    <div className="menu-manager">
      <div className="menu-manager-header">
        <h2>Staff</h2>
        <button type="button" className="menu-manager-add" onClick={() => setEditingStaff(null)}>
          + New staff
        </button>
      </div>

      {loading && <div className="menu-grid-status">Loading staff…</div>}
      {!loading && staff.length === 0 && <div className="menu-grid-status">No staff yet.</div>}

      {!loading && staff.length > 0 && (
        <table className="menu-manager-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Flags</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className={s.active ? '' : 'staff-inactive'}>
                <td>{s.name}</td>
                <td>{s.email}</td>
                <td>
                  {s.is_admin && <span className="ingredient-flag">Admin</span>}
                  {!s.active && <span className="void-badge">Inactive</span>}
                </td>
                <td>
                  <button type="button" className="menu-manager-edit" onClick={() => setEditingStaff(s)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editingStaff !== undefined && (
        <StaffEditor staffMember={editingStaff} onClose={() => setEditingStaff(undefined)} onSaved={handleSaved} />
      )}
    </div>
  )
}
