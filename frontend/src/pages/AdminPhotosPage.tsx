import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { Photo, PhotoStatus } from '../types'

type Draft = {
  uploader_name: string
  caption: string
  status: PhotoStatus
  saving: boolean
  error: string
}

function draftFromPhoto(p: Photo): Draft {
  return {
    uploader_name: p.uploader_name || '',
    caption: p.caption || '',
    status: p.status,
    saving: false,
    error: '',
  }
}

function isDirty(draft: Draft, photo: Photo): boolean {
  return (
    draft.uploader_name !== (photo.uploader_name || '') ||
    draft.caption !== (photo.caption || '') ||
    draft.status !== photo.status
  )
}

export function AdminPhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [filter, setFilter] = useState<PhotoStatus | ''>('pending')
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})

  async function load() {
    try {
      const next = await api.adminPhotos(filter || undefined)
      setPhotos(next)
      setDrafts(Object.fromEntries(next.map((p) => [p.id, draftFromPhoto(p)])))
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photos')
    }
  }

  useEffect(() => {
    load()
  }, [filter])

  function updateDraft(id: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))
  }

  async function save(id: string) {
    const draft = drafts[id]
    const photo = photos.find((p) => p.id === id)
    if (!draft || !photo || !isDirty(draft, photo)) return

    const name = draft.uploader_name.trim()
    if (!name) {
      updateDraft(id, { error: 'Display name is required' })
      return
    }

    updateDraft(id, { saving: true, error: '' })
    try {
      // Always send the full editable set so partial caption-only saves
      // don't 422 against APIs that still require `status`.
      await api.updatePhoto(id, {
        status: draft.status,
        caption: draft.caption.trim() || null,
        uploader_name: name,
      })
      await load()
    } catch (err) {
      updateDraft(id, {
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to save',
      })
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this photo permanently? This cannot be undone.')) return
    try {
      await api.deletePhoto(id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete photo')
    }
  }

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Photos</h1>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Edit display name, caption, and approval status, or remove photos.
          </p>
        </div>
        <div className="inline-actions">
          <Link to="/admin/album" className="btn btn-secondary">
            View album
          </Link>
          <select value={filter} onChange={(e) => setFilter(e.target.value as PhotoStatus | '')}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="">All</option>
          </select>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {photos.length === 0 ? (
        <p className="empty panel">No photos in this filter.</p>
      ) : (
        <div className="photo-grid">
          {photos.map((p) => {
            const draft = drafts[p.id]
            if (!draft) return null
            const dirty = isDirty(draft, p)

            return (
              <div key={p.id} className="stack panel" style={{ padding: '0.85rem' }}>
                <div className="photo-tile">
                  <img src={p.url || ''} alt={p.caption || p.original_filename} />
                  <div className="photo-meta">
                    <div>{p.uploader_name}</div>
                    {p.caption && <div>{p.caption}</div>}
                    <div className="muted">{p.original_filename}</div>
                  </div>
                </div>

                <label className="stack" style={{ gap: '0.35rem' }}>
                  <span className="muted">Display name</span>
                  <input
                    type="text"
                    value={draft.uploader_name}
                    onChange={(e) => updateDraft(p.id, { uploader_name: e.target.value })}
                    placeholder="Who shared this photo"
                  />
                </label>

                <label className="stack" style={{ gap: '0.35rem' }}>
                  <span className="muted">Caption</span>
                  <textarea
                    rows={2}
                    value={draft.caption}
                    onChange={(e) => updateDraft(p.id, { caption: e.target.value })}
                    placeholder="Optional caption shown on the album"
                  />
                </label>

                <label className="stack" style={{ gap: '0.35rem' }}>
                  <span className="muted">Status</span>
                  <select
                    value={draft.status}
                    onChange={(e) => updateDraft(p.id, { status: e.target.value as PhotoStatus })}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </label>

                {draft.error && <p className="error">{draft.error}</p>}

                <div className="inline-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={!dirty || draft.saving}
                    onClick={() => save(p.id)}
                  >
                    {draft.saving ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
