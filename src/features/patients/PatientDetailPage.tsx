import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useAddRights, useAudit, useConsents, useDoctors, useExportPatient, useGuardian, usePatient, usePayments, useRights, useSessions, useSetConsent, useUpdateRights } from '@/api/hooks'
import { NotesPanel } from '@/features/notes/NotesPanel'
import { PatientFormDialog } from '@/features/patients/PatientFormDialog'
import { useSessionUi } from '@/features/sessions/SessionProvider'
import { ageInYears, formatDate, formatDateTime, formatInr, formatPhone, isMinor, modeLabel } from '@/lib/format'
import { usePermission } from '@/lib/permissions'
import { errorText } from '@/lib/utils'
import { Badge, Button, Card, Field, Input, Modal, QueryState, Select, Tabs, TabsContent, TabsList, TabsTrigger, Textarea } from '@/components/ui'
import type { ConsentKind, RightsStatus, RightsType } from '@/types'

const consentCopy: Record<ConsentKind, string> = {
  TREATMENT_RECORDS: 'Storing treatment records',
  CALENDAR_INVITES: 'Google Calendar invites and reminders by email',
  GOOGLE_MEET: 'Online sessions via Google Meet',
  PROMOTIONAL: 'Promotional communication',
}

export function PatientDetailPage() {
  const { patientId = '' } = useParams()
  const [params] = useSearchParams()
  const patient = usePatient(patientId)
  const guardian = useGuardian(patientId)
  const consents = useConsents(patientId)
  const doctors = useDoctors()
  const sessions = useSessions()
  const canPay = usePermission('view', 'payments')
  const canAudit = usePermission('view', 'audit')
  const canExport = usePermission('export', 'patients')
  const payments = usePayments(undefined, canPay)
  const audit = useAudit(undefined, canAudit)
  const setConsent = useSetConsent()
  const [edit, setEdit] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const ui = useSessionUi()
  useEffect(() => {
    document.title = 'Patient record · Northlight'
  }, [])
  const tab = params.get('tab') ?? 'overview'
  const doctor = doctors.data?.find((item) => item.id === patient.data?.assignedDoctorId)
  const ownSessions = (sessions.data ?? []).filter((session) => session.patientId === patientId)
  const ownPayments = (payments.data ?? []).filter((payment) => payment.patientId === patientId)
  const activity = (audit.data ?? []).filter((event) => event.resourceId === patientId || ownSessions.some((session) => session.id === event.resourceId))

  return (
    <QueryState isLoading={patient.isLoading} isError={patient.isError} error={patient.error} onRetry={() => void patient.refetch()}>
      {patient.data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">{patient.data.fullName}</h1>
              <p className="text-sm text-stone-600">{patient.data.id} · Age {ageInYears(patient.data.dateOfBirth)} {isMinor(patient.data.dateOfBirth) ? '· Minor' : ''}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEdit(true)}>Edit</Button>
              {canExport ? <Button variant="outline" onClick={() => setExportOpen(true)}>Export patient record</Button> : null}
            </div>
          </div>
          <Tabs defaultValue={tab}>
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="consents">Consents</TabsTrigger>
              {canPay ? <TabsTrigger value="payments">Payments</TabsTrigger> : null}
              {canAudit ? <TabsTrigger value="activity">Activity</TabsTrigger> : null}
            </TabsList>
            <TabsContent value="overview">
              <Card>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-stone-600">Phone</dt><dd>{formatPhone(patient.data.phone)}</dd></div>
                  <div><dt className="text-stone-600">Email</dt><dd>{patient.data.email || 'None'}</dd></div>
                  <div><dt className="text-stone-600">Doctor</dt><dd>{doctor?.fullName}</dd></div>
                  <div><dt className="text-stone-600">Preferred mode</dt><dd>{modeLabel(patient.data.preferredMode)}</dd></div>
                  <div><dt className="text-stone-600">Referral</dt><dd>{patient.data.referralSource}</dd></div>
                  <div><dt className="text-stone-600">Status</dt><dd>{patient.data.status === 'ACTIVE' ? 'Active' : 'Closed'}</dd></div>
                  <div><dt className="text-stone-600">Emergency</dt><dd>{patient.data.emergencyContact.name} · {patient.data.emergencyContact.relationship} · {formatPhone(patient.data.emergencyContact.phone)}</dd></div>
                  {patient.data.address ? <div><dt className="text-stone-600">Address</dt><dd>{patient.data.address.line1}, {patient.data.address.city}</dd></div> : null}
                </dl>
                {guardian.data ? (
                  <div className="mt-4 rounded-md bg-amber-50 p-3 text-sm">
                    <p className="font-medium">Guardian · {guardian.data.name}</p>
                    <p>{guardian.data.relationship} · {formatPhone(guardian.data.phone)} · {guardian.data.email}</p>
                    <p>Consent obtained: {guardian.data.consentObtained ? 'Yes' : 'No'}</p>
                    <p>{guardian.data.verificationNote}</p>
                    <p className="mt-1 text-stone-700">Guardian access to therapy notes is not automatic; the treating doctor decides.</p>
                  </div>
                ) : null}
                <RightsBlock patientId={patientId} />
              </Card>
            </TabsContent>
            <TabsContent value="sessions">
              {ownSessions.length === 0 ? <p className="text-sm text-stone-600">No sessions yet.</p> : (
                <ul className="space-y-2 text-sm">
                  {ownSessions.map((session) => (
                    <li key={session.id}>
                      <button type="button" className="text-teal-900 underline" onClick={() => ui.openSession(session.id)}>{formatDate(session.start)} · {session.status}</button>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="notes">
              <NotesPanel patientId={patientId} initialSession={params.get('session') ?? undefined} />
            </TabsContent>
            <TabsContent value="consents">
              <div className="space-y-3">
                {(Object.keys(consentCopy) as ConsentKind[]).map((kind) => {
                  const row = consents.data?.find((item) => item.kind === kind)
                  return (
                    <label key={kind} className="flex items-start justify-between gap-3 rounded-md border border-stone-200 bg-white p-3 text-sm">
                      <span>
                        {consentCopy[kind]}
                        <span className="block text-xs text-stone-600">{row ? `Updated ${formatDateTime(row.updatedAt)}` : 'Not recorded'}</span>
                      </span>
                      <input type="checkbox" checked={!!row?.granted} onChange={(event) => setConsent.mutate({ id: patientId, kind, granted: event.target.checked }, { onError: (error) => toast.error(errorText(error)) })} />
                    </label>
                  )
                })}
                <div className="rounded-md border border-stone-200 bg-stone-50 p-3 text-sm text-stone-500">Session recording: not offered</div>
              </div>
            </TabsContent>
            {canPay ? (
              <TabsContent value="payments">
                {ownPayments.length === 0 ? <p className="text-sm text-stone-600">No payments.</p> : ownPayments.map((payment) => (
                  <p key={payment.id} className="text-sm">{formatDate(payment.recordedAt)} · {formatInr(payment.amount)} · {payment.status} · {payment.method}</p>
                ))}
              </TabsContent>
            ) : null}
            {canAudit ? (
              <TabsContent value="activity">
                {activity.length === 0 ? <p className="text-sm text-stone-600">No audit entries for this record yet.</p> : (
                  <ul className="space-y-1 text-sm">
                    {activity.slice(0, 40).map((event) => (
                      <li key={event.id}>{formatDateTime(event.at)} · {event.actorName} · {event.action} · {event.resourceType}</li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            ) : null}
          </Tabs>
          <PatientFormDialog open={edit} patient={patient.data} onOpenChange={setEdit} />
          <ExportDialog open={exportOpen} patientId={patientId} onOpenChange={setExportOpen} />
        </div>
      ) : null}
    </QueryState>
  )
}

function RightsBlock({ patientId }: { patientId: string }) {
  const rights = useRights(patientId)
  const add = useAddRights()
  const update = useUpdateRights()
  const form = useForm<{ type: RightsType; dueDate: string; detail: string }>({
    resolver: zodResolver(z.object({ type: z.enum(['ACCESS', 'CORRECTION', 'ERASURE', 'GRIEVANCE']), dueDate: z.string().min(1), detail: z.string().min(3) })),
    defaultValues: { type: 'ACCESS', dueDate: '', detail: '' },
  })
  return (
    <div className="mt-4">
      <h2 className="font-medium">Requests</h2>
      <ul className="mt-2 space-y-2 text-sm">
        {(rights.data ?? []).map((request) => (
          <li key={request.id} className="flex flex-wrap items-center gap-2">
            <Badge>{request.type}</Badge>
            <span>Due {request.dueDate}</span>
            <span>{request.detail}</span>
            <Select aria-label="Request status" value={request.status} onChange={(event) => update.mutate({ id: patientId, requestId: request.id, status: event.target.value as RightsStatus })}>
              <option value="OPEN">Open</option>
              <option value="IN_REVIEW">In review</option>
              <option value="DONE">Done</option>
            </Select>
          </li>
        ))}
        {(rights.data ?? []).length === 0 ? <li className="text-stone-600">No rights requests logged.</li> : null}
      </ul>
      <form className="mt-3 grid gap-2 sm:grid-cols-2" onSubmit={form.handleSubmit(async (values) => {
        try {
          await add.mutateAsync({ id: patientId, ...values })
          form.reset({ type: 'ACCESS', dueDate: '', detail: '' })
          toast.success('Request logged')
        } catch (error) {
          toast.error(errorText(error))
        }
      })}>
        <Select aria-label="Request type" {...form.register('type')}><option value="ACCESS">Access</option><option value="CORRECTION">Correction</option><option value="ERASURE">Erasure</option><option value="GRIEVANCE">Grievance</option></Select>
        <Input type="date" aria-label="Due date" {...form.register('dueDate')} />
        <Textarea className="sm:col-span-2" placeholder="What was asked" {...form.register('detail')} />
        <Button type="submit" size="sm">Log request</Button>
      </form>
    </div>
  )
}

function ExportDialog({ open, onOpenChange, patientId }: { open: boolean; onOpenChange: (open: boolean) => void; patientId: string }) {
  const form = useForm<{ reason: string }>({ resolver: zodResolver(z.object({ reason: z.string().trim().min(3, 'Add a reason') })), defaultValues: { reason: '' } })
  const exp = useExportPatient()
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Export patient record" description="This prototype does not download a real file.">
      <form className="space-y-3" onSubmit={form.handleSubmit(async (values) => {
        try {
          await exp.mutateAsync({ id: patientId, reason: values.reason })
          toast.success('Export noted. No file was downloaded.')
          onOpenChange(false)
        } catch (error) {
          toast.error(errorText(error))
        }
      })}>
        <Field label="Reason" htmlFor="ex-reason" error={form.formState.errors.reason?.message}><Textarea id="ex-reason" {...form.register('reason')} /></Field>
        <Button type="submit">Confirm export</Button>
      </form>
    </Modal>
  )
}

