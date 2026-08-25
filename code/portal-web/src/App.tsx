import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { Shell } from './components/Shell'
import { AuthProvider, useAuth } from './lib/auth'
import { CommandPage } from './pages/admin/CommandPage'
import { IngestPage } from './pages/admin/IngestPage'
import { ProcessingPage } from './pages/admin/ProcessingPage'
import { ValidationPage } from './pages/admin/ValidationPage'
import { CitizenHome } from './pages/citizen/CitizenHome'
import { OwnershipPage } from './pages/citizen/OwnershipPage'
import { PropertyPage } from './pages/citizen/PropertyPage'
import { UndergroundPage } from './pages/citizen/UndergroundPage'
import { LoginPage } from './pages/LoginPage'
import { MapPage } from './pages/MapPage'
import { PolygonViewerPage } from './pages/PolygonViewerPage'
import { RegistryPage } from './pages/RegistryPage'

function HomeRedirect() {
  const { auth } = useAuth()
  if (!auth) return <Navigate to="/login" replace />
  return <Navigate to={auth.role === 'admin' ? '/app' : '/citizen'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomeRedirect />} />

        <Route element={<RequireAuth />}>
          <Route element={<Shell />}>
            <Route element={<RequireAuth roles={['admin']} />}>
              <Route path="/app" element={<CommandPage />} />
              <Route path="/app/ingest" element={<IngestPage />} />
              <Route path="/app/processing" element={<ProcessingPage />} />
              <Route path="/app/validation" element={<ValidationPage />} />
            </Route>
            <Route path="/app/registry" element={<RegistryPage />} />
            <Route path="/app/polygons" element={<PolygonViewerPage />} />
            <Route path="/app/map" element={<MapPage />} />

            <Route element={<RequireAuth roles={['citizen']} />}>
              <Route path="/citizen" element={<CitizenHome />} />
              <Route path="/citizen/property" element={<PropertyPage />} />
              <Route path="/citizen/ownership" element={<OwnershipPage />} />
              <Route path="/citizen/underground" element={<UndergroundPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </AuthProvider>
  )
}
