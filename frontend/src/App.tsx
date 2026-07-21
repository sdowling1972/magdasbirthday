import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { GuestAuthProvider, useGuestAuth } from './GuestAuth'
import { PublicLayout, AdminLayout } from './components/Layout'
import { AdminDashboardPage } from './pages/AdminDashboardPage'
import { AdminInviteDetailPage } from './pages/AdminInviteDetailPage'
import { AdminInvitesPage } from './pages/AdminInvitesPage'
import { AdminLoginPage } from './pages/AdminLoginPage'
import { AdminPhotosPage } from './pages/AdminPhotosPage'
import { AlbumPage } from './pages/AlbumPage'
import { AutologinPage } from './pages/AutologinPage'
import { GuestLoginPage } from './pages/GuestLoginPage'
import { HomePage } from './pages/HomePage'
import { LandingPage } from './pages/LandingPage'
import { RsvpPage } from './pages/RsvpPage'
import { getToken } from './api'
import { getInviteCode } from './inviteCode'

function RequireAdmin({ children }: { children: ReactNode }) {
  if (!getToken()) return <Navigate to="/admin/login" replace />
  return children
}

function RequireGuest({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useGuestAuth()
  if (!isAuthenticated && !getInviteCode()) {
    return <Navigate to="/" replace />
  }
  return children
}

export default function App() {
  return (
    <GuestAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<GuestLoginPage />} />
          <Route path="/autologin" element={<AutologinPage />} />
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            element={
              <RequireGuest>
                <PublicLayout />
              </RequireGuest>
            }
          >
            <Route path="/home" element={<HomePage />} />
            <Route path="/album" element={<AlbumPage />} />
            <Route path="/rsvp" element={<RsvpPage />} />
            <Route path="/rsvp/:token" element={<RsvpPage />} />
          </Route>
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminLayout />
              </RequireAdmin>
            }
          >
            <Route index element={<AdminDashboardPage />} />
            <Route path="invites" element={<AdminInvitesPage />} />
            <Route path="invites/:id" element={<AdminInviteDetailPage />} />
            <Route path="photos" element={<AdminPhotosPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </GuestAuthProvider>
  )
}
