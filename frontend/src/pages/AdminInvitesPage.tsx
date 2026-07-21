import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { autologinUrl, formatInviteCode } from '../inviteCode'
import type { InviteListItem } from '../types'

export function AdminInvitesPage() {
  const [invites, setInvites] = useState<InviteListItem[]>([])
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [householdName, setHouseholdName] = useState('')
  const [email, setEmail] = useState('')
  const [maxGuests, setMaxGuests] = useState(2)
  const [notes, setNotes] = useState('')
  const [guestNames, setGuestNames] = useState('Primary guest')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  async function load() {
    try {
      setInvites(await api.listInvites())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invites')
    }
  }

  useEffect(() => {
    load()
  }, [])

  function inviteLink(token: string) {
    return autologinUrl(token)
  }

  async function copyLink(token: string) {
    await navigator.clipboard.writeText(inviteLink(token))
    setCopied(token)
    setTimeout(() => setCopied(null), 1500)
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const guests = guestNames
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean)
        .map((name, i) => ({ name, is_primary: i === 0, sort_order: i }))
      if (!guests.length) throw new Error('Add at least one guest name')
      await api.createInvite({
        household_name: householdName,
        email: email || null,
        max_guests: maxGuests,
        notes: notes || null,
        guests,
      })
      setHouseholdName('')
      setEmail('')
      setNotes('')
      setGuestNames('Primary guest')
      setMaxGuests(2)
      setShowForm(false)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite')
    } finally {
      setSaving(false)
    }
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`Delete invite for ${name}?`)) return
    await api.deleteInvite(id)
    await load()
  }

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Invites</h1>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Each invite can include multiple people and has its own RSVP link.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : 'New invite'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {showForm && (
        <form className="panel form-grid" onSubmit={onCreate} style={{ marginBottom: '1.5rem' }}>
          <div className="form-row two">
            <div className="form-row">
              <label htmlFor="household">Household / invite name</label>
              <input
                id="household"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
                placeholder="The Smiths"
                required
              />
            </div>
            <div className="form-row">
              <label htmlFor="email">Email (optional)</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="family@example.com"
              />
            </div>
          </div>
          <div className="form-row two">
            <div className="form-row">
              <label htmlFor="max">Max guests on this invite</label>
              <input
                id="max"
                type="number"
                min={1}
                max={20}
                value={maxGuests}
                onChange={(e) => setMaxGuests(Number(e.target.value))}
              />
            </div>
            <div className="form-row">
              <label htmlFor="notes">Private notes</label>
              <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <label htmlFor="guests">Guest names (one per line)</label>
            <textarea
              id="guests"
              rows={4}
              value={guestNames}
              onChange={(e) => setGuestNames(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create invite'}
          </button>
        </form>
      )}

      <div className="panel table-wrap">
        {invites.length === 0 ? (
          <p className="empty">No invites yet. Create one to get started.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Household</th>
                <th>Code</th>
                <th>Guests</th>
                <th>RSVP</th>
                <th>Link</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <strong>{inv.household_name}</strong>
                    {inv.email && (
                      <div className="muted" style={{ fontSize: '0.85rem' }}>
                        {inv.email}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="token-link">{formatInviteCode(inv.token)}</span>
                  </td>
                  <td>
                    {inv.guest_count} / {inv.max_guests}
                  </td>
                  <td>
                    <span className="badge badge-ok">{inv.attending_count} yes</span>{' '}
                    <span className="badge badge-warn">{inv.pending_count} wait</span>{' '}
                    <span className="badge badge-danger">{inv.declined_count} no</span>
                  </td>
                  <td>
                    <div className="inline-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyLink(inv.token)}>
                        {copied === inv.token ? 'Copied' : 'Copy invite link'}
                      </button>
                      <a className="btn btn-secondary btn-sm" href={inviteLink(inv.token)} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </div>
                  </td>
                  <td>
                    <div className="inline-actions">
                      <Link className="btn btn-secondary btn-sm" to={`/admin/invites/${inv.id}`}>
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => onDelete(inv.id, inv.household_name)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
