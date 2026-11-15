import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { usePatients, usePaymentSummary, useSessions } from '@/api/hooks'
import { useSessionUi } from '@/features/sessions/SessionProvider'
import { useAuth } from '@/lib/auth'
import { formatTime, monthKey, statusLabel, ymd } from '@/lib/format'
import { usePermission } from '@/lib/permissions'
import { Badge, Button, Card, QueryState } from '@/components/ui'

export function DashboardPage() {
  const { actor } = useAuth()
  const sessions = useSessions()
  const canPay = usePermission('view', 'payments')
  const summary = usePaymentSummary(canPay)
  const patients = usePatients()
  const ui = useSessionUi()
  const admin = actor?.activeRole === 'ADMIN'
  useEffect(() => {
    document.title = 'Dashboard · Northlight'
  }, [])
  const today = ymd(new Date())
  const month = monthKey(new Date().toISOString())
  const rows = sessions.data ?? []
  const todays = rows.filter((session) => ymd(new Date(session.start)) === today && session.status !== 'CANCELLED')
  const pending = rows.filter((session) => session.status === 'REQUESTED' && session.source === 'WEBSITE')
  const monthCount = rows.filter((session) => monthKey(session.start) === month).length
  const upcoming = rows
    .filter((session) => new Date(session.start).getTime() > Date.now() && new Date(session.start).getTime() < Date.now() + 7 * 86_400_000)
    .filter((session) => session.status === 'CONFIRMED' || session.status === 'RESCHEDULED' || session.status === 'REQUESTED')
    .sort((a, b) => (a.start < b.start ? -1 : 1))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-stone-600">{admin ? 'All doctors today.' : 'Your schedule.'}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => ui.openBook()}>Book session</Button>
          <Button asChild><Link to="/patients?new=1">New patient</Link></Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><p className="text-sm text-stone-600">Sessions today</p><p className="text-2xl font-semibold">{sessions.isLoading ? '…' : todays.length}</p></Card>
        <Card><p className="text-sm text-stone-600">Website requests</p><p className="text-2xl font-semibold">{sessions.isLoading ? '…' : pending.length}</p></Card>
        {canPay ? <Card><p className="text-sm text-stone-600">Unpaid completed sessions</p><p className="text-2xl font-semibold">{summary.data?.unpaidSessions ?? '…'}</p></Card> : null}
        <Card><p className="text-sm text-stone-600">Sessions this month</p><p className="text-2xl font-semibold">{sessions.isLoading ? '…' : monthCount}</p></Card>
      </div>
      <QueryState isLoading={sessions.isLoading} isError={sessions.isError} error={sessions.error} onRetry={() => void sessions.refetch()} isEmpty={!sessions.isLoading && todays.length === 0} emptyTitle="No sessions today" emptyBody="Upcoming sessions are listed below.">
        <Card>
          <h2 className="font-semibold">Today</h2>
          <ul className="mt-3 divide-y divide-stone-100">
            {todays.map((session) => {
              const person = patients.data?.find((item) => item.id === session.patientId)
              return (
                <li key={session.id}>
                  <button type="button" className="flex w-full items-center justify-between py-2 text-left text-sm hover:bg-stone-50" onClick={() => ui.openSession(session.id)}>
                    <span>{formatTime(session.start)} · {person?.fullName ?? session.requester?.name ?? session.id}</span>
                    <Badge>{statusLabel(session.status)}</Badge>
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      </QueryState>
      <Card>
        <h2 className="font-semibold">{admin ? 'Pending website requests' : 'My pending requests'}</h2>
        {pending.length === 0 ? <p className="mt-2 text-sm text-stone-600">None waiting.</p> : (
          <ul className="mt-2 space-y-2 text-sm">
            {pending.map((session) => (
              <li key={session.id}>
                <button type="button" className="text-teal-900 underline" onClick={() => ui.openSession(session.id)}>
                  {session.requester?.name ?? 'Request'} · {formatTime(session.start)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {!admin ? (
        <Card>
          <h2 className="font-semibold">Upcoming 7 days</h2>
          {upcoming.length === 0 ? <p className="mt-2 text-sm text-stone-600">Nothing booked.</p> : (
            <ul className="mt-2 space-y-1 text-sm">
              {upcoming.slice(0, 8).map((session) => (
                <li key={session.id}>
                  <button type="button" className="text-left hover:underline" onClick={() => ui.openSession(session.id)}>
                    {ymd(new Date(session.start))} {formatTime(session.start)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  )
}
