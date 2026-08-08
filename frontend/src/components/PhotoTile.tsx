import { useState } from 'react'
import type { Photo } from '../types'

type PhotoTileProps = {
  photo: Photo
  onClick: () => void
  animationDelay?: string
}

export function PhotoTile({ photo, onClick, animationDelay }: PhotoTileProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)

  return (
    <button
      type="button"
      className="photo-tile"
      style={{
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        animationDelay,
      }}
      onClick={onClick}
    >
      {!loaded && !failed && (
        <div className="photo-tile-placeholder" aria-hidden="true">
          <span className="spinner" />
        </div>
      )}
      {photo.url && !failed ? (
        <img
          ref={(img) => {
            if (img?.complete && img.naturalWidth > 0) setLoaded(true)
          }}
          src={photo.url}
          alt={photo.caption || 'Album photo'}
          loading="lazy"
          decoding="async"
          className={loaded ? 'is-loaded' : undefined}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      ) : (
        failed && <div className="photo-tile-placeholder photo-tile-error">Unable to load</div>
      )}
      <div className="photo-meta">
        <div>{photo.uploader_name}</div>
        {photo.caption && <div>{photo.caption}</div>}
      </div>
    </button>
  )
}
