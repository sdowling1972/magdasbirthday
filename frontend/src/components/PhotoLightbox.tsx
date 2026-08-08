import { useEffect, useRef } from 'react'
import type { TouchEvent } from 'react'
import type { Photo } from '../types'

const SWIPE_THRESHOLD_PX = 50

type PhotoLightboxProps = {
  photos: Photo[]
  activeIndex: number
  /** Global offset of the first photo in `photos` (for paginated albums). */
  indexOffset?: number
  /** Global album total; defaults to `photos.length`. */
  totalCount?: number
  onClose: () => void
  onChangeIndex: (index: number) => void
}

export function PhotoLightbox({
  photos,
  activeIndex,
  indexOffset = 0,
  totalCount,
  onClose,
  onChangeIndex,
}: PhotoLightboxProps) {
  const active = photos[activeIndex]
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const canPrev = activeIndex > 0
  const canNext = activeIndex < photos.length - 1
  const displayTotal = totalCount ?? photos.length
  const displayIndex = indexOffset + activeIndex + 1

  function showPrev() {
    if (activeIndex > 0) onChangeIndex(activeIndex - 1)
  }

  function showNext() {
    if (activeIndex < photos.length - 1) onChangeIndex(activeIndex + 1)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && activeIndex > 0) onChangeIndex(activeIndex - 1)
      if (e.key === 'ArrowRight' && activeIndex < photos.length - 1) onChangeIndex(activeIndex + 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, photos.length, onClose, onChangeIndex])

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
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) < Math.abs(dy)) return
    if (dx > 0) showPrev()
    else showNext()
  }

  if (!active) return null

  return (
    <div
      className="album-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      onClick={onClose}
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
          {displayIndex} / {displayTotal}
        </p>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
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
  )
}
