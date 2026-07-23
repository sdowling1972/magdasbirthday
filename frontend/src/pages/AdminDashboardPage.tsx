import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { DashboardStats, InviteListItem } from '../types'

function statusLabel(inv: InviteListItem): string {
  if (inv.attending_count > 0 && inv.pending_count === 0 && inv.declined_count === 0) {
    return 'All attending'
  }
  if (inv.declined_count > 0 && inv.attending_count === 0 && inv.pending_count === 0) {
    return 'All declined'
  }
  if (inv.pending_count === inv.guest_count) {
    return 'Awaiting reply'
  }
  return 'Partial'
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [invites, setInvites] = useState<InviteListItem[]>([])
  const [error, setError] = useState('')
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState<'status' | 'invitations' | null>(null)

  useEffect(() => {
    Promise.all([api.getStats(), api.listInvites()])
      .then(([nextStats, nextInvites]) => {
        setStats(nextStats)
        setInvites(
          [...nextInvites].sort((a, b) =>
            a.household_name.localeCompare(b.household_name, undefined, { sensitivity: 'base' }),
          ),
        )
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [])

  async function downloadStatus() {
    setExportError('')
    setExporting('status')
    try {
      await api.downloadInviteeStatus()
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to download invitee status')
    } finally {
      setExporting(null)
    }
  }

  async function downloadInvitations() {
    setExportError('')
    setExporting('invitations')
    try {
      await api.downloadInvitations()
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to download invitations')
    } finally {
      setExporting(null)
    }
  }

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Dashboard</h1>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Snapshot of Magda&apos;s party planning.
          </p>
        </div>
        <div className="inline-actions">
          <Link to="/admin/album" className="btn btn-secondary">
            Photo album
          </Link>
          <Link to="/admin/invites" className="btn btn-primary">
            Manage invites
          </Link>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {stats && (
        <div className="panel">
          <div className="stats-row">
            <div className="stat">
              <div className="label">Invites</div>
              <div className="value">{stats.invite_count}</div>
            </div>
            <div className="stat">
              <div className="label">Guests</div>
              <div className="value">{stats.guest_count}</div>
            </div>
            <div className="stat">
              <div className="label">Attending</div>
              <div className="value">{stats.attending_count}</div>
            </div>
            <div className="stat">
              <div className="label">Pending</div>
              <div className="value">{stats.pending_count}</div>
            </div>
            <div className="stat">
              <div className="label">Declined</div>
              <div className="value">{stats.declined_count}</div>
            </div>
            <div className="stat">
              <div className="label">Photos to review</div>
              <div className="value">{stats.photos_pending}</div>
            </div>
          </div>
        </div>
      )}

      <div className="panel" style={{ marginTop: '1.25rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Invitee status</h2>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Current RSVP status for each household.
          </p>
        </div>
        {invites.length === 0 ? (
          <p className="empty">No invites yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Household</th>
                  <th>Email</th>
                  <th>Guests</th>
                  <th>Attending</th>
                  <th>Pending</th>
                  <th>Declined</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {invites.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <strong>{inv.household_name}</strong>
                    </td>
                    <td>{inv.email || <span className="muted">—</span>}</td>
                    <td>
                      {inv.guest_count} / {inv.max_guests}
                    </td>
                    <td>
                      <span className="badge badge-ok">{inv.attending_count}</span>
                    </td>
                    <td>
                      <span className="badge badge-warn">{inv.pending_count}</span>
                    </td>
                    <td>
                      <span className="badge badge-danger">{inv.declined_count}</span>
                    </td>
                    <td>{statusLabel(inv)}</td>
                    <td>
                      <Link to={`/admin/invites/${inv.id}`} className="btn btn-secondary btn-sm">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel stack" style={{ marginTop: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>Exports</h2>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Download spreadsheet files for invitee status or invitation messages.
          </p>
        </div>
        {exportError && <p className="error">{exportError}</p>}
        <div className="inline-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={exporting !== null}
            onClick={() => void downloadStatus()}
          >
            {exporting === 'status' ? 'Preparing…' : 'Download invitee list status'}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={exporting !== null}
            onClick={() => void downloadInvitations()}
          >
            {exporting === 'invitations' ? 'Preparing…' : 'Download invitations'}
          </button>
        </div>
      </div>
    </div>
  )
}
