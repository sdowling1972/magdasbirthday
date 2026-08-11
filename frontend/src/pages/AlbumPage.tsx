import { useState } from 'react'
import { AlbumInviteFilter } from '../components/AlbumInviteFilter'
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

type AlbumPageProps = {
  /** When true, render inside the guest app chrome; public page uses its own layout. */
  guestChrome?: boolean
}

export function AlbumPage({ guestChrome = true }: AlbumPageProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [slideshowOpen, setSlideshowOpen] = useState(false)
  const [inviteId, setInviteId] = useState<string | null>(null)
  const album = usePagedAlbum('public', 15, inviteId)
  const skeletonCount = album.pageSize === 'all' ? 15 : album.pageSize
  const hasResults = album.total > 0 || album.loading

  function changePageSize(size: Parameters<typeof album.changePageSize>[0]) {
    setActiveIndex(null)
    album.changePageSize(size)
  }

  function goToPage(page: number) {
    setActiveIndex(null)
    album.goToPage(page)
  }

  function changeInviteFilter(next: string | null) {
    setActiveIndex(null)
    setInviteId(next)
  }

  return (
    <div className={`section${guestChrome ? ' guest-page' : ''}`}>
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

      <div className="album-toolbar">
        <AlbumInviteFilter value={inviteId} onChange={changeInviteFilter} />
      </div>

      {album.error && <p className="error">{album.error}</p>}

      {album.loading && album.photos.length === 0 && album.total === 0 && !album.error ? (
        <AlbumSkeletonGrid count={skeletonCount} guest={guestChrome} />
      ) : album.total === 0 && !album.loading ? (
        <p className="empty panel">
          {inviteId
            ? 'No approved photos from this guest yet.'
            : 'No approved photos yet — check back soon.'}
        </p>
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
            <AlbumSkeletonGrid count={skeletonCount} guest={guestChrome} />
          ) : (
            <div className={`photo-grid${guestChrome ? ' guest-photo-grid' : ''}`}>
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
          {hasResults && (
            <AlbumPaginationControls
              pageSize={album.pageSize}
              page={album.page}
              pageCount={album.pageCount}
              total={album.total}
              onPageSizeChange={changePageSize}
              onPageChange={goToPage}
            />
          )}
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
        <AlbumSlideshow
          source="public"
          inviteId={inviteId}
          onClose={() => setSlideshowOpen(false)}
        />
      )}
    </div>
  )
}
