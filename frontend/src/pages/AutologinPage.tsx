import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useGuestAuth } from '../GuestAuth'
import { formatInviteCode, normalizeInviteCode } from '../inviteCode'

export function AutologinPage() {
  const [params] = useSearchParams()
  const { login } = useGuestAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const key = normalizeInviteCode(params.get('key') || '')

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (key.length !== 16) {
        setError('This login link is missing a valid invite code.')
        return
      }
      try {
        await login(key)
        if (!cancelled) navigate('/home', { replace: true })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Invalid invite code')
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [key, login, navigate])

  return (
    <div className="login-wrap">
      <div className="login-panel panel">
        <h1>Signing you in</h1>
        {error ? (
          <>
            <p className="error">{error}</p>
            {key.length === 16 && (
              <p className="muted">
                Code: <span className="token-link">{formatInviteCode(key)}</span>
              </p>
            )}
            <Link to="/login" className="btn btn-primary">
              Enter code manually
            </Link>
          </>
        ) : (
          <p className="muted">Confirming your invite code…</p>
        )}
      </div>
    </div>
  )
}
