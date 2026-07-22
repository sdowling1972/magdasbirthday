import { useEffect, useRef, useState } from 'react'
import type { ClipboardEvent, FormEvent, KeyboardEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useGuestAuth } from '../GuestAuth'
import { formatInviteCode, normalizeInviteCode } from '../inviteCode'

export function GuestLoginPage() {
  const { isAuthenticated, ready, login } = useGuestAuth()
  const navigate = useNavigate()
  const [parts, setParts] = useState(['', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const input0 = useRef<HTMLInputElement>(null)
  const input1 = useRef<HTMLInputElement>(null)
  const input2 = useRef<HTMLInputElement>(null)
  const input3 = useRef<HTMLInputElement>(null)
  const inputs = [input0, input1, input2, input3]

  useEffect(() => {
    input0.current?.focus()
  }, [])

  if (!ready) {
    return <p className="muted section">Loading…</p>
  }

  if (isAuthenticated) {
    return <Navigate to="/home" replace />
  }

  function updatePart(index: number, value: string) {
    const cleaned = normalizeInviteCode(value).slice(0, 4)
    setParts((prev) => {
      const next = [...prev]
      next[index] = cleaned
      return next
    })
    if (cleaned.length === 4 && index < 3) {
      inputs[index + 1].current?.focus()
    }
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !parts[index] && index > 0) {
      inputs[index - 1].current?.focus()
    }
  }

  function onPaste(e: ClipboardEvent) {
    e.preventDefault()
    const pasted = normalizeInviteCode(e.clipboardData.getData('text')).slice(0, 16)
    if (!pasted) return
    const next = ['', '', '', '']
    for (let i = 0; i < 4; i++) {
      next[i] = pasted.slice(i * 4, i * 4 + 4)
    }
    setParts(next)
    const focusAt = Math.min(Math.floor((pasted.length - 1) / 4), 3)
    inputs[focusAt].current?.focus()
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const code = parts.join('')
    if (code.length !== 16) {
      setError('Enter all 16 letters of your invite code')
      return
    }
    setLoading(true)
    try {
      await login(code)
      navigate('/home', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid invite code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-wrap guest-app">
      <div className="login-panel panel" style={{ width: 'min(480px, 100%)' }}>
        <p className="muted" style={{ marginTop: 0, letterSpacing: '0.16em', textTransform: 'uppercase', fontSize: '0.75rem' }}>
          Magda&apos;s Big Birthday
        </p>
        <h1>Enter your invite code</h1>
        <p className="muted">
          Your code looks like <span className="token-link">{formatInviteCode('AAAABBBBCCCCDDDD')}</span>. You can also
          open the personal link you were sent.
        </p>
        <form className="form-grid" onSubmit={onSubmit} style={{ marginTop: '1.5rem' }} onPaste={onPaste}>
          <div className="code-groups" aria-label="Invite code">
            {parts.map((part, index) => (
              <input
                key={index}
                ref={inputs[index]}
                className="code-group"
                value={part}
                onChange={(e) => updatePart(index, e.target.value)}
                onKeyDown={(e) => onKeyDown(index, e)}
                maxLength={4}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                aria-label={`Code group ${index + 1}`}
              />
            ))}
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Checking…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
