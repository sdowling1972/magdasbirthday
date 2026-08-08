import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlbumPaginationControls } from '../components/AlbumPaginationControls'
import { PhotoLightbox } from '../components/PhotoLightbox'
import { PhotoTile } from '../components/PhotoTile'
import { usePagedAlbum } from '../hooks/usePagedAlbum'

function AlbumSkeletonGrid({ count }: { count: number }) {
  return (
    <div className="photo-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="photo-tile photo-tile-skeleton">
          <div className="photo-tile-placeholder">
            <span className="spinner" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function AdminAlbumPage() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const album = usePagedAlbum('admin', 15)
  const skeletonCount = album.pageSize === 'all' ? 15 : album.pageSize

  function changePageSize(size: Parameters<typeof album.changePageSize>[0]) {
    setActiveIndex(null)
    album.changePageSize(size)
  }

  function goToPage(page: number) {
    setActiveIndex(null)
    album.goToPage(page)
  }

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

      {album.error && <p className="error">{album.error}</p>}

      {album.loading && album.photos.length === 0 && album.total === 0 && !album.error ? (
        <AlbumSkeletonGrid count={skeletonCount} />
      ) : album.total === 0 && !album.loading ? (
        <p className="empty panel">No approved photos yet.</p>
      ) : (
        <>
          <AlbumPaginationControls
            pageSize={album.pageSize}
            page={album.page}
            pageCount={album.pageCount}
            total={album.total}
            onPageSizeChange={changePageSize}
            onPageChange={goToPage}
          />
          {album.loading ? (
            <AlbumSkeletonGrid count={skeletonCount} />
          ) : (
            <div className="photo-grid">
              {album.photos.map((p, i) => (
                <PhotoTile
                  key={p.id}
                  photo={p}
                  animationDelay={`${i * 40}ms`}
                  onClick={() => setActiveIndex(i)}
                />
              ))}
            </div>
          )}
          <AlbumPaginationControls
            pageSize={album.pageSize}
            page={album.page}
            pageCount={album.pageCount}
            total={album.total}
            onPageSizeChange={changePageSize}
            onPageChange={goToPage}
          />
        </>
      )}

      {activeIndex !== null && (
        <PhotoLightbox
          photos={album.photos}
          activeIndex={activeIndex}
          indexOffset={album.pageStartIndex}
          totalCount={album.total}
          onClose={() => setActiveIndex(null)}
          onChangeIndex={setActiveIndex}
        />
      )}
    </div>
  )
}
