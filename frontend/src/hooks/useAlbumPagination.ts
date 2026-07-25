import { useMemo, useState } from 'react'

export type PageSize = 15 | 30 | 45 | 'all'

export const PAGE_SIZE_OPTIONS: { value: PageSize; label: string }[] = [
  { value: 15, label: '15' },
  { value: 30, label: '30' },
  { value: 45, label: '45' },
  { value: 'all', label: 'All' },
]

export function useAlbumPagination<T>(items: T[], defaultSize: PageSize = 15) {
  const [pageSize, setPageSize] = useState<PageSize>(defaultSize)
  const [page, setPage] = useState(1)

  const pageCount = useMemo(() => {
    if (pageSize === 'all' || items.length === 0) return 1
    return Math.max(1, Math.ceil(items.length / pageSize))
  }, [items.length, pageSize])

  const safePage = Math.min(page, pageCount)

  const pageItems = useMemo(() => {
    if (pageSize === 'all') return items
    const start = (safePage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, pageSize, safePage])

  const pageStartIndex = pageSize === 'all' ? 0 : (safePage - 1) * pageSize

  function changePageSize(next: PageSize) {
    setPageSize(next)
    setPage(1)
  }

  function goToPage(next: number) {
    setPage(Math.min(Math.max(1, next), pageCount))
  }

  return {
    pageSize,
    page: safePage,
    pageCount,
    pageItems,
    pageStartIndex,
    changePageSize,
    goToPage,
    total: items.length,
  }
}
