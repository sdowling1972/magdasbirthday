import type { ReactNode } from 'react'
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom'
import { GuestAuthProvider, useGuestAuth } from './GuestAuth'
import { PublicLayout, AdminLayout } from './components/Layout'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AdminInviteDetailPage } from './pages/AdminInviteDetailPage'
import { AdminInvitesPage } from './pages/AdminInvitesPage'
import { AdminLoginPage } from './pages/AdminLoginPage'
import { AdminAlbumPage } from './pages/AdminAlbumPage'
import { AdminPhotosPage } from './pages/AdminPhotosPage'
import { AlbumPage } from './pages/AlbumPage'
import { AutologinPage } from './pages/AutologinPage'
import { GuestLoginPage } from './pages/GuestLoginPage'
import { HomePage } from './pages/HomePage'
import { LandingPage } from './pages/LandingPage'
import { RsvpPage } from './pages/RsvpPage'
import { getToken } from './api'

function RequireAdmin({ children }: { children: ReactNode }) {
  if (!getToken()) return <Navigate to="/admin/login" replace />
  return children
}

function GuestRoutes() {
  const { isAuthenticated, ready } = useGuestAuth()
  if (!ready) {
    return <p className="muted section">Checking your invitation…</p>
  }
  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }
  return <PublicLayout />
}

function AdminRoutes() {
  return (
    <RequireAdmin>
      <AdminLayout />
    </RequireAdmin>
  )
}

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <GuestLoginPage /> },
  { path: '/autologin', element: <AutologinPage /> },
  { path: '/admin/login', element: <AdminLoginPage /> },
  {
    element: <GuestRoutes />,
    children: [
      { path: '/home', element: <HomePage /> },
      { path: '/album', element: <AlbumPage /> },
      { path: '/rsvp', element: <RsvpPage /> },
      { path: '/rsvp/:token', element: <RsvpPage /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminRoutes />,
    children: [
      { index: true, element: <AdminDashboardPage /> },
      { path: 'invites', element: <AdminInvitesPage /> },
      { path: 'invites/:id', element: <AdminInviteDetailPage /> },
      { path: 'photos', element: <AdminPhotosPage /> },
      { path: 'album', element: <AdminAlbumPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  return (
    <GuestAuthProvider>
      <RouterProvider router={router} />
    </GuestAuthProvider>
  )
}
