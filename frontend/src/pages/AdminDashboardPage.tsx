import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { DashboardStats } from '../types'

export function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState('')
  const [exportError, setExportError] = useState('')
  const [exporting, setExporting] = useState<'status' | 'invitations' | null>(null)

  useEffect(() => {
    api
      .getStats()
      .then(setStats)
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
