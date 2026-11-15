import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useDoctors, usePatients, useSessions, useSimulateWebsite } from '@/api/hooks'
import { useSessionUi } from '@/features/sessions/SessionProvider'
import { formatDate, formatTime, modeLabel, statusLabel } from '@/lib/format'
import { usePermission } from '@/lib/permissions'
import { errorText } from '@/lib/utils'
import { Badge, Button, QueryState, Select } from '@/components/ui'
import type { SessionStatus } from '@/types'

export function SessionsPage() {
  const [status, setStatus] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [mode, setMode] = useState('')
  const [source, setSource] = useState('')
  const sessions = useSessions({ status, doctorId, mode, source })
  const doctors = useDoctors()
  const patients = usePatients()
  const simulate = useSimulateWebsite()
  const ui = useSessionUi()
  const all = usePermission('view_all', 'sessions')
  useEffect(() => {
    document.title = 'Sessions · Northlight'
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{all ? 'Sessions' : 'My sessions'}</h1>
          <p className="text-sm text-stone-600">Book, move, or review appointments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => simulate.mutate(undefined, { onSuccess: (session) => { toast.success('Website request added'); ui.openSession(session.id) }, onError: (error) => toast.error(errorText(error)) })}>
            Simulate website booking
          </Button>
          <Button onClick={() => ui.openBook()}>Book session</Button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <Select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {(['REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED'] as SessionStatus[]).map((item) => (
            <option key={item} value={item}>{statusLabel(item)}</option>
          ))}
        </Select>
        {all ? (
          <Select aria-label="Doctor" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
            <option value="">All doctors</option>
            {(doctors.data ?? []).map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}
          </Select>
        ) : null}
        <Select aria-label="Mode" value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="">All modes</option>
          <option value="IN_PERSON">In person</option>
          <option value="ONLINE">Online</option>
        </Select>
        <Select aria-label="Source" value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="">All sources</option>
          <option value="WEBSITE">Website</option>
          <option value="INTERNAL">Clinic</option>
        </Select>
      </div>
      <QueryState isLoading={sessions.isLoading} isError={sessions.isError} error={sessions.error} onRetry={() => void sessions.refetch()} isEmpty={(sessions.data ?? []).length === 0} emptyTitle="No sessions" emptyBody="Try another filter or book a session.">
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Person</th>
                {all ? <th className="px-3 py-2 font-medium">Doctor</th> : null}
                <th className="px-3 py-2 font-medium">Mode</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {(sessions.data ?? []).map((session) => {
                const patient = patients.data?.find((item) => item.id === session.patientId)
                const doctor = doctors.data?.find((item) => item.id === session.doctorId)
                return (
                  <tr key={session.id} className="border-t border-stone-100">
                    <td className="px-3 py-2">
                      <button type="button" className="text-left text-teal-900 underline" onClick={() => ui.openSession(session.id)}>
                        {formatDate(session.start)} {formatTime(session.start)}
                      </button>
                    </td>
                    <td className="px-3 py-2">{patient?.fullName ?? session.requester?.name ?? 'Unlinked'}</td>
                    {all ? <td className="px-3 py-2">{doctor?.fullName ?? 'Unassigned'}</td> : null}
                    <td className="px-3 py-2">{modeLabel(session.mode)}</td>
                    <td className="px-3 py-2"><Badge>{statusLabel(session.status)}</Badge> {session.source === 'WEBSITE' ? <Badge tone="blue">Website</Badge> : null}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </QueryState>
    </div>
  )
}
