import { useEffect, useRef, useState } from 'react'
import type { TouchEvent } from 'react'
import { api } from '../api'
import type { Photo } from '../types'

const SWIPE_THRESHOLD_PX = 50

export function AlbumPage() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const [error, setError] = useState('')
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  useEffect(() => {
    api
      .getAlbum()
      .then(setPhotos)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load album'))
  }, [])

  const active = activeIndex === null ? null : photos[activeIndex] || null
  const canPrev = activeIndex !== null && activeIndex > 0
  const canNext = activeIndex !== null && activeIndex < photos.length - 1

  function showPrev() {
    setActiveIndex((i) => (i !== null && i > 0 ? i - 1 : i))
  }

  function showNext() {
    setActiveIndex((i) => (i !== null && i < photos.length - 1 ? i + 1 : i))
  }

  useEffect(() => {
    if (activeIndex === null) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setActiveIndex(null)
      if (e.key === 'ArrowLeft') showPrev()
      if (e.key === 'ArrowRight') showNext()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, photos.length])

  function onTouchStart(e: TouchEvent) {
    const touch = e.changedTouches[0]
    touchStartX.current = touch.clientX
    touchStartY.current = touch.clientY
  }

  function onTouchEnd(e: TouchEvent) {
    if (touchStartX.current === null || touchStartY.current === null) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - touchStartX.current
    const dy = touch.clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null

    // Ignore mostly-vertical gestures
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return
    if (dx > 0) showPrev()
    else showNext()
  }

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

      {active && activeIndex !== null && (
        <div
          className="album-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Photo viewer"
          onClick={() => setActiveIndex(null)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <button
            type="button"
            className="album-nav album-nav-prev"
            aria-label="Previous photo"
            disabled={!canPrev}
            onClick={(e) => {
              e.stopPropagation()
              showPrev()
            }}
          >
            ‹
          </button>

          <div className="album-lightbox-inner" onClick={(e) => e.stopPropagation()}>
            <img src={active.url || ''} alt={active.caption || 'Photo'} draggable={false} />
            <p>
              {active.uploader_name}
              {active.caption ? ` — ${active.caption}` : ''}
            </p>
            <p className="album-lightbox-count muted">
              {activeIndex + 1} / {photos.length}
            </p>
            <button type="button" className="btn btn-secondary" onClick={() => setActiveIndex(null)}>
              Close
            </button>
          </div>

          <button
            type="button"
            className="album-nav album-nav-next"
            aria-label="Next photo"
            disabled={!canNext}
            onClick={(e) => {
              e.stopPropagation()
              showNext()
            }}
          >
            ›
          </button>
        </div>
      )}
    </div>
  )
}
