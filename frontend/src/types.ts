export type RsvpStatus = 'pending' | 'attending' | 'declined'
export type PhotoStatus = 'pending' | 'approved' | 'rejected'

export interface PartyInfo {
  name: string
  date: string
  location: string
  description: string
}

export interface Guest {
  id: string
  invite_id: string
  name: string
  is_primary: boolean
  sort_order: number
  rsvp_status: RsvpStatus
  dietary_notes: string | null
  message: string | null
  rsvp_at: string | null
}

export interface Invite {
  id: string
  token: string
  household_name: string
  email: string | null
  max_guests: number
  notes: string | null
  general_comments: string | null
  created_at: string
  updated_at: string
  guests: Guest[]
  attending_count: number
  pending_count: number
  declined_count: number
}

export interface InviteListItem {
  id: string
  token: string
  household_name: string
  email: string | null
  max_guests: number
  guest_count: number
  attending_count: number
  pending_count: number
  declined_count: number
  created_at: string
}

export interface InvitePublic {
  household_name: string
  email: string | null
  general_comments: string | null
  max_guests: number
  guests: Guest[]
  party: PartyInfo
}

export interface Photo {
  id: string
  invite_id: string
  uploader_name: string
  caption: string | null
  filename: string
  original_filename: string
  content_type: string
  status: PhotoStatus
  created_at: string
  url: string | null
}

export interface DashboardStats {
  invite_count: number
  guest_count: number
  attending_count: number
  declined_count: number
  pending_count: number
  photos_pending: number
  photos_approved: number
}

export interface GuestCreate {
  name: string
  is_primary?: boolean
  sort_order?: number
}

export interface InviteCreate {
  household_name: string
  email?: string | null
  max_guests: number
  notes?: string | null
  guests: GuestCreate[]
}
