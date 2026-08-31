import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { Shell } from './components/Shell'
import { AuthProvider, useAuth } from './lib/auth'
import { CitizenTicketsProvider } from './lib/tickets'
import { ArView } from './pages/admin/ArView'
import { DataPipelinePage } from './pages/admin/DataPipelinePage'
import { ReportsIssuesPage } from './pages/admin/ReportsIssuesPage'
import { UndergroundPropertiesPage } from './pages/admin/UndergroundPropertiesPage'
import { CitizenHome } from './pages/citizen/CitizenHome'
import { MyPropertyPage } from './pages/citizen/MyPropertyPage'
import { ReportIssuePage } from './pages/citizen/ReportIssuePage'
import { AtlasPage } from './pages/AtlasPage'
import { LoginPage } from './pages/LoginPage'
import { RegistryPage } from './pages/RegistryPage'
import { TwinViewerPage } from './pages/TwinViewerPage'

const ADMIN_HOME = '/app/pipeline'

function HomeRedirect() {
  const { auth } = useAuth()
  if (!auth) return <Navigate to="/login" replace />
  return <Navigate to={auth.role === 'admin' ? ADMIN_HOME : '/citizen'} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <CitizenTicketsProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomeRedirect />} />

        <Route element={<RequireAuth />}>
          <Route element={<Shell />}>
            <Route element={<RequireAuth roles={['admin']} />}>
              <Route path="/app" element={<Navigate to={ADMIN_HOME} replace />} />
              <Route path="/app/pipeline" element={<DataPipelinePage />} />
              <Route path="/app/ingest" element={<Navigate to="/app/pipeline" replace />} />
              <Route path="/app/processing" element={<Navigate to="/app/pipeline?tab=processing" replace />} />
              <Route path="/app/polygon-labels" element={<Navigate to="/app/pipeline?tab=labels" replace />} />
              <Route path="/app/parcelization" element={<Navigate to="/app/registry?tab=floors" replace />} />
              <Route path="/app/floors" element={<Navigate to="/app/registry?tab=floors" replace />} />
              <Route path="/app/underground-properties" element={<UndergroundPropertiesPage />} />
              <Route path="/app/validation" element={<Navigate to="/app/registry" replace />} />
              <Route path="/app/ulpin-generation" element={<Navigate to="/app/registry" replace />} />
              <Route path="/app/reports" element={<ReportsIssuesPage />} />
              <Route path="/app/registry" element={<RegistryPage />} />
              <Route path="/app/ar" element={<ArView />} />
            </Route>
            <Route path="/app/atlas" element={<AtlasPage />} />
            <Route path="/app/polygons" element={<Navigate to="/app/atlas" replace />} />
            <Route path="/app/twin" element={<TwinViewerPage />} />
            <Route path="/app/map" element={<Navigate to="/app/atlas" replace />} />

            <Route element={<RequireAuth roles={['citizen']} />}>
              <Route path="/citizen" element={<CitizenHome />} />
              <Route path="/citizen/property" element={<MyPropertyPage />} />
              <Route path="/citizen/ownership" element={<Navigate to="/citizen/property?tab=ownership" replace />} />
              <Route path="/citizen/record" element={<Navigate to="/citizen/property?tab=ownership" replace />} />
              <Route path="/citizen/underground" element={<Navigate to="/citizen/property?tab=connections" replace />} />
              <Route path="/citizen/report" element={<ReportIssuePage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
      </CitizenTicketsProvider>
    </AuthProvider>
  )
}
