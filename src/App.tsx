import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { RequireAccess } from '@/components/RequireAccess'
import { SignInPage } from '@/features/auth/SignInPage'
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage'
import { AuditPage } from '@/features/audit/AuditPage'
import { AvailabilityPage } from '@/features/availability/AvailabilityPage'
import { CalendarPage } from '@/features/calendar/CalendarPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { DoctorsPage } from '@/features/doctors/DoctorsPage'
import { PatientDetailPage } from '@/features/patients/PatientDetailPage'
import { PatientsPage } from '@/features/patients/PatientsPage'
import { PaymentsPage } from '@/features/payments/PaymentsPage'
import { SessionsPage } from '@/features/sessions/SessionsPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { useAuth } from '@/lib/auth'

function RequireAuth({ children }: { children: ReactNode }) {
  const { actor } = useAuth()
  if (!actor) return <Navigate to="/sign-in" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="patients" element={<PatientsPage />} />
        <Route path="patients/:patientId" element={<PatientDetailPage />} />
        <Route path="doctors" element={<RequireAccess action="view_all" resource="doctors"><DoctorsPage /></RequireAccess>} />
        <Route path="availability" element={<RequireAccess action="view_all" resource="availability" also={{ action: 'view_own', resource: 'availability' }}><AvailabilityPage /></RequireAccess>} />
        <Route path="payments" element={<RequireAccess action="view" resource="payments"><PaymentsPage /></RequireAccess>} />
        <Route path="analytics" element={<RequireAccess action="view" resource="analytics"><AnalyticsPage /></RequireAccess>} />
        <Route path="audit" element={<RequireAccess action="view" resource="audit"><AuditPage /></RequireAccess>} />
        <Route path="settings" element={<RequireAccess action="view" resource="settings"><SettingsPage /></RequireAccess>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
