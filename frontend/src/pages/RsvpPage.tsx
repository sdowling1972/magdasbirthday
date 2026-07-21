import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useGuestAuth } from '../GuestAuth'
import { getInviteCode, normalizeInviteCode } from '../inviteCode'
import type { InvitePublic, Photo, RsvpStatus } from '../types'

type Draft = {
  rsvp_status: RsvpStatus
  dietary_notes: string
  message: string
}

function formatDate(iso: string) {
  const d = new Date(iso + (iso.includes('T') ? '' : 'T12:00:00'))
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function RsvpPage() {
  const { token: tokenParam } = useParams<{ token: string }>()
  const { login } = useGuestAuth()
  const navigate = useNavigate()
  const inviteCode = normalizeInviteCode(tokenParam || getInviteCode() || '')
  const [invite, setInvite] = useState<InvitePublic | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [photos, setPhotos] = useState<Photo[]>([])
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploaderName, setUploaderName] = useState('')
  const [caption, setCaption] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  /** Shared message for the household (applied to primary guest on save). */
  const [householdMessage, setHouseholdMessage] = useState('')

  useEffect(() => {
    if (!inviteCode || inviteCode.length !== 16) {
      setError('Invite code required')
      return
    }

    let cancelled = false
    async function load() {
      try {
        if (tokenParam) {
          await login(inviteCode)
          if (!cancelled) navigate('/rsvp', { replace: true })
          return
        }
        const [data, photoList] = await Promise.all([
          api.getRsvp(inviteCode),
          api.listInvitePhotos(inviteCode),
        ])
        if (cancelled) return
        setInvite(data)
        setUploaderName(data.household_name)
        const next: Record<string, Draft> = {}
        for (const g of data.guests) {
          next[g.id] = {
            rsvp_status: g.rsvp_status,
            dietary_notes: g.dietary_notes || '',
            message: g.message || '',
          }
        }
        setDrafts(next)
        const primary = data.guests.find((g) => g.is_primary) || data.guests[0]
        setHouseholdMessage(primary?.message || '')
        setPhotos(photoList)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Invite not found')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [inviteCode, tokenParam, login, navigate])

  function updateDraft(guestId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [guestId]: { ...prev[guestId], ...patch } }))
    setSaved(false)
  }

  function setAttending(guestId: string, attending: boolean) {
    updateDraft(guestId, {
      rsvp_status: attending ? 'attending' : 'declined',
      dietary_notes: attending ? drafts[guestId]?.dietary_notes || '' : '',
    })
  }

  function setAllDeclined() {
    if (!invite) return
    setSaved(false)
    setDrafts((prev) => {
      const next = { ...prev }
      for (const g of invite.guests) {
        next[g.id] = { ...next[g.id], rsvp_status: 'declined', dietary_notes: '' }
      }
      return next
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!inviteCode || !invite) return
    setSaving(true)
    setError('')
    try {
      const isSingle = invite.guests.length === 1
      if (isSingle) {
        const g = invite.guests[0]
        const d = drafts[g.id]
        if (d.rsvp_status === 'pending') {
          throw new Error('Please choose whether you will attend')
        }
      } else {
        const anyDecided = invite.guests.some((g) => drafts[g.id]?.rsvp_status !== 'pending')
        if (!anyDecided) {
          throw new Error('Select who is attending, or choose that no one can make it')
        }
      }

      const primaryId = (invite.guests.find((g) => g.is_primary) || invite.guests[0]).id
      const payload = invite.guests.map((g) => {
        const d = drafts[g.id]
        // Unchecked people on a multi-guest invite count as declined once any choice is made
        const status =
          d.rsvp_status === 'attending' ? 'attending' : ('declined' as const)
        return {
          guest_id: g.id,
          rsvp_status: status,
          dietary_notes: status === 'attending' ? d.dietary_notes || null : null,
          message: g.id === primaryId ? householdMessage || null : null,
        }
      })
      const guests = await api.submitRsvp(inviteCode, payload)
      setInvite({ ...invite, guests })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save RSVP')
    } finally {
      setSaving(false)
    }
  }

  async function onUpload(e: FormEvent) {
    e.preventDefault()
    if (!inviteCode || !file) return
    setUploading(true)
    setUploadMsg('')
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('uploader_name', uploaderName || invite?.household_name || 'Guest')
      if (caption) form.append('caption', caption)
      const photo = await api.uploadPhoto(inviteCode, form)
      setPhotos((prev) => [photo, ...prev])
      setFile(null)
      setCaption('')
      setUploadMsg('Photo uploaded — it will appear in the album after approval.')
    } catch (err) {
      setUploadMsg(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  if (error && !invite) {
    return (
      <div className="section">
        <h1>Invite not found</h1>
        <p className="error">{error}</p>
      </div>
    )
  }

  if (!invite) return <p className="muted section">Loading your invitation…</p>

  const isSingle = invite.guests.length === 1
  const single = invite.guests[0]
  const singleDraft = drafts[single?.id]
  const attendingGuests = invite.guests.filter((g) => drafts[g.id]?.rsvp_status === 'attending')
  const anyAnswered = invite.guests.some((g) => drafts[g.id]?.rsvp_status !== 'pending')
  const allDeclined = anyAnswered && attendingGuests.length === 0

  return (
    <div className="section stack" style={{ maxWidth: 720, marginInline: 'auto' }}>
      <div style={{ animation: 'riseIn 0.6s ease both' }}>
        <p className="hero-eyebrow" style={{ color: 'var(--blush-deep)' }}>
          Personal invitation
        </p>
        <h1 style={{ fontSize: 'clamp(2.6rem, 7vw, 4rem)' }}>{invite.party.name}</h1>
        <p className="muted">
          Dear {invite.household_name} — {formatDate(invite.party.date)} · {invite.party.location}
        </p>
        <p>{invite.party.description}</p>
      </div>

      <form className="panel stack" onSubmit={onSubmit}>
        <h2 style={{ fontSize: '1.8rem' }}>Your RSVP</h2>

        {isSingle && singleDraft ? (
          <div className="guest-item" style={{ borderBottom: 'none', paddingTop: 0 }}>
            <p className="muted" style={{ marginTop: 0 }}>
              Invited: <strong style={{ color: 'var(--ink)' }}>{single.name}</strong>
            </p>
            <div className="rsvp-choices">
              <button
                type="button"
                className={`choice attending ${singleDraft.rsvp_status === 'attending' ? 'active' : ''}`}
                onClick={() => setAttending(single.id, true)}
              >
                Joyfully attending
              </button>
              <button
                type="button"
                className={`choice declined ${singleDraft.rsvp_status === 'declined' ? 'active' : ''}`}
                onClick={() => setAttending(single.id, false)}
              >
                Regretfully decline
              </button>
            </div>
            {singleDraft.rsvp_status === 'attending' && (
              <div className="form-row" style={{ marginBottom: '0.75rem' }}>
                <label>Dietary notes</label>
                <input
                  value={singleDraft.dietary_notes}
                  onChange={(e) => updateDraft(single.id, { dietary_notes: e.target.value })}
                  placeholder="Allergies, preferences…"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>
              Select everyone from this invite who will be attending.
            </p>
            <div className="attendee-checklist">
              {invite.guests.map((g) => {
                const d = drafts[g.id]
                if (!d) return null
                const checked = d.rsvp_status === 'attending'
                return (
                  <label key={g.id} className={`attendee-option ${checked ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setAttending(g.id, e.target.checked)}
                    />
                    <span>{g.name}</span>
                  </label>
                )
              })}
            </div>
            <button
              type="button"
              className={`choice declined ${allDeclined ? 'active' : ''}`}
              onClick={setAllDeclined}
              style={{ alignSelf: 'start' }}
            >
              No one from this invite can attend
            </button>

            {attendingGuests.length > 0 && (
              <div className="stack" style={{ marginTop: '0.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Dietary notes</h3>
                {attendingGuests.map((g) => (
                  <div key={g.id} className="form-row">
                    <label htmlFor={`diet-${g.id}`}>{g.name}</label>
                    <input
                      id={`diet-${g.id}`}
                      value={drafts[g.id]?.dietary_notes || ''}
                      onChange={(e) => updateDraft(g.id, { dietary_notes: e.target.value })}
                      placeholder="Allergies, preferences…"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="form-row">
          <label htmlFor="message">Message for Magda (optional)</label>
          <textarea
            id="message"
            rows={2}
            value={householdMessage}
            onChange={(e) => {
              setHouseholdMessage(e.target.value)
              setSaved(false)
            }}
          />
        </div>

        {error && <p className="error">{error}</p>}
        {saved && <p className="success">RSVP saved — thank you!</p>}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save RSVP'}
        </button>
      </form>

      <form className="panel form-grid" onSubmit={onUpload}>
        <h2 style={{ fontSize: '1.8rem', margin: 0 }}>Share a photo of Magda</h2>
        <p className="muted" style={{ margin: 0 }}>
          Upload pictures for the party slideshow. Approved photos also appear in the public album.
        </p>
        <div className="form-row">
          <label htmlFor="uploader">Your name</label>
          <input id="uploader" value={uploaderName} onChange={(e) => setUploaderName(e.target.value)} required />
        </div>
        <div className="form-row">
          <label htmlFor="caption">Caption</label>
          <input id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div className="form-row">
          <label htmlFor="file">Photo</label>
          <input
            id="file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
          />
        </div>
        {uploadMsg && (
          <p className={uploadMsg.includes('failed') || uploadMsg.includes('Only') ? 'error' : 'success'}>{uploadMsg}</p>
        )}
        <button className="btn btn-blush" type="submit" disabled={uploading || !file}>
          {uploading ? 'Uploading…' : 'Upload photo'}
        </button>
      </form>

      {photos.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '1rem' }}>Your uploads</h2>
          <div className="photo-grid">
            {photos.map((p) => (
              <div key={p.id} className="photo-tile">
                <img src={p.url || ''} alt={p.caption || 'Upload'} />
                <div className="photo-meta">
                  <div>{p.status}</div>
                  {p.caption && <div>{p.caption}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
