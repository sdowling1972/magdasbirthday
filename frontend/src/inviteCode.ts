const INVITE_CODE_KEY = 'magda_invite_code'

export function normalizeInviteCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z]/g, '')
}

export function formatInviteCode(code: string): string {
  const cleaned = normalizeInviteCode(code).slice(0, 16)
  const parts = cleaned.match(/.{1,4}/g) ?? []
  return parts.join('-')
}

export function getInviteCode(): string | null {
  const raw = localStorage.getItem(INVITE_CODE_KEY)
  if (!raw) return null
  const code = normalizeInviteCode(raw)
  return code.length === 16 ? code : null
}

export function setInviteCode(code: string) {
  localStorage.setItem(INVITE_CODE_KEY, normalizeInviteCode(code))
}

export function clearInviteCode() {
  localStorage.removeItem(INVITE_CODE_KEY)
}

export function autologinUrl(code: string): string {
  return `${window.location.origin}/autologin?key=${normalizeInviteCode(code)}`
}
