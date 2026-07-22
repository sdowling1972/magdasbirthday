import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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
  /** False until the initial session restore attempt finishes. */
  ready: boolean
  login: (rawCode: string) => Promise<void>
  logout: () => void
  refreshInvite: () => Promise<void>
}

const GuestAuthContext = createContext<GuestAuthContextValue | null>(null)

export function GuestAuthProvider({ children }: { children: ReactNode }) {
  const [code, setCode] = useState<string | null>(() => getInviteCode())
  const [invite, setInvite] = useState<InvitePublic | null>(null)
  const [ready, setReady] = useState(false)

  const clearLocalSession = useCallback(() => {
    clearInviteCode()
    setCode(null)
    setInvite(null)
  }, [])

  const login = useCallback(async (rawCode: string) => {
    const result = await api.verifyInviteCode(rawCode)
    setInviteCode(result.code)
    setCode(result.code)
    setInvite(result.invite)
  }, [])

  const logout = useCallback(() => {
    void api.logoutGuest().catch(() => undefined)
    clearLocalSession()
  }, [clearLocalSession])

  const refreshInvite = useCallback(async () => {
    const stored = getInviteCode()
    if (!stored) {
      setInvite(null)
      return
    }
    try {
      const result = await api.verifyInviteCode(stored)
      setInviteCode(result.code)
      setCode(result.code)
      setInvite(result.invite)
    } catch {
      clearLocalSession()
    }
  }, [clearLocalSession])

  // Restore session: prefer cookie, otherwise re-login with stored invite code to mint a cookie.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const session = await api.getGuestSession()
        if (cancelled) return
        setInviteCode(session.code)
        setCode(session.code)
        setInvite(session.invite)
      } catch {
        const stored = getInviteCode()
        if (!stored) {
          if (!cancelled) clearLocalSession()
          return
        }
        try {
          const result = await api.verifyInviteCode(stored)
          if (cancelled) return
          setInviteCode(result.code)
          setCode(result.code)
          setInvite(result.invite)
        } catch {
          if (!cancelled) clearLocalSession()
        }
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [clearLocalSession])

  const value = useMemo(
    () => ({
      code,
      invite,
      isAuthenticated: Boolean(code && normalizeInviteCode(code).length === 16),
      ready,
      login,
      logout,
      refreshInvite,
    }),
    [code, invite, ready, login, logout, refreshInvite],
  )

  return <GuestAuthContext.Provider value={value}>{children}</GuestAuthContext.Provider>
}

export function useGuestAuth() {
  const ctx = useContext(GuestAuthContext)
  if (!ctx) throw new Error('useGuestAuth must be used within GuestAuthProvider')
  return ctx
}
