import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api, clearToken } from '../api'
import { useGuestAuth } from '../GuestAuth'

export function PublicLayout() {
  const { logout } = useGuestAuth()
  const navigate = useNavigate()

  function signOut() {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <Link to="/home" className="brand">
          Magda<span>'s</span> Big Birthday
        </Link>
        <nav className="nav-links">
          <Link to="/rsvp">RSVP</Link>
          <Link to="/album">Album</Link>
          <button type="button" className="btn btn-secondary btn-sm" onClick={signOut}>
            Sign out
          </button>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}

export function AdminLayout() {
  const navigate = useNavigate()

  async function logout() {
    try {
      await api.logoutAdmin()
    } catch {
      /* ignore */
    }
    clearToken()
    navigate('/admin/login')
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <Link to="/admin" className="brand">
          Magda<span>'s</span> Big Birthday
        </Link>
        <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>
          Sign out
        </button>
      </header>
      <div className="admin-layout">
        <nav className="admin-nav">
          <NavLink to="/admin" end>
            Dashboard
          </NavLink>
          <NavLink to="/admin/invites">Invites</NavLink>
          <NavLink to="/admin/photos">Photos</NavLink>
          <NavLink to="/admin/album">Album</NavLink>
        </nav>
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
