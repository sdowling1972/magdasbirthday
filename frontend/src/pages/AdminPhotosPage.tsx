import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Photo, PhotoStatus } from '../types'

export function AdminPhotosPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [filter, setFilter] = useState<PhotoStatus | ''>('pending')
  const [error, setError] = useState('')

  async function load() {
    try {
      setPhotos(await api.adminPhotos(filter || undefined))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load photos')
    }
  }

  useEffect(() => {
    load()
  }, [filter])

  async function setStatus(id: string, status: PhotoStatus) {
    await api.updatePhotoStatus(id, status)
    await load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this photo permanently?')) return
    await api.deletePhoto(id)
    await load()
  }

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Photos</h1>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Approve photos for the public album and party slideshow.
          </p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value as PhotoStatus | '')}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="">All</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}

      {photos.length === 0 ? (
        <p className="empty panel">No photos in this filter.</p>
      ) : (
        <div className="photo-grid">
          {photos.map((p) => (
            <div key={p.id} className="stack">
              <div className="photo-tile">
                <img src={p.url || ''} alt={p.caption || p.original_filename} />
                <div className="photo-meta">
                  <div>{p.uploader_name}</div>
                  {p.caption && <div>{p.caption}</div>}
                </div>
              </div>
              <div className="inline-actions">
                {p.status !== 'approved' && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(p.id, 'approved')}>
                    Approve
                  </button>
                )}
                {p.status !== 'rejected' && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setStatus(p.id, 'rejected')}>
                    Reject
                  </button>
                )}
                <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>
                  Delete
                </button>
              </div>
              <span className={`badge badge-${p.status === 'approved' ? 'ok' : p.status === 'rejected' ? 'danger' : 'warn'}`}>
                {p.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
