import { useState } from 'react'
import { AlbumPaginationControls } from '../components/AlbumPaginationControls'
import { AlbumSlideshow } from '../components/AlbumSlideshow'
import { PhotoLightbox } from '../components/PhotoLightbox'
import { PhotoTile } from '../components/PhotoTile'
import { usePagedAlbum } from '../hooks/usePagedAlbum'

function AlbumSkeletonGrid({ count, guest }: { count: number; guest?: boolean }) {
  return (
    <div className={`photo-grid${guest ? ' guest-photo-grid' : ''}`} aria-hidden="true">
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

export function AlbumPage() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [slideshowOpen, setSlideshowOpen] = useState(false)
  const album = usePagedAlbum('guest', 15)
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
    <div className="section guest-page">
      <div className="section-head album-section-head">
        <div>
          <h2>Photo album</h2>
          <p>Moments with Magda, shared by friends and family.</p>
        </div>
        {album.total > 0 && (
          <button
            type="button"
            className="btn btn-blush"
            onClick={() => {
              setActiveIndex(null)
              setSlideshowOpen(true)
            }}
          >
            Slideshow
          </button>
        )}
      </div>

      {album.error && <p className="error">{album.error}</p>}

      {album.loading && album.photos.length === 0 && album.total === 0 && !album.error ? (
        <AlbumSkeletonGrid count={skeletonCount} guest />
      ) : album.total === 0 && !album.loading ? (
        <p className="empty panel">No approved photos yet — check back soon.</p>
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
            <AlbumSkeletonGrid count={skeletonCount} guest />
          ) : (
            <div className="photo-grid guest-photo-grid">
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

      {slideshowOpen && (
        <AlbumSlideshow source="guest" onClose={() => setSlideshowOpen(false)} />
      )}
    </div>
  )
}
