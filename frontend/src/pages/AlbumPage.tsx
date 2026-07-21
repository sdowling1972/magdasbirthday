import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Photo } from '../types'

export function AlbumPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [active, setActive] = useState<Photo | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getAlbum()
      .then(setPhotos)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load album'))
  }, [])

  return (
    <div className="section">
      <div className="section-head">
        <h2>Photo album</h2>
        <p>Moments with Magda, shared by friends and family.</p>
      </div>

      {error && <p className="error">{error}</p>}

      {photos.length === 0 ? (
        <p className="empty panel">No approved photos yet — check back soon.</p>
      ) : (
        <div className="photo-grid">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="photo-tile"
              style={{ border: 'none', padding: 0, cursor: 'pointer', animationDelay: `${i * 40}ms` }}
              onClick={() => setActive(p)}
            >
              <img src={p.url || ''} alt={p.caption || 'Album photo'} />
              <div className="photo-meta">
                <div>{p.uploader_name}</div>
                {p.caption && <div>{p.caption}</div>}
              </div>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActive(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(26, 42, 58, 0.82)',
            display: 'grid',
            placeItems: 'center',
            padding: '1.5rem',
            zIndex: 50,
            animation: 'fadeIn 0.2s ease both',
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 'min(900px, 100%)', textAlign: 'center' }}>
            <img
              src={active.url || ''}
              alt={active.caption || 'Photo'}
              style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 4 }}
            />
            <p style={{ color: 'white', marginTop: '0.75rem' }}>
              {active.uploader_name}
              {active.caption ? ` — ${active.caption}` : ''}
            </p>
            <button type="button" className="btn btn-secondary" onClick={() => setActive(null)} style={{ color: 'white' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
