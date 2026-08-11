import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api, clearToken } from '../api'
import { useGuestAuth } from '../GuestAuth'

export function PublicAlbumLayout() {
  return (
    <div className="site-shell guest-app">
      <header className="site-header guest-header">
        <Link to="/" className="brand">
          Magda<span>'s</span> Big Birthday
        </Link>
        <nav className="nav-links guest-nav" aria-label="Public navigation">
          <NavLink to="/photos">Album</NavLink>
          <Link to="/login" className="guest-nav-signout">
            Guest login
          </Link>
        </nav>
      </header>
      <main className="guest-main">
        <Outlet />
      </main>
    </div>
  )
}

export function PublicLayout() {
  const { logout } = useGuestAuth()
  const navigate = useNavigate()

  function signOut() {
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="site-shell guest-app">
      <header className="site-header guest-header">
        <Link to="/home" className="brand">
          Magda<span>'s</span> Big Birthday
        </Link>
        <nav className="nav-links guest-nav" aria-label="Guest navigation">
          <NavLink to="/home">Home</NavLink>
          <NavLink to="/rsvp">RSVP</NavLink>
          <NavLink to="/album">Album</NavLink>
          <button type="button" className="guest-nav-signout" onClick={signOut}>
            Sign out
          </button>
        </nav>
      </header>
      <main className="guest-main">
        <Outlet />
      </main>
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
