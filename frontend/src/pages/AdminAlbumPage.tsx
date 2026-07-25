import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { AlbumPaginationControls } from '../components/AlbumPaginationControls'
import { PhotoLightbox } from '../components/PhotoLightbox'
import { useAlbumPagination } from '../hooks/useAlbumPagination'
import type { Photo } from '../types'

export function AdminAlbumPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [error, setError] = useState('')
  const pagination = useAlbumPagination(photos, 15)

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
        <>
          <AlbumPaginationControls
            pageSize={pagination.pageSize}
            page={pagination.page}
            pageCount={pagination.pageCount}
            total={pagination.total}
            onPageSizeChange={pagination.changePageSize}
            onPageChange={pagination.goToPage}
          />
          <div className="photo-grid">
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
