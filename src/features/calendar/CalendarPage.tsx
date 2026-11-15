import { useEffect, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { MapPin, Video } from 'lucide-react'
import { useDoctors, usePatients, useSessions } from '@/api/hooks'
import { useSessionUi } from '@/features/sessions/SessionProvider'
import { appointmentTitle, istTimeValue, ymd } from '@/lib/format'
import { usePermission } from '@/lib/permissions'
import { Badge, QueryState } from '@/components/ui'

export function CalendarPage() {
  const sessions = useSessions()
  const doctors = useDoctors()
  const patients = usePatients()
  const ui = useSessionUi()
  const all = usePermission('view_all', 'calendar')
  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => {
    document.title = 'Calendar · Northlight'
  }, [])
  const events = (sessions.data ?? [])
    .filter((session) => (selected.length === 0 ? true : session.doctorId ? selected.includes(session.doctorId) : true))
    .map((session) => {
      const doctor = doctors.data?.find((item) => item.id === session.doctorId)
      const patient = patients.data?.find((item) => item.id === session.patientId)
      return {
        id: session.id,
        title: appointmentTitle(patient?.fullName ?? session.requester?.name, session.patientId),
        start: session.start,
        end: session.end,
        backgroundColor: session.status === 'CANCELLED' || session.status === 'NO_SHOW' ? '#78716c' : doctor?.color ?? '#57534e',
        borderColor: 'transparent',
        classNames: [`status-${session.status.toLowerCase().replace('_', '-')}`],
        extendedProps: { mode: session.mode, status: session.status },
      }
    })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{all ? 'Calendar' : 'My calendar'}</h1>
        <p className="mt-1 max-w-3xl text-sm text-stone-600">Calendar invites sent to patients never contain clinical details. Events here use a neutral label only.</p>
      </div>
      {all ? (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by doctor">
          {(doctors.data ?? []).map((doctor) => {
            const on = selected.includes(doctor.id)
            return (
              <button
                key={doctor.id}
                type="button"
                aria-pressed={on}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${on ? 'border-teal-800 bg-teal-50' : 'border-stone-300 bg-white'}`}
                onClick={() => setSelected((current) => (current.includes(doctor.id) ? current.filter((id) => id !== doctor.id) : [...current, doctor.id]))}
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: doctor.color }} />
                {doctor.fullName}
              </button>
            )
          })}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 text-xs text-stone-600">
        <Badge>Requested</Badge>
        <Badge tone="teal">Confirmed</Badge>
        <Badge tone="amber">Rescheduled</Badge>
        <Badge>Completed</Badge>
        <Badge tone="red">Cancelled / No-show</Badge>
      </div>
      <QueryState isLoading={sessions.isLoading} isError={sessions.isError} error={sessions.error} onRetry={() => void sessions.refetch()}>
        <div className="rounded-xl bg-white p-2 shadow-sm sm:p-4">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={window.innerWidth < 768 ? 'timeGridDay' : 'timeGridWeek'}
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth' }}
            slotMinTime="08:00:00"
            slotMaxTime="20:00:00"
            allDaySlot={false}
            height="auto"
            nowIndicator
            events={events}
            eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: 'short', hour12: true }}
            dateClick={(info) => {
              ui.openBook({
                date: ymd(info.date),
                time: istTimeValue(info.date.toISOString()),
                doctorId: selected.length === 1 ? selected[0] : undefined,
              })
            }}
            eventClick={(info) => {
              info.jsEvent.preventDefault()
              ui.openSession(info.event.id)
            }}
            eventContent={(arg) => (
              <div className="flex items-center gap-1 overflow-hidden px-1 text-xs text-white">
                {arg.event.extendedProps.mode === 'ONLINE' ? <Video className="h-3 w-3 shrink-0" aria-label="Online" /> : <MapPin className="h-3 w-3 shrink-0" aria-label="In person" />}
                <span className="truncate">{arg.event.title}</span>
              </div>
            )}
          />
        </div>
      </QueryState>
    </div>
  )
}
