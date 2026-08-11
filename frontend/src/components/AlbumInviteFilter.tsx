import { useEffect, useState } from 'react'
import { api } from '../api'
import type { AlbumContributor, PhotoStatus } from '../types'

type AlbumInviteFilterProps = {
  value: string | null
  onChange: (inviteId: string | null) => void
  /** When set, load contributors via the admin API for this status (or all if ''). */
  adminStatusFilter?: PhotoStatus | ''
}

export function AlbumInviteFilter({
  value,
  onChange,
  adminStatusFilter,
}: AlbumInviteFilterProps) {
  const [contributors, setContributors] = useState<AlbumContributor[]>([])
  const isAdmin = adminStatusFilter !== undefined

  useEffect(() => {
    let cancelled = false
    const request = isAdmin
      ? api.adminContributors(adminStatusFilter || undefined)
      : api.getAlbumContributors()
    request
      .then((rows) => {
        if (!cancelled) setContributors(rows)
      })
      .catch(() => {
        if (!cancelled) setContributors([])
      })
    return () => {
      cancelled = true
    }
  }, [isAdmin, adminStatusFilter])

  if (contributors.length === 0) return null

  return (
    <label className="album-invite-filter">
      <span className="muted">From</span>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Everyone</option>
        {contributors.map((c) => (
          <option key={c.invite_id} value={c.invite_id}>
            {c.household_name} ({c.photo_count})
          </option>
        ))}
      </select>
    </label>
  )
}
