import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import {
  clearInviteCode,
  getInviteCode,
  normalizeInviteCode,
  setInviteCode,
} from './inviteCode'
import type { InvitePublic } from './types'

type GuestAuthContextValue = {
  code: string | null
  invite: InvitePublic | null
  isAuthenticated: boolean
  login: (rawCode: string) => Promise<void>
  logout: () => void
  refreshInvite: () => Promise<void>
}

const GuestAuthContext = createContext<GuestAuthContextValue | null>(null)

export function GuestAuthProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string | null>(() => getInviteCode())
  const [invite, setInvite] = useState<InvitePublic | null>(null)

  const login = useCallback(async (rawCode: string) => {
    const result = await api.verifyInviteCode(rawCode)
    setInviteCode(result.code)
    setCode(result.code)
    setInvite(result.invite)
  }, [])

  const logout = useCallback(() => {
    void api.logoutGuest().catch(() => undefined)
    clearInviteCode()
    setCode(null)
    setInvite(null)
  }, [])

  const refreshInvite = useCallback(async () => {
    const stored = getInviteCode()
    if (!stored) {
      setInvite(null)
      return
    }
    const result = await api.verifyInviteCode(stored)
    setInviteCode(result.code)
    setCode(result.code)
    setInvite(result.invite)
  }, [])

  const value = useMemo(
    () => ({
      code,
      invite,
      isAuthenticated: Boolean(code && normalizeInviteCode(code).length === 16),
      login,
      logout,
      refreshInvite,
    }),
    [code, invite, login, logout, refreshInvite],
  )

  return <GuestAuthContext.Provider value={value}>{children}</GuestAuthContext.Provider>
}

export function useGuestAuth() {
  const ctx = useContext(GuestAuthContext)
  if (!ctx) throw new Error('useGuestAuth must be used within GuestAuthProvider')
  return ctx
}
