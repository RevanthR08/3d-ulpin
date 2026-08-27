import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import type { Role } from '../lib/storage'

export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { auth } = useAuth()
  const loc = useLocation()
  if (!auth) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (roles && !roles.includes(auth.role)) {
    return <Navigate to={auth.role === 'admin' ? '/app/ingest' : '/citizen'} replace />
  }
  return <Outlet />
}
