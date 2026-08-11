import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { Photo } from '../types'

export type SlideshowDelay = 1 | 3 | 5 | 10

const DELAY_OPTIONS: SlideshowDelay[] = [1, 3, 5, 10]

type AlbumSlideshowProps = {
  source: 'public' | 'admin'
  inviteId?: string | null
  onClose: () => void
}

function preloadUrl(url: string | null | undefined, cache: Set<string>) {
  if (!url || cache.has(url)) return
  const img = new Image()
  img.decoding = 'async'
  img.onload = () => {
    cache.add(url)
  }
  img.src = url
}

function shufflePhotos(photos: Photo[]): Photo[] {
  const next = [...photos]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

/** Rotate so `currentId` is first, keeping relative shuffle order. */
function rotateToCurrent(photos: Photo[], currentId: string | undefined): Photo[] {
  if (!currentId || photos.length === 0) return photos
  const idx = photos.findIndex((p) => p.id === currentId)
  if (idx <= 0) return photos
  return [...photos.slice(idx), ...photos.slice(0, idx)]
}

export function AlbumSlideshow({ source, inviteId = null, onClose }: AlbumSlideshowProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const orderedRef = useRef<Photo[]>([])
  const hideTimer = useRef<number | null>(null)
  const indexRef = useRef(0)
  const photosRef = useRef<Photo[]>([])
  const plannedNextRef = useRef<number | null>(null)
  const loadedUrlsRef = useRef(new Set<string>())
  const closedRef = useRef(false)
  const onCloseRef = useRef(onClose)

  const [photos, setPhotos] = useState<Photo[]>([])
  const [index, setIndex] = useState(0)
  const [plannedNext, setPlannedNext] = useState<number | null>(null)
  const [delay, setDelay] = useState<SlideshowDelay>(5)
  const [random, setRandom] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [controlsVisible, setControlsVisible] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  indexRef.current = index
  photosRef.current = photos
  plannedNextRef.current = plannedNext
  onCloseRef.current = onClose

  function revealControls() {
    setControlsVisible(true)
    if (hideTimer.current) window.clearTimeout(hideTimer.current)
    hideTimer.current = window.setTimeout(() => setControlsVisible(false), 3500)
  }

  function nextIndex(fromIndex: number): number {
    const list = photosRef.current
    if (list.length <= 1) return fromIndex
    return (fromIndex + 1) % list.length
  }

  function planAndPreload(fromIndex: number) {
    const list = photosRef.current
    if (list.length === 0) {
      setPlannedNext(null)
      return
    }
    const next = nextIndex(fromIndex)
    setPlannedNext(next)
    preloadUrl(list[next]?.url, loadedUrlsRef.current)
    if (list.length > 2) {
      preloadUrl(list[nextIndex(next)]?.url, loadedUrlsRef.current)
    }
  }

  function showIndex(nextIdx: number) {
    const list = photosRef.current
    const url = list[nextIdx]?.url
    setIndex(nextIdx)
    if (url && loadedUrlsRef.current.has(url)) {
      setImageLoaded(true)
    } else {
      setImageLoaded(false)
    }
    planAndPreload(nextIdx)
  }

  function setPlaylist(nextPhotos: Photo[], startIndex: number) {
    photosRef.current = nextPhotos
    setPhotos(nextPhotos)
    indexRef.current = startIndex
    setIndex(startIndex)
    const url = nextPhotos[startIndex]?.url
    if (url && loadedUrlsRef.current.has(url)) {
      setImageLoaded(true)
    }
    planAndPreload(startIndex)
  }

  function advance(step: number) {
    const list = photosRef.current
    if (list.length === 0) return

    if (step === 1) {
      const next = plannedNextRef.current ?? nextIndex(indexRef.current)
      showIndex(next)
      return
    }

    showIndex((indexRef.current + step + list.length) % list.length)
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
    const fetchPage = source === 'public' ? api.getAlbum : api.adminAlbum
    fetchPage(1, 2000, inviteId)
      .then((data) => {
        if (cancelled) return
        orderedRef.current = data.items
        photosRef.current = data.items
        setPhotos(data.items)
        setIndex(0)
        const firstUrl = data.items[0]?.url
        if (firstUrl) preloadUrl(firstUrl, loadedUrlsRef.current)
        if (data.items.length > 0) {
          const next = data.items.length > 1 ? 1 : 0
          setPlannedNext(next)
          preloadUrl(data.items[next]?.url, loadedUrlsRef.current)
        }
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
  }, [source, inviteId])

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
        return
      }
      revealControls()
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault()
        setPlaying((p) => !p)
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
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current)
    }
  }, [])

  function applyRandom(enabled: boolean) {
    setRandom(enabled)
    const currentId = photosRef.current[indexRef.current]?.id
    if (enabled) {
      const shuffled = rotateToCurrent(shufflePhotos(orderedRef.current), currentId)
      setPlaylist(shuffled, 0)
      return
    }
    const chronological = [...orderedRef.current]
    const nextIndexInOrder = currentId
      ? chronological.findIndex((p) => p.id === currentId)
      : 0
    setPlaylist(chronological, nextIndexInOrder < 0 ? 0 : nextIndexInOrder)
  }

  const active = photos[index]
  const preloadPhoto = plannedNext != null ? photos[plannedNext] : null

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
          {preloadPhoto?.url && preloadPhoto.id !== active.id && (
            <img
              src={preloadPhoto.url}
              alt=""
              className="album-slideshow-preload"
              aria-hidden="true"
              onLoad={() => {
                if (preloadPhoto.url) loadedUrlsRef.current.add(preloadPhoto.url)
              }}
            />
          )}

          <div className="album-slideshow-stage">
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
              onLoad={() => {
                if (active.url) loadedUrlsRef.current.add(active.url)
                setImageLoaded(true)
              }}
            />
          </div>

          <div className="album-slideshow-caption">
            <p>
              {active.uploader_name}
              {active.caption ? ` — ${active.caption}` : ''}
            </p>
            <p className="album-slideshow-count">
              {index + 1} / {photos.length}
              {random ? ' · shuffled' : ''}
            </p>
          </div>

          <div className="album-slideshow-controls">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                advance(-1)
                revealControls()
              }}
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
              onClick={() => {
                advance(1)
                revealControls()
              }}
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
                onChange={(e) => {
                  applyRandom(e.target.checked)
                  revealControls()
                }}
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
