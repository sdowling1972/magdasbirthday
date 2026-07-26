import { useEffect, useState } from 'react'
import { api } from '../api'
import { AlbumPaginationControls } from '../components/AlbumPaginationControls'
import { PhotoLightbox } from '../components/PhotoLightbox'
import { useAlbumPagination } from '../hooks/useAlbumPagination'
import type { Photo } from '../types'

export function AlbumPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const pagination = useAlbumPagination(photos, 15)

  useEffect(() => {
    api
      .getAlbum()
      .then(setPhotos)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load album'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="section guest-page">
      <div className="section-head">
        <h2>Photo album</h2>
        <p>Moments with Magda, shared by friends and family.</p>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <div className="loading-state panel" role="status" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <p>Loading photos…</p>
        </div>
      ) : photos.length === 0 ? (
        <p className="empty panel">No approved photos yet — check back soon.</p>
      ) : (
        <>
          <AlbumPaginationControls
            pageSize={pagination.pageSize}
            page={pagination.page}
            pageCount={pagination.pageCount}
            total={pagination.total}
            onPageSizeChange={pagination.changePageSize}
            onPageChange={pagination.goToPage}
          />
          <div className="photo-grid guest-photo-grid">
            {pagination.pageItems.map((p, i) => {
              const globalIndex = pagination.pageStartIndex + i
              return (
                <button
                  key={p.id}
                  type="button"
                  className="photo-tile"
                  style={{
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    animationDelay: `${i * 40}ms`,
                  }}
                  onClick={() => setActiveIndex(globalIndex)}
                >
                  <img src={p.url || ''} alt={p.caption || 'Album photo'} />
                  <div className="photo-meta">
                    <div>{p.uploader_name}</div>
                    {p.caption && <div>{p.caption}</div>}
                  </div>
                </button>
              )
            })}
          </div>
          <AlbumPaginationControls
            pageSize={pagination.pageSize}
            page={pagination.page}
            pageCount={pagination.pageCount}
            total={pagination.total}
            onPageSizeChange={pagination.changePageSize}
            onPageChange={pagination.goToPage}
          />
        </>
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
