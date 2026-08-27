import { Navigate, Route, Routes } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { Shell } from './components/Shell'
import { AuthProvider, useAuth } from './lib/auth'
import { CommandPage } from './pages/admin/CommandPage'
import { IngestPage } from './pages/admin/IngestPage'
import { PolygonLabelsPage } from './pages/admin/PolygonLabelsPage'
import { ProcessingPage } from './pages/admin/ProcessingPage'
import { ReportsIssuesPage } from './pages/admin/ReportsIssuesPage'
import { UndergroundPropertiesPage } from './pages/admin/UndergroundPropertiesPage'
import { CitizenHome } from './pages/citizen/CitizenHome'
import { OwnershipPage } from './pages/citizen/OwnershipPage'
import { PropertyRecordPage } from './pages/citizen/PropertyRecordPage'
import { PropertyPage } from './pages/citizen/PropertyPage'
import { ReportIssuePage } from './pages/citizen/ReportIssuePage'
import { UndergroundPage } from './pages/citizen/UndergroundPage'
import { LoginPage } from './pages/LoginPage'
import { PolygonViewerPage } from './pages/PolygonViewerPage'
import { RegistryPage } from './pages/RegistryPage'
import { TwinViewerPage } from './pages/TwinViewerPage'

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
              <Route path="/app/polygon-labels" element={<PolygonLabelsPage />} />
              <Route path="/app/parcelization" element={<Navigate to="/app/registry?tab=floors" replace />} />
              <Route path="/app/floors" element={<Navigate to="/app/registry?tab=floors" replace />} />
              <Route path="/app/underground-properties" element={<UndergroundPropertiesPage />} />
              <Route path="/app/validation" element={<Navigate to="/app/registry" replace />} />
              <Route path="/app/ulpin-generation" element={<Navigate to="/app/registry?tab=ulpin" replace />} />
              <Route path="/app/reports" element={<ReportsIssuesPage />} />
            </Route>
            <Route path="/app/registry" element={<RegistryPage />} />
            <Route path="/app/polygons" element={<PolygonViewerPage />} />
            <Route path="/app/twin" element={<TwinViewerPage />} />
            <Route path="/app/map" element={<Navigate to="/app/polygons" replace />} />

            <Route element={<RequireAuth roles={['citizen']} />}>
              <Route path="/citizen" element={<CitizenHome />} />
              <Route path="/citizen/property" element={<PropertyPage />} />
              <Route path="/citizen/ownership" element={<OwnershipPage />} />
              <Route path="/citizen/record" element={<PropertyRecordPage />} />
              <Route path="/citizen/underground" element={<UndergroundPage />} />
              <Route path="/citizen/report" element={<ReportIssuePage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </AuthProvider>
  )
}
