import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Photo } from '../types'
import type { PageSize } from './useAlbumPagination'

const ALL_PAGE_SIZE = 2000

type AlbumSource = 'guest' | 'admin'

export function usePagedAlbum(source: AlbumSource, defaultSize: PageSize = 15) {
  const [pageSize, setPageSize] = useState<PageSize>(defaultSize)
  const [page, setPage] = useState(1)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const requestSize = pageSize === 'all' ? ALL_PAGE_SIZE : pageSize
  const requestPage = pageSize === 'all' ? 1 : page
  const pageCount =
    pageSize === 'all' || total === 0 ? 1 : Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageStartIndex = pageSize === 'all' ? 0 : (safePage - 1) * pageSize

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    const fetchPage = source === 'guest' ? api.getAlbum : api.adminAlbum
    fetchPage(requestPage, requestSize)
      .then((data) => {
        if (cancelled) return
        setPhotos(data.items)
        setTotal(data.total)
        if (pageSize !== 'all' && data.page !== requestPage) {
          setPage(data.page)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setPhotos([])
        setTotal(0)
        setError(err instanceof Error ? err.message : 'Failed to load album')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [source, requestPage, requestSize, pageSize])

  function changePageSize(next: PageSize) {
    setPageSize(next)
    setPage(1)
  }

  function goToPage(next: number) {
    setPage(Math.min(Math.max(1, next), pageCount))
  }

  return {
    photos,
    total,
    loading,
    error,
    pageSize,
    page: safePage,
    pageCount,
    pageStartIndex,
    changePageSize,
    goToPage,
  }
}
