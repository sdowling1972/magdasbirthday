import { useEffect, useState } from 'react'
import { api } from '../api'
import { PhotoLightbox } from '../components/PhotoLightbox'
import type { Photo } from '../types'

export function AlbumPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .getAlbum()
      .then(setPhotos)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load album'))
  }, [])

  return (
    <div className="section guest-page">
      <div className="section-head">
        <h2>Photo album</h2>
        <p>Moments with Magda, shared by friends and family.</p>
      </div>

      {error && <p className="error">{error}</p>}

      {photos.length === 0 ? (
        <p className="empty panel">No approved photos yet — check back soon.</p>
      ) : (
        <div className="photo-grid guest-photo-grid">
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
