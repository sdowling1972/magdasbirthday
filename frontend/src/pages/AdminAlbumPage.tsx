import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { PhotoLightbox } from '../components/PhotoLightbox'
import type { Photo } from '../types'

export function AdminAlbumPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .adminPhotos('approved')
      .then(setPhotos)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load album'))
  }, [])

  return (
    <div>
      <div className="page-title">
        <div>
          <h1>Photo album</h1>
          <p className="muted" style={{ margin: '0.35rem 0 0' }}>
            Approved photos as guests see them in the public album.
          </p>
        </div>
        <Link to="/admin/photos" className="btn btn-secondary">
          Manage photos
        </Link>
      </div>

      {error && <p className="error">{error}</p>}

      {photos.length === 0 ? (
        <p className="empty panel">No approved photos yet.</p>
      ) : (
        <div className="photo-grid">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="photo-tile"
              style={{ border: 'none', padding: 0, cursor: 'pointer', animationDelay: `${i * 40}ms` }}
              onClick={() => setActiveIndex(i)}
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

      {activeIndex !== null && (
        <PhotoLightbox
          photos={photos}
          activeIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
          onChangeIndex={setActiveIndex}
        />
      )}
    </div>
  )
}
