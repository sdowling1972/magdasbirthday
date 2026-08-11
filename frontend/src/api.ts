import type {
  AlbumContributor,
  DashboardStats,
  Invite,
  InviteCreate,
  InviteListItem,
  InvitePublic,
  PartyInfo,
  Photo,
  PhotoPage,
  PhotoStatus,
  Guest,
} from './types'

const ADMIN_TOKEN_KEY = 'magda_admin_token'

export function getToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(ADMIN_TOKEN_KEY)
}

type RequestOptions = RequestInit & {
  admin?: boolean
  /** Guest APIs rely on the HttpOnly session cookie from /api/auth/login. */
  invite?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { admin = false, invite = false, ...init } = options
  const headers = new Headers(init.headers)
  if (!(init.body instanceof FormData) && !headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (admin) {
    const token = getToken()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(path, {
    ...init,
    headers,
    credentials: 'include',
  })
  if (res.status === 401) {
    if (admin) {
      clearToken()
      if (path !== '/api/admin/logout') {
        void fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).catch(() => undefined)
      }
    }
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const data = await res.json()
      detail = data.detail || detail
    } catch {
      /* ignore */
    }
    if (Array.isArray(detail)) {
      detail = detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(', ')
    }
    throw new Error(typeof detail === 'string' ? detail : 'Request failed')
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1].trim())
    } catch {
      /* ignore */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain?.[1]?.trim() || fallback
}

async function downloadAdminFile(path: string, fallbackName: string): Promise<void> {
  const headers = new Headers()
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(path, { headers, credentials: 'include' })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const data = await res.json()
      detail = data.detail || detail
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : 'Download failed')
  }
  const blob = await res.blob()
  const filename = filenameFromDisposition(res.headers.get('Content-Disposition'), fallbackName)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  getParty: () => request<PartyInfo>('/api/party', { invite: true }),

  verifyInviteCode: (code: string) =>
    request<{ code: string; formatted_code: string; invite: InvitePublic }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  getGuestSession: () =>
    request<{ code: string; formatted_code: string; invite: InvitePublic }>('/api/auth/session', {
      invite: true,
    }),

  logoutGuest: () => request<void>('/api/auth/logout', { method: 'POST' }),

  login: (password: string) =>
    request<{ access_token: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  logoutAdmin: () => request<void>('/api/admin/logout', { method: 'POST', admin: true }),

  getStats: () => request<DashboardStats>('/api/admin/stats', { admin: true }),

  downloadInviteeStatus: () =>
    downloadAdminFile('/api/admin/exports/invitee-status', 'magda-invitee-status.csv'),

  downloadInvitations: () => {
    const base = encodeURIComponent(window.location.origin)
    return downloadAdminFile(
      `/api/admin/exports/invitations?base_url=${base}`,
      'magda-invitations.csv',
    )
  },

  listInvites: () => request<InviteListItem[]>('/api/admin/invites', { admin: true }),

  getInvite: (id: string) => request<Invite>(`/api/admin/invites/${id}`, { admin: true }),

  createInvite: (payload: InviteCreate) =>
    request<Invite>('/api/admin/invites', { method: 'POST', body: JSON.stringify(payload), admin: true }),

  updateInvite: (id: string, payload: Partial<InviteCreate>) =>
    request<Invite>(`/api/admin/invites/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      admin: true,
    }),

  deleteInvite: (id: string) =>
    request<void>(`/api/admin/invites/${id}`, { method: 'DELETE', admin: true }),

  addGuest: (inviteId: string, name: string) =>
    request<Guest>(`/api/admin/invites/${inviteId}/guests`, {
      method: 'POST',
      body: JSON.stringify({ name }),
      admin: true,
    }),

  removeGuest: (inviteId: string, guestId: string) =>
    request<void>(`/api/admin/invites/${inviteId}/guests/${guestId}`, { method: 'DELETE', admin: true }),

  getRsvp: () => request<InvitePublic>('/api/rsvp', { invite: true }),

  submitRsvp: (
    guests: Array<{
      guest_id: string
      rsvp_status: 'attending' | 'declined'
      dietary_notes?: string | null
      message?: string | null
    }>,
    email?: string | null,
    generalComments?: string | null,
  ) =>
    request<InvitePublic>('/api/rsvp', {
      method: 'PUT',
      body: JSON.stringify({
        guests,
        email: email?.trim() || null,
        general_comments: generalComments?.trim() || null,
      }),
      invite: true,
    }),

  listInvitePhotos: () => request<Photo[]>('/api/photos/mine', { invite: true }),

  uploadPhoto: (form: FormData) =>
    request<Photo>('/api/photos/mine', { method: 'POST', body: form, invite: true }),

  getAlbum: (page = 1, pageSize = 15, inviteId?: string | null) => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    })
    if (inviteId) params.set('invite_id', inviteId)
    return request<PhotoPage>(`/api/photos/album?${params}`)
  },

  getAlbumContributors: () => request<AlbumContributor[]>('/api/photos/album/contributors'),

  adminContributors: (status?: PhotoStatus) => {
    const params = new URLSearchParams()
    if (status) params.set('status_filter', status)
    const q = params.toString()
    return request<AlbumContributor[]>(`/api/photos/admin/contributors${q ? `?${q}` : ''}`, {
      admin: true,
    })
  },

  adminPhotos: (status?: PhotoStatus, page = 1, pageSize = 15, inviteId?: string | null) => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    })
    if (status) params.set('status_filter', status)
    if (inviteId) params.set('invite_id', inviteId)
    return request<PhotoPage>(`/api/photos/admin?${params}`, { admin: true })
  },

  adminAlbum: (page = 1, pageSize = 15, inviteId?: string | null) => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    })
    if (inviteId) params.set('invite_id', inviteId)
    return request<PhotoPage>(`/api/photos/admin/album?${params}`, { admin: true })
  },

  updatePhoto: (
    id: string,
    data: { status?: PhotoStatus; caption?: string | null; uploader_name?: string },
  ) =>
    request<Photo>(`/api/photos/admin/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
      admin: true,
    }),

  updatePhotoStatus: (id: string, status: PhotoStatus) =>
    request<Photo>(`/api/photos/admin/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      admin: true,
    }),

  deletePhoto: (id: string) =>
    request<void>(`/api/photos/admin/${id}`, { method: 'DELETE', admin: true }),
}
