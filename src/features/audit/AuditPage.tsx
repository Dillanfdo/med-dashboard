import { useEffect, useState } from 'react'
import { useAudit, useDoctors } from '@/api/hooks'
import { formatDateTime } from '@/lib/format'
import { QueryState, Select, Input } from '@/components/ui'
import type { AuditAction } from '@/types'

const actions: AuditAction[] = ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN', 'BREAK_GLASS', 'PERMISSION_CHANGE']

export function AuditPage() {
  const [actorId, setActorId] = useState('')
  const [action, setAction] = useState<AuditAction | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const audit = useAudit({ actorId, action, from, to })
  const doctors = useDoctors()
  useEffect(() => { document.title = 'Audit log · Northlight' }, [])
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-stone-600">Read-only. New actions in this prototype appear at the top.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <Select aria-label="Actor" value={actorId} onChange={(event) => setActorId(event.target.value)}>
          <option value="">All actors</option>
          {(doctors.data ?? []).map((doctor) => <option key={doctor.userId} value={doctor.userId}>{doctor.fullName}</option>)}
          <option value="usr_sana">Sana Kapoor</option>
        </Select>
        <Select aria-label="Action" value={action} onChange={(event) => setAction(event.target.value as AuditAction | '')}>
          <option value="">All actions</option>
          {actions.map((item) => <option key={item}>{item}</option>)}
        </Select>
        <Input type="date" aria-label="From" value={from} onChange={(event) => setFrom(event.target.value)} />
        <Input type="date" aria-label="To" value={to} onChange={(event) => setTo(event.target.value)} />
      </div>
      <QueryState isLoading={audit.isLoading} isError={audit.isError} error={audit.error} onRetry={() => void audit.refetch()} isEmpty={(audit.data ?? []).length === 0} emptyTitle="No events">
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="px-3 py-2">When</th><th className="px-3 py-2">Actor</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Resource</th><th className="px-3 py-2">Outcome</th><th className="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {(audit.data ?? []).map((event) => (
                <tr key={event.id} className="border-t border-stone-100">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(event.at)}</td>
                  <td className="px-3 py-2">{event.actorName}</td>
                  <td className="px-3 py-2">{event.actorRole}</td>
                  <td className="px-3 py-2">{event.action}</td>
                  <td className="px-3 py-2">{event.resourceType} · {event.resourceId}</td>
                  <td className="px-3 py-2">{event.outcome}</td>
                  <td className="px-3 py-2">{event.reason ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>
    </div>
  )
}
