import type {
  DashboardStats,
  Invite,
  InviteCreate,
  InviteListItem,
  InvitePublic,
  PartyInfo,
  Photo,
  PhotoStatus,
  Guest,
} from './types'
import { getInviteCode, clearInviteCode } from './inviteCode'

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
  if (invite) {
    const code = getInviteCode()
    if (code) headers.set('X-Invite-Code', code)
  }

  const res = await fetch(path, { ...init, headers })
  if (res.status === 401 && admin) {
    clearToken()
  }
  if (res.status === 401 && invite) {
    clearInviteCode()
  }
  if (!res.ok) {
    let detail = res.statusText
    try {
      const data = await res.json()
      detail = data.detail || detail
      if (Array.isArray(detail)) {
        detail = detail.map((d: { msg?: string }) => d.msg || JSON.stringify(d)).join(', ')
      }
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : 'Request failed')
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  getParty: () => request<PartyInfo>('/api/party', { invite: true }),

  verifyInviteCode: (code: string) =>
    request<{ code: string; formatted_code: string; invite: InvitePublic }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  login: (password: string) =>
    request<{ access_token: string }>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  getStats: () => request<DashboardStats>('/api/admin/stats', { admin: true }),

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

  getRsvp: (token: string) => request<InvitePublic>(`/api/rsvp/${token}`),

  submitRsvp: (
    token: string,
    guests: Array<{
      guest_id: string
      rsvp_status: 'attending' | 'declined'
      dietary_notes?: string | null
      message?: string | null
    }>,
  ) =>
    request<Guest[]>(`/api/rsvp/${token}`, {
      method: 'PUT',
      body: JSON.stringify({ guests }),
    }),

  listInvitePhotos: (token: string) => request<Photo[]>(`/api/photos/rsvp/${token}`),

  uploadPhoto: (token: string, form: FormData) =>
    request<Photo>(`/api/photos/rsvp/${token}`, { method: 'POST', body: form }),

  getAlbum: () => request<Photo[]>('/api/photos/album', { invite: true }),

  adminPhotos: (status?: PhotoStatus) => {
    const q = status ? `?status_filter=${status}` : ''
    return request<Photo[]>(`/api/photos/admin${q}`, { admin: true })
  },

  updatePhotoStatus: (id: string, status: PhotoStatus) =>
    request<Photo>(`/api/photos/admin/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
      admin: true,
    }),

  deletePhoto: (id: string) =>
    request<void>(`/api/photos/admin/${id}`, { method: 'DELETE', admin: true }),
}
