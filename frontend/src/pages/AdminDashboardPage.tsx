import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { DashboardStats } from '../types'

export function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getStats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
  }, [])

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Dashboard</h1>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Snapshot of Magda&apos;s party planning.
          </p>
        </div>
        <Link to="/admin/invites" className="btn btn-primary">
          Manage invites
        </Link>
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
    </div>
  )
}
