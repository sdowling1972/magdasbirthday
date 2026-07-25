import { PAGE_SIZE_OPTIONS, type PageSize } from '../hooks/useAlbumPagination'

type AlbumPaginationControlsProps = {
  pageSize: PageSize
  page: number
  pageCount: number
  total: number
  onPageSizeChange: (size: PageSize) => void
  onPageChange: (page: number) => void
}

export function AlbumPaginationControls({
  pageSize,
  page,
  pageCount,
  total,
  onPageSizeChange,
  onPageChange,
}: AlbumPaginationControlsProps) {
  if (total === 0) return null

  const showingAll = pageSize === 'all'
  const from = showingAll ? 1 : (page - 1) * pageSize + 1
  const to = showingAll ? total : Math.min(page * pageSize, total)

  return (
    <div className="album-pagination">
      <label className="album-pagination-size">
        <span className="muted">Show</span>
        <select
          value={pageSize === 'all' ? 'all' : String(pageSize)}
          onChange={(e) => {
            const raw = e.target.value
            onPageSizeChange(raw === 'all' ? 'all' : (Number(raw) as 15 | 30 | 45))
          }}
        >
          {PAGE_SIZE_OPTIONS.map((opt) => (
            <option key={opt.label} value={opt.value === 'all' ? 'all' : String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <p className="muted album-pagination-summary">
        Showing {from}–{to} of {total}
      </p>

      {!showingAll && pageCount > 1 && (
        <div className="inline-actions album-pagination-nav">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </button>
          <span className="muted">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
