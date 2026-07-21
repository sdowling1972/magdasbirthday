import { Link, Navigate } from 'react-router-dom'
import { useGuestAuth } from '../GuestAuth'
import { getInviteCode } from '../inviteCode'

export function LandingPage() {
  const { isAuthenticated } = useGuestAuth()

  if (isAuthenticated || getInviteCode()) {
    return <Navigate to="/home" replace />
  }

  return (
    <div className="site-shell">
      <section className="hero landing-hero">
        <div className="hero-content">
          <h1>
            Magda<span className="brand-accent">&apos;s</span> Big Birthday
          </h1>
          <p>A celebration with the people who love her most.</p>
          <div className="hero-actions">
            <Link to="/login" className="landing-login-link">
              Have a login code? Login here!
            </Link>
          </div>
        </div>
        <div className="hero-portrait">
          <img src="/magdaphoto.jpg" alt="Magda" />
        </div>
      </section>
    </div>
  )
}
