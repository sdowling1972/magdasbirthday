import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { autologinUrl, formatInviteCode } from '../inviteCode'
import type { Invite } from '../types'

export function AdminInviteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [invite, setInvite] = useState<Invite | null>(null)
  const [error, setError] = useState('')
  const [householdName, setHouseholdName] = useState('')
  const [email, setEmail] = useState('')
  const [maxGuests, setMaxGuests] = useState(1)
  const [notes, setNotes] = useState('')
  const [newGuest, setNewGuest] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    if (!id) return
    try {
      const data = await api.getInvite(id)
      setInvite(data)
      setHouseholdName(data.household_name)
      setEmail(data.email || '')
      setMaxGuests(data.max_guests)
      setNotes(data.notes || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    }
  }

  useEffect(() => {
    load()
  }, [id])

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setMessage('')
    try {
      const updated = await api.updateInvite(id, {
        household_name: householdName,
        email: email || null,
        max_guests: maxGuests,
        notes: notes || null,
      })
      setInvite(updated)
      setMessage('Saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function addGuest(e: FormEvent) {
    e.preventDefault()
    if (!id || !newGuest.trim()) return
    try {
      await api.addGuest(id, newGuest.trim())
      setNewGuest('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add guest')
    }
  }

  async function removeGuest(guestId: string) {
    if (!id || !confirm('Remove this guest?')) return
    try {
      await api.removeGuest(id, guestId)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove guest')
    }
  }

  if (!invite && !error) return <p className="muted">Loading…</p>
  if (!invite) return <p className="error">{error}</p>

  const link = autologinUrl(invite.token)

  return (
    <div className="stack">
      <div className="page-title">
        <div>
          <Link to="/admin/invites" className="muted" style={{ fontSize: '0.9rem' }}>
            ← All invites
          </Link>
          <h1>{invite.household_name}</h1>
        </div>
        <a className="btn btn-secondary" href={link} target="_blank" rel="noreferrer">
          Open invite link
        </a>
      </div>

      {error && <p className="error">{error}</p>}
      {message && <p className="success">{message}</p>}

      <div className="panel">
        <p className="muted" style={{ marginTop: 0 }}>
          Invite code
        </p>
        <p className="token-link" style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
          {formatInviteCode(invite.token)}
        </p>
        <p className="muted" style={{ marginTop: 0 }}>
          Autologin link
        </p>
        <p className="token-link">{link}</p>
      </div>

      <form className="panel form-grid" onSubmit={onSave}>
        <div className="form-row two">
          <div className="form-row">
            <label htmlFor="household">Household name</label>
            <input id="household" value={householdName} onChange={(e) => setHouseholdName(e.target.value)} required />
          </div>
          <div className="form-row">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>
        <div className="form-row two">
          <div className="form-row">
            <label htmlFor="max">Max guests</label>
            <input
              id="max"
              type="number"
              min={invite.guests.length}
              max={20}
              value={maxGuests}
              onChange={(e) => setMaxGuests(Number(e.target.value))}
            />
          </div>
          <div className="form-row">
            <label htmlFor="notes">Notes</label>
            <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        {invite.general_comments && (
          <div className="form-row">
            <label>Guest comments</label>
            <p style={{ margin: 0 }}>{invite.general_comments}</p>
          </div>
        )}
        <button className="btn btn-primary" type="submit">
          Save changes
        </button>
      </form>

      <div className="panel">
        <h2 style={{ fontSize: '1.6rem', marginBottom: '1rem' }}>Guests</h2>
        <div className="guest-list">
          {invite.guests.map((g) => (
            <div key={g.id} className="guest-item" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <strong>{g.name}</strong>
                {g.is_primary && <span className="badge badge-muted" style={{ marginLeft: '0.5rem' }}>Primary</span>}
                <div style={{ marginTop: '0.35rem' }}>
                  <StatusBadge status={g.rsvp_status} />
                </div>
                {g.message && <p className="muted" style={{ margin: '0.35rem 0 0' }}>&ldquo;{g.message}&rdquo;</p>}
              </div>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeGuest(g.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>

        {invite.guests.length < invite.max_guests && (
          <form className="inline-actions" onSubmit={addGuest} style={{ marginTop: '1rem' }}>
            <input
              value={newGuest}
              onChange={(e) => setNewGuest(e.target.value)}
              placeholder="Add another guest"
              style={{ flex: 1, minWidth: '160px' }}
            />
            <button className="btn btn-secondary" type="submit">
              Add guest
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'attending') return <span className="badge badge-ok">Attending</span>
  if (status === 'declined') return <span className="badge badge-danger">Declined</span>
  return <span className="badge badge-warn">Pending</span>
}
