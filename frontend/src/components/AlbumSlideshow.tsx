import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { Photo } from '../types'

export type SlideshowDelay = 1 | 3 | 5 | 10

const DELAY_OPTIONS: SlideshowDelay[] = [1, 3, 5, 10]

type AlbumSlideshowProps = {
  source: 'guest' | 'admin'
  onClose: () => void
}

export function AlbumSlideshow({ source, onClose }: AlbumSlideshowProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const orderedRef = useRef<Photo[]>([])
  const hideTimer = useRef<number | null>(null)
  const indexRef = useRef(0)
  const photosRef = useRef<Photo[]>([])
  const randomRef = useRef(false)
  const closedRef = useRef(false)
  const onCloseRef = useRef(onClose)

  const [photos, setPhotos] = useState<Photo[]>([])
  const [index, setIndex] = useState(0)
  const [delay, setDelay] = useState<SlideshowDelay>(5)
  const [random, setRandom] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [controlsVisible, setControlsVisible] = useState(true)
  const [imageLoaded, setImageLoaded] = useState(false)

  indexRef.current = index
  photosRef.current = photos
  randomRef.current = random
  onCloseRef.current = onClose

  function revealControls() {
    setControlsVisible(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 3500)
  }

  function advance(step: number) {
    const list = photosRef.current
    if (list.length === 0) return

    if (randomRef.current && step === 1 && list.length > 1) {
      let next = Math.floor(Math.random() * list.length)
      while (next === indexRef.current) {
        next = Math.floor(Math.random() * list.length)
      }
      setIndex(next)
    } else {
      setIndex((i) => (i + step + list.length) % list.length)
    }
    revealControls()
  }

  async function closeSlideshow() {
    if (closedRef.current) return
    closedRef.current = true
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch {
        /* ignore */
      }
    }
    onCloseRef.current()
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const fetchPage = source === 'guest' ? api.getAlbum : api.adminAlbum
    fetchPage(1, 2000)
      .then((data) => {
        if (cancelled) return
        orderedRef.current = data.items
        setPhotos(data.items)
        setIndex(0)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load slideshow')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [source])

  useEffect(() => {
    const el = rootRef.current
    let activeFullscreen = false
    if (el?.requestFullscreen) {
      void el
        .requestFullscreen()
        .then(() => {
          activeFullscreen = true
        })
        .catch(() => undefined)
    }

    function onFullscreenChange() {
      if (activeFullscreen && !document.fullscreenElement) {
        void closeSlideshow()
      }
    }

    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      if (document.fullscreenElement) {
        void document.exitFullscreen().catch(() => undefined)
      }
    }
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        void closeSlideshow()
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault()
        setPlaying((p) => !p)
        revealControls()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        advance(1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        advance(-1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!playing || photos.length < 2 || loading) return
    const id = window.setTimeout(() => advance(1), delay * 1000)
    return () => window.clearTimeout(id)
  }, [playing, photos.length, loading, delay, index])

  useEffect(() => {
    setImageLoaded(false)
  }, [index, photos])

  useEffect(() => {
    if (photos.length < 2) return
    const nextIndex = random
      ? Math.floor(Math.random() * photos.length)
      : (index + 1) % photos.length
    const next = photos[nextIndex]
    if (!next?.url) return
    const img = new Image()
    img.src = next.url
  }, [index, photos, random])

  useEffect(() => {
    revealControls()
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [])

  function applyRandom(enabled: boolean) {
    setRandom(enabled)
    if (!enabled) {
      const base = orderedRef.current
      const currentId = photosRef.current[indexRef.current]?.id
      setPhotos([...base])
      const nextIndex = currentId ? base.findIndex((p) => p.id === currentId) : 0
      setIndex(nextIndex < 0 ? 0 : nextIndex)
    }
    revealControls()
  }

  const active = photos[index]

  return (
    <div
      ref={rootRef}
      className={`album-slideshow${controlsVisible ? ' controls-visible' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Photo slideshow"
      onMouseMove={revealControls}
      onTouchStart={revealControls}
    >
      {loading ? (
        <div className="album-slideshow-status">
          <span className="spinner" aria-hidden="true" />
          <p>Loading slideshow…</p>
        </div>
      ) : error ? (
        <div className="album-slideshow-status">
          <p className="error">{error}</p>
          <button type="button" className="btn btn-secondary" onClick={() => void closeSlideshow()}>
            Close
          </button>
        </div>
      ) : photos.length === 0 || !active ? (
        <div className="album-slideshow-status">
          <p>No approved photos to show.</p>
          <button type="button" className="btn btn-secondary" onClick={() => void closeSlideshow()}>
            Close
          </button>
        </div>
      ) : (
        <>
          <div className="album-slideshow-stage" key={active.id}>
            {!imageLoaded && (
              <div className="album-slideshow-placeholder" aria-hidden="true">
                <span className="spinner" />
              </div>
            )}
            <img
              src={active.url || ''}
              alt={active.caption || 'Slideshow photo'}
              className={imageLoaded ? 'is-loaded' : undefined}
              draggable={false}
              onLoad={() => setImageLoaded(true)}
            />
          </div>

          <div className="album-slideshow-caption">
            <p>
              {active.uploader_name}
              {active.caption ? ` — ${active.caption}` : ''}
            </p>
            <p className="album-slideshow-count">
              {index + 1} / {photos.length}
              {random ? ' · random' : ''}
            </p>
          </div>

          <div className="album-slideshow-controls">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => advance(-1)}
              aria-label="Previous photo"
            >
              Previous
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setPlaying((p) => !p)
                revealControls()
              }}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => advance(1)}
              aria-label="Next photo"
            >
              Next
            </button>

            <label className="album-slideshow-field">
              <span>Delay</span>
              <select
                value={delay}
                onChange={(e) => {
                  setDelay(Number(e.target.value) as SlideshowDelay)
                  revealControls()
                }}
              >
                {DELAY_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds}s
                  </option>
                ))}
              </select>
            </label>

            <label className="album-slideshow-random">
              <input
                type="checkbox"
                checked={random}
                onChange={(e) => applyRandom(e.target.checked)}
              />
              <span>Random</span>
            </label>

            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void closeSlideshow()}>
              Exit
            </button>
          </div>
        </>
      )}
    </div>
  )
}
