import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useGuestAuth } from '../GuestAuth'
import { normalizeInviteCode } from '../inviteCode'
import type { InvitePublic, Photo, RsvpStatus } from '../types'

type Draft = {
  rsvp_status: RsvpStatus
}

type FormSnapshot = {
  email: string
  message: string
  generalComments: string
  drafts: Record<string, { rsvp_status: RsvpStatus }>
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

function snapshotOf(
  drafts: Record<string, Draft>,
  email: string,
  message: string,
  generalComments: string,
): FormSnapshot {
  const slim: FormSnapshot['drafts'] = {}
  for (const [id, d] of Object.entries(drafts)) {
    slim[id] = { rsvp_status: d.rsvp_status }
  }
  return {
    email: email.trim(),
    message,
    generalComments,
    drafts: slim,
  }
}

function snapshotsEqual(a: FormSnapshot | null, b: FormSnapshot) {
  if (!a) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

export function RsvpPage() {
  const { token: tokenParam } = useParams<{ token: string }>()
  const { login, ready, isAuthenticated } = useGuestAuth()
  const navigate = useNavigate()
  const tokenFromUrl = normalizeInviteCode(tokenParam || '')
  const [invite, setInvite] = useState<InvitePublic | null>(null)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [photos, setPhotos] = useState<Photo[]>([])
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploaderName, setUploaderName] = useState('')
  const [caption, setCaption] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [uploadMsg, setUploadMsg] = useState('')
  /** Shared message for the household (applied to primary guest on save). */
  const [householdMessage, setHouseholdMessage] = useState('')
  const [generalComments, setGeneralComments] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [showEmailPrompt, setShowEmailPrompt] = useState(false)
  const [baseline, setBaseline] = useState<FormSnapshot | null>(null)
  const [leaveBusy, setLeaveBusy] = useState(false)
  const householdMessageRef = useRef(householdMessage)
  householdMessageRef.current = householdMessage
  const generalCommentsRef = useRef(generalComments)
  generalCommentsRef.current = generalComments
  const contactEmailRef = useRef(contactEmail)
  contactEmailRef.current = contactEmail
  const emailInputRef = useRef<HTMLInputElement>(null)
  const saveSeq = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentSnapshot = useMemo(
    () => snapshotOf(drafts, contactEmail, householdMessage, generalComments),
    [drafts, contactEmail, householdMessage, generalComments],
  )
  const isDirty = Boolean(invite && baseline && !snapshotsEqual(baseline, currentSnapshot))
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty
  const blocker = useBlocker(isDirty)

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => {
    return () => {
      for (const url of previews) URL.revokeObjectURL(url)
    }
  }, [previews])

  function selectFiles(list: FileList | null) {
    if (!list?.length) return
    const next = Array.from(list).filter((f) => f.type.startsWith('image/'))
    for (const url of previews) URL.revokeObjectURL(url)
    setFiles(next)
    setPreviews(next.map((f) => URL.createObjectURL(f)))
    setUploadMsg('')
  }

  function clearSelectedFiles() {
    for (const url of previews) URL.revokeObjectURL(url)
    setFiles([])
    setPreviews([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(() => {
    if (!ready) return

    let cancelled = false
    async function load() {
      try {
        if (tokenFromUrl.length === 16) {
          await login(tokenFromUrl)
          if (!cancelled) navigate('/rsvp', { replace: true })
          return
        }
        if (!isAuthenticated) {
          if (!cancelled) navigate('/', { replace: true })
          return
        }
        const [data, photoList] = await Promise.all([api.getRsvp(), api.listInvitePhotos()])
        if (cancelled) return
        setInvite(data)
        setUploaderName(data.household_name)
        const next: Record<string, Draft> = {}
        for (const g of data.guests) {
          next[g.id] = {
            rsvp_status: g.rsvp_status,
          }
        }
        setDrafts(next)
        const primary = data.guests.find((g) => g.is_primary) || data.guests[0]
        const message = primary?.message || ''
        const email = data.email || ''
        const comments = data.general_comments || ''
        setHouseholdMessage(message)
        setGeneralComments(comments)
        setContactEmail(email)
        setBaseline(snapshotOf(next, email, message, comments))
        setShowEmailPrompt(!email.trim())
        setPhotos(photoList)
        setError('')
        setSaved(false)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load invitation')
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [ready, isAuthenticated, tokenFromUrl, login, navigate])

  async function saveRsvp(
    nextDrafts: Record<string, Draft>,
    currentInvite: InvitePublic,
  ): Promise<boolean> {
    const seq = ++saveSeq.current
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const primaryId = (currentInvite.guests.find((g) => g.is_primary) || currentInvite.guests[0]).id
      const payload = currentInvite.guests.map((g) => {
        const d = nextDrafts[g.id]
        const status: 'attending' | 'declined' =
          d.rsvp_status === 'attending' ? 'attending' : 'declined'
        return {
          guest_id: g.id,
          rsvp_status: status,
          dietary_notes: null,
          message: g.id === primaryId ? householdMessageRef.current || null : null,
        }
      })
      const updated = await api.submitRsvp(
        payload,
        contactEmailRef.current,
        generalCommentsRef.current,
      )
      if (seq !== saveSeq.current) return false
      setInvite(updated)
      const email = updated.email || contactEmailRef.current
      setContactEmail(email)
      const comments = updated.general_comments || generalCommentsRef.current
      setGeneralComments(comments)
      const synced: Record<string, Draft> = {}
      for (const g of updated.guests) {
        synced[g.id] = {
          rsvp_status: g.rsvp_status,
        }
      }
      setDrafts(synced)
      const primary = updated.guests.find((g) => g.is_primary) || updated.guests[0]
      const message = primary?.message || householdMessageRef.current
      setHouseholdMessage(message)
      setBaseline(snapshotOf(synced, email, message, comments))
      setSaved(true)
      if (!email.trim()) {
        setShowEmailPrompt(true)
      }
      return true
    } catch (err) {
      if (seq !== saveSeq.current) return false
      setError(err instanceof Error ? err.message : 'Could not save RSVP')
      return false
    } finally {
      if (seq === saveSeq.current) setSaving(false)
    }
  }

  function setAttending(guestId: string, attending: boolean) {
    if (!invite) return
    setDrafts((prev) => {
      const next = {
        ...prev,
        [guestId]: {
          ...prev[guestId],
          rsvp_status: (attending ? 'attending' : 'declined') as RsvpStatus,
        },
      }
      void saveRsvp(next, invite)
      return next
    })
  }

  function setAllDeclined() {
    if (!invite) return
    setDrafts((prev) => {
      const next = { ...prev }
      for (const g of invite.guests) {
        next[g.id] = { ...next[g.id], rsvp_status: 'declined' }
      }
      void saveRsvp(next, invite)
      return next
    })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!invite) return
    const anyDecided = invite.guests.some((g) => drafts[g.id]?.rsvp_status !== 'pending')
    if (!anyDecided) {
      setError(
        invite.guests.length === 1
          ? 'Please choose whether you will attend'
          : 'Select who is attending, or choose that no one can make it',
      )
      return
    }
    await saveRsvp(drafts, invite)
  }

  async function saveAndLeave() {
    if (!invite || blocker.state !== 'blocked') return
    setLeaveBusy(true)
    try {
      const anyDecided = invite.guests.some((g) => drafts[g.id]?.rsvp_status !== 'pending')
      if (!anyDecided) {
        setError(
          invite.guests.length === 1
            ? 'Please choose whether you will attend before saving'
            : 'Select who is attending, or choose that no one can make it, before saving',
        )
        blocker.reset?.()
        return
      }
      const ok = await saveRsvp(drafts, invite)
      if (ok) blocker.proceed?.()
      else blocker.reset?.()
    } finally {
      setLeaveBusy(false)
    }
  }

  async function onUpload(e: FormEvent) {
    e.preventDefault()
    if (files.length === 0) return
    setUploading(true)
    setUploadMsg('')
    const uploaded: Photo[] = []
    const failures: string[] = []
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        setUploadProgress(`Uploading ${i + 1} of ${files.length}…`)
        try {
          const form = new FormData()
          form.append('file', file)
          form.append('uploader_name', uploaderName || invite?.household_name || 'Guest')
          if (caption) form.append('caption', caption)
          const photo = await api.uploadPhoto(form)
          uploaded.push(photo)
        } catch (err) {
          failures.push(file.name)
          console.error(err)
        }
      }
      if (uploaded.length) {
        setPhotos((prev) => [...uploaded, ...prev])
      }
      clearSelectedFiles()
      setCaption('')
      if (failures.length && uploaded.length) {
        setUploadMsg(`Uploaded ${uploaded.length}. Failed: ${failures.join(', ')}`)
      } else if (failures.length) {
        setUploadMsg(`Upload failed: ${failures.join(', ')}`)
      } else {
        setUploadMsg(
          uploaded.length === 1
            ? 'Photo uploaded — it will appear in the album after approval.'
            : `${uploaded.length} photos uploaded — they will appear in the album after approval.`,
        )
      }
    } finally {
      setUploadProgress('')
      setUploading(false)
    }
  }

  function statusLabel(status: string) {
    if (status === 'approved') return 'Approved'
    if (status === 'rejected') return 'Not approved'
    return 'Pending review'
  }

  function statusBadgeClass(status: string) {
    if (status === 'approved') return 'badge badge-ok'
    if (status === 'rejected') return 'badge badge-danger'
    return 'badge badge-warn'
  }

  if (error && !invite) {
    return (
      <div className="section">
        <h1>Could not load invitation</h1>
        <p className="error">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/login')}>
          Enter invite code
        </button>
      </div>
    )
  }

  if (!ready || !invite) return <p className="muted section">Loading your invitation…</p>

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
        <p className="muted" style={{ marginTop: '-0.5rem' }}>
          (rain date August 22)
        </p>
        <p>{invite.party.description}</p>
      </div>

      <form className="panel stack" onSubmit={onSubmit}>
        <h2 style={{ fontSize: '1.8rem' }}>Your RSVP</h2>

        <div className="form-row">
          <label htmlFor="contact-email">Primary contact email</label>
          <input
            id="contact-email"
            ref={emailInputRef}
            type="email"
            autoComplete="email"
            value={contactEmail}
            onChange={(e) => {
              setContactEmail(e.target.value)
              setSaved(false)
            }}
            placeholder="you@example.com"
          />
          <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>
            We&apos;ll use this for party updates.
          </p>
        </div>

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
                disabled={saving}
              >
                Joyfully attending
              </button>
              <button
                type="button"
                className={`choice declined ${singleDraft.rsvp_status === 'declined' ? 'active' : ''}`}
                onClick={() => setAttending(single.id, false)}
                disabled={saving}
              >
                Regretfully decline
              </button>
            </div>
          </div>
        ) : (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>
              Select everyone from this invite who will be attending. Changes save automatically.
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
                      disabled={saving}
                    />
                    <span>{g.name}</span>
                  </label>
                )
              })}
            </div>
            <p className="rsvp-or muted">- OR -</p>
            <button
              type="button"
              className={`btn btn-secondary decline-all ${allDeclined ? 'active' : ''}`}
              onClick={setAllDeclined}
              disabled={saving}
            >
              No one from this invite can attend
            </button>
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

        <div className="form-row">
          <label htmlFor="general-comments">General comments (optional)</label>
          <textarea
            id="general-comments"
            rows={3}
            value={generalComments}
            onChange={(e) => {
              setGeneralComments(e.target.value)
              setSaved(false)
            }}
            placeholder="Anything else we should know…"
          />
        </div>

        {error && <p className="error">{error}</p>}
        {saving && <p className="muted">Saving…</p>}
        {!saving && saved && <p className="success">RSVP saved — thank you!</p>}
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save email & message'}
        </button>
      </form>

      <form className="panel form-grid" onSubmit={onUpload}>
        <h2 style={{ fontSize: '1.8rem', margin: 0 }}>Share photos of Magda</h2>
        <p className="muted" style={{ margin: 0 }}>
          Upload one or more pictures for the party slideshow. Approved photos also appear in the public album.
        </p>
        <div className="form-row">
          <label htmlFor="uploader">Your name</label>
          <input id="uploader" value={uploaderName} onChange={(e) => setUploaderName(e.target.value)} required />
        </div>
        <div className="form-row">
          <label htmlFor="caption">Caption (optional, applied to this batch)</label>
          <input id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div className="form-row">
          <label htmlFor="file">Photos</label>
          <input
            id="file"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(e) => selectFiles(e.target.files)}
          />
        </div>

        {previews.length > 0 && (
          <div>
            <p className="muted" style={{ margin: '0 0 0.75rem' }}>
              Ready to upload ({files.length})
            </p>
            <div className="photo-grid">
              {previews.map((src, i) => (
                <div key={src} className="photo-tile photo-tile-preview">
                  <img src={src} alt={files[i]?.name || 'Selected photo'} />
                  <div className="photo-meta">
                    <div className="photo-filename">{files[i]?.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {uploadProgress && <p className="muted">{uploadProgress}</p>}
        {uploadMsg && (
          <p className={uploadMsg.includes('failed') || uploadMsg.includes('Failed') || uploadMsg.includes('Only') ? 'error' : 'success'}>
            {uploadMsg}
          </p>
        )}
        <div className="inline-actions">
          <button className="btn btn-blush" type="submit" disabled={uploading || files.length === 0}>
            {uploading
              ? uploadProgress || 'Uploading…'
              : files.length > 1
                ? `Upload ${files.length} photos`
                : 'Upload photo'}
          </button>
          {files.length > 0 && !uploading && (
            <button type="button" className="btn btn-secondary" onClick={clearSelectedFiles}>
              Clear
            </button>
          )}
        </div>
      </form>

      {photos.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '0.35rem' }}>Your uploads</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Each photo shows its review status.
          </p>
          <div className="photo-grid">
            {photos.map((p) => (
              <div key={p.id} className="photo-tile">
                <img src={p.url || ''} alt={p.caption || 'Upload'} />
                <div className="photo-meta">
                  <span className={statusBadgeClass(p.status)}>{statusLabel(p.status)}</span>
                  {p.caption && <div style={{ marginTop: '0.35rem' }}>{p.caption}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showEmailPrompt && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-prompt-title"
        >
          <div className="modal-card panel">
            <h2 id="email-prompt-title" style={{ fontSize: '1.5rem', marginTop: 0 }}>
              One quick thing
            </h2>
            <p style={{ marginBottom: '1.25rem' }}>
              Please fill in your email address so we can keep you updated... future updates will be
              sent this way.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setShowEmailPrompt(false)
                requestAnimationFrame(() => emailInputRef.current?.focus())
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {blocker.state === 'blocked' && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-title"
        >
          <div className="modal-card panel">
            <h2 id="unsaved-title" style={{ fontSize: '1.5rem', marginTop: 0 }}>
              Unsaved changes
            </h2>
            <p style={{ marginBottom: '1.25rem' }}>
              Would you like to save your changes before leaving?
            </p>
            <div className="inline-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={leaveBusy || saving}
                onClick={() => void saveAndLeave()}
              >
                {leaveBusy || saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={leaveBusy || saving}
                onClick={() => blocker.proceed?.()}
              >
                Leave without saving
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={leaveBusy || saving}
                onClick={() => blocker.reset?.()}
              >
                Stay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
