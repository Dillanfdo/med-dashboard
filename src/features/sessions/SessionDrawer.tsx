import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Copy, ExternalLink, MapPin, Video } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCancelSession,
  useConfirmWebsite,
  useDeclineWebsite,
  useDoctors,
  usePatients,
  useProposeWebsite,
  useRecordPayment,
  useReschedule,
  useRetryMeet,
  useSession,
  useSessionPayments,
  useSetSessionStatus,
  useSettings,
  useSlotCheck,
  useTimeline,
  useWebsiteDetail,
} from '@/api/hooks'
import { usePermission } from '@/lib/permissions'
import { formatDateTime, formatInr, isMinor, isoFromLocal, modeLabel, statusLabel, ymd } from '@/lib/format'
import { errorText } from '@/lib/utils'
import { Badge, Button, Drawer, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import { CANCEL_REASONS, type Session } from '@/types'

function tone(status: Session['status']) {
  if (status === 'CONFIRMED') return 'teal' as const
  if (status === 'REQUESTED' || status === 'RESCHEDULED') return 'amber' as const
  if (status === 'CANCELLED' || status === 'NO_SHOW') return 'red' as const
  return 'stone' as const
}

export function SessionDrawer({ sessionId, onOpenChange }: { sessionId: string | null; onOpenChange: (open: boolean) => void }) {
  const session = useSession(sessionId)
  const timeline = useTimeline(sessionId)
  const patients = usePatients()
  const doctors = useDoctors()
  const settings = useSettings()
  const canPay = usePermission('view', 'payments')
  const payments = useSessionPayments(sessionId, canPay)
  const website = useWebsiteDetail(sessionId, session.data?.source === 'WEBSITE')
  const [action, setAction] = useState<'reschedule' | 'cancel' | 'pay' | 'confirm' | 'propose' | 'decline' | null>(null)
  const data = session.data
  const patient = patients.data?.find((item) => item.id === data?.patientId)
  const doctor = doctors.data?.find((item) => item.id === data?.doctorId)
  const location = settings.data?.locations.find((item) => item.id === data?.locationId)
  const name = patient?.fullName ?? data?.requester?.name

  return (
    <Drawer open={!!sessionId} onOpenChange={onOpenChange} title="Appointment">
      {session.isLoading ? <p className="text-sm text-stone-600">Loading…</p> : null}
      {session.isError ? <p className="text-sm text-red-800">{errorText(session.error)}</p> : null}
      {data ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone={tone(data.status)}>{statusLabel(data.status)}</Badge>
            {data.source === 'WEBSITE' ? <Badge tone="blue">Website</Badge> : <Badge>Clinic</Badge>}
            <Badge>{modeLabel(data.mode)}</Badge>
          </div>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-stone-600">Person</dt>
              <dd className="font-medium">
                {patient ? (
                  <Link className="text-teal-900 underline" to={`/patients/${patient.id}`}>
                    {patient.fullName}
                  </Link>
                ) : (
                  name ?? 'Not linked yet'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-stone-600">Doctor</dt>
              <dd>{doctor?.fullName ?? 'Unassigned'}</dd>
            </div>
            <div>
              <dt className="text-stone-600">When</dt>
              <dd>
                {formatDateTime(data.start)} · {data.durationMinutes} min
              </dd>
            </div>
            <div>
              <dt className="text-stone-600">Mode</dt>
              <dd className="inline-flex items-center gap-1">
                {data.mode === 'ONLINE' ? <Video className="h-4 w-4" aria-hidden /> : <MapPin className="h-4 w-4" aria-hidden />}
                {modeLabel(data.mode)}
                {location ? ` · ${location.name}` : ''}
              </dd>
            </div>
            {data.schedulingNotes ? (
              <div>
                <dt className="text-stone-600">Scheduling note</dt>
                <dd>{data.schedulingNotes}</dd>
              </div>
            ) : null}
          </dl>
          {data.mode === 'ONLINE' ? (
            <div className="rounded-md border border-stone-200 p-3 text-sm">
              <p className="font-medium">Google Meet</p>
              {data.meetStatus === 'CREATING' ? <p aria-live="polite">Creating Meet link…</p> : null}
              {data.meetStatus === 'FAILED' ? (
                <div className="space-y-2">
                  <p className="text-red-800">The Meet link could not be created.</p>
                  <RetryButton id={data.id} />
                </div>
              ) : null}
              {data.meetStatus === 'READY' && data.meetLink ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(data.meetLink!)
                      toast.success('Link copied')
                    }}
                  >
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={data.meetLink} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3 w-3" /> Open
                    </a>
                  </Button>
                </div>
              ) : null}
              <p className="mt-2 text-stone-600">Calendar invite: {data.inviteStatus.split('_').join(' ').toLowerCase()}. Invites never include clinical details.</p>
            </div>
          ) : (
            <p className="text-sm text-stone-600">Calendar invite: {data.inviteStatus.split('_').join(' ').toLowerCase()}.</p>
          )}
          {canPay ? (
            <div className="text-sm">
              <p className="font-medium">Payment</p>
              <p>Fee {formatInr(data.fee)}</p>
              {(payments.data ?? []).length === 0 ? <p className="text-stone-600">No payment recorded.</p> : null}
              {(payments.data ?? []).map((payment) => (
                <p key={payment.id}>
                  {formatInr(payment.amount)} · {payment.status} · {payment.method}
                  {payment.receiptNumber ? ` · ${payment.receiptNumber}` : ''}
                </p>
              ))}
              <Button className="mt-2" size="sm" variant="outline" onClick={() => setAction('pay')}>
                Record payment
              </Button>
            </div>
          ) : null}
          {patient ? (
            <Link className="text-sm text-teal-900 underline" to={`/patients/${patient.id}?tab=notes&session=${data.id}`}>
              Session notes
            </Link>
          ) : null}
          {data.status === 'REQUESTED' && data.source === 'WEBSITE' ? (
            <div className="space-y-2">
              {website.data?.matches.length ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                  <p className="font-medium">Possible existing patient</p>
                  <ul className="mt-1 list-disc pl-4">
                    {website.data.matches.map((match) => (
                      <li key={match.patientId}>
                        {match.label} (matched {match.via})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setAction('confirm')}>
                  Confirm
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAction('propose')}>
                  Propose another time
                </Button>
                <Button size="sm" variant="danger" onClick={() => setAction('decline')}>
                  Decline
                </Button>
              </div>
            </div>
          ) : null}
          {data.status === 'CONFIRMED' || data.status === 'RESCHEDULED' ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setAction('reschedule')}>
                Reschedule
              </Button>
              <Button size="sm" variant="danger" onClick={() => setAction('cancel')}>
                Cancel
              </Button>
              <StatusButtons id={data.id} />
            </div>
          ) : null}
          {data.previousTimes.length > 0 ? (
            <div>
              <p className="text-sm font-medium">Previous times</p>
              <ul className="mt-1 space-y-1 text-sm text-stone-700">
                {data.previousTimes.map((item) => (
                  <li key={item.changedAt}>
                    {formatDateTime(item.start)} · {item.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <p className="text-sm font-medium">Status history</p>
            <ol className="mt-2 space-y-2 border-l border-stone-200 pl-3 text-sm">
              {(timeline.data ?? []).map((event) => (
                <li key={event.id}>
                  <span className="font-medium">{statusLabel(event.status)}</span>
                  <span className="block text-stone-600">
                    {formatDateTime(event.at)} · {event.actorName}
                    {event.note ? ` · ${event.note}` : ''}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          {action === 'reschedule' ? <RescheduleDialog session={data} onClose={() => setAction(null)} /> : null}
          {action === 'cancel' ? <CancelDialog session={data} onClose={() => setAction(null)} /> : null}
          {action === 'pay' && canPay ? <PayDialog session={data} onClose={() => setAction(null)} /> : null}
          {action === 'confirm' ? <ConfirmDialog session={data} matches={website.data?.matches ?? []} onClose={() => setAction(null)} /> : null}
          {action === 'propose' ? <ProposeDialog session={data} onClose={() => setAction(null)} /> : null}
          {action === 'decline' ? <DeclineDialog session={data} onClose={() => setAction(null)} /> : null}
        </div>
      ) : null}
    </Drawer>
  )
}

function RetryButton({ id }: { id: string }) {
  const retry = useRetryMeet()
  return (
    <Button
      size="sm"
      onClick={() =>
        retry.mutate(id, {
          onSuccess: () => toast.message('Creating Meet link…'),
          onError: (error) => toast.error(errorText(error)),
        })
      }
    >
      Retry
    </Button>
  )
}

function StatusButtons({ id }: { id: string }) {
  const update = useSetSessionStatus()
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => update.mutate({ id, status: 'COMPLETED' }, { onError: (error) => toast.error(errorText(error)) })}>
        Mark completed
      </Button>
      <Button size="sm" variant="outline" onClick={() => update.mutate({ id, status: 'NO_SHOW' }, { onError: (error) => toast.error(errorText(error)) })}>
        Mark no-show
      </Button>
    </>
  )
}

const moveSchema = z.object({
  date: z.string().min(1, 'Choose a date'),
  time: z.string().min(1, 'Choose a time'),
  reason: z.string().trim().min(3, 'Add a reason'),
})

function RescheduleDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const form = useForm<z.infer<typeof moveSchema>>({ resolver: zodResolver(moveSchema), defaultValues: { date: ymd(new Date(session.start)), time: '10:00', reason: '' } })
  const save = useReschedule()
  const date = form.watch('date')
  const time = form.watch('time')
  const start = date && time ? isoFromLocal(date, time) : ''
  const slot = useSlotCheck(session.doctorId && start ? { doctorId: session.doctorId, start, durationMinutes: session.durationMinutes, mode: session.mode, excludeSessionId: session.id } : undefined)
  return (
    <Modal open title="Reschedule" description="The calendar invite will be updated." onOpenChange={(open) => !open && onClose()}>
      <form
        className="space-y-3"
        onSubmit={form.handleSubmit(async (values) => {
          if (!session.doctorId) return
          try {
            await save.mutateAsync({ id: session.id, start: isoFromLocal(values.date, values.time), durationMinutes: session.durationMinutes, reason: values.reason })
            toast.success('Session rescheduled')
            onClose()
          } catch (error) {
            toast.error(errorText(error))
          }
        })}
      >
        <Field label="New date" htmlFor="re-date" error={form.formState.errors.date?.message}>
          <Input id="re-date" type="date" {...form.register('date')} />
        </Field>
        <Field label="New time" htmlFor="re-time" error={form.formState.errors.time?.message}>
          <Input id="re-time" type="time" {...form.register('time')} />
        </Field>
        <Field label="Reason" htmlFor="re-reason" error={form.formState.errors.reason?.message}>
          <Textarea id="re-reason" {...form.register('reason')} />
        </Field>
        {slot.data?.message ? <p className="text-sm text-red-800">{slot.data.message}</p> : null}
        <p className="text-sm text-stone-600">Calendar invite will be updated.</p>
        <Button type="submit" disabled={save.isPending || slot.data?.ok === false}>
          Save new time
        </Button>
      </form>
    </Modal>
  )
}

const cancelSchema = z.object({
  preset: z.string().min(1, 'Choose a reason'),
  detail: z.string().optional(),
  cancelledBy: z.enum(['CLINIC', 'PATIENT']),
})

function CancelDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const form = useForm<z.infer<typeof cancelSchema>>({ resolver: zodResolver(cancelSchema), defaultValues: { preset: '', detail: '', cancelledBy: 'CLINIC' } })
  const save = useCancelSession()
  return (
    <Modal open title="Cancel session" description="The calendar event will be cancelled." onOpenChange={(open) => !open && onClose()}>
      <form
        className="space-y-3"
        onSubmit={form.handleSubmit(async (values) => {
          const reason = values.preset === 'Other' ? values.detail?.trim() || '' : `${values.preset}${values.detail ? ` — ${values.detail}` : ''}`
          if (reason.length < 3) {
            form.setError('detail', { message: 'Add a bit more detail' })
            return
          }
          try {
            await save.mutateAsync({ id: session.id, reason, cancelledBy: values.cancelledBy })
            toast.success('Session cancelled')
            onClose()
          } catch (error) {
            toast.error(errorText(error))
          }
        })}
      >
        <Field label="Reason" htmlFor="cx-reason" error={form.formState.errors.preset?.message}>
          <Select id="cx-reason" {...form.register('preset')}>
            <option value="">Select</option>
            {CANCEL_REASONS.map((reason) => (
              <option key={reason}>{reason}</option>
            ))}
          </Select>
        </Field>
        <Field label="Details" htmlFor="cx-detail" error={form.formState.errors.detail?.message}>
          <Textarea id="cx-detail" {...form.register('detail')} />
        </Field>
        <Field label="Who cancelled" htmlFor="cx-who">
          <Select id="cx-who" {...form.register('cancelledBy')}>
            <option value="CLINIC">Clinic</option>
            <option value="PATIENT">Patient</option>
          </Select>
        </Field>
        <p className="text-sm text-stone-600">Calendar event will be cancelled.</p>
        <Button type="submit" variant="danger" disabled={save.isPending}>
          Cancel session
        </Button>
      </form>
    </Modal>
  )
}

const paySchema = z.object({
  amount: z.coerce.number().min(0),
  method: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER']),
  status: z.enum(['PENDING', 'PAID', 'PARTIALLY_PAID', 'WAIVED']),
  reference: z.string().optional(),
  note: z.string().optional(),
})

function PayDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const form = useForm<z.infer<typeof paySchema>>({
    resolver: zodResolver(paySchema),
    defaultValues: { amount: session.fee, method: 'UPI', status: 'PAID', reference: '', note: '' },
  })
  const save = useRecordPayment()
  return (
    <Modal open title="Record payment" description="Use a transaction reference. Do not enter a card number." onOpenChange={(open) => !open && onClose()}>
      <form
        className="space-y-3"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await save.mutateAsync({ sessionId: session.id, ...values, reference: values.reference, note: values.note })
            toast.success('Payment recorded')
            onClose()
          } catch (error) {
            toast.error(errorText(error))
          }
        })}
      >
        <Field label="Amount (INR)" htmlFor="pay-amount">
          <Input id="pay-amount" type="number" {...form.register('amount')} />
        </Field>
        <Field label="Method" htmlFor="pay-method">
          <Select id="pay-method" {...form.register('method')}>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="OTHER">Other</option>
          </Select>
        </Field>
        <Field label="Status" htmlFor="pay-status">
          <Select id="pay-status" {...form.register('status')}>
            <option value="PAID">Paid</option>
            <option value="PARTIALLY_PAID">Partially paid</option>
            <option value="PENDING">Pending</option>
            <option value="WAIVED">Waived</option>
          </Select>
        </Field>
        <Field label="Transaction reference" htmlFor="pay-ref" hint="UPI or bank reference. Never a card number.">
          <Input id="pay-ref" {...form.register('reference')} />
        </Field>
        <Button type="submit" disabled={save.isPending}>
          Save payment
        </Button>
      </form>
    </Modal>
  )
}

function ConfirmDialog({ session, matches, onClose }: { session: Session; matches: { patientId: string; label: string }[]; onClose: () => void }) {
  const doctors = useDoctors()
  const save = useConfirmWebsite()
  const [mode, setMode] = useState<'link' | 'create'>(matches.length ? 'link' : 'create')
  const [patientId, setPatientId] = useState(matches[0]?.patientId ?? '')
  const [doctorId, setDoctorId] = useState(session.doctorId ?? '')
  const [dob, setDob] = useState('')
  const [guardianName, setGuardianName] = useState('')
  const [guardianPhone, setGuardianPhone] = useState('')
  const [guardianEmail, setGuardianEmail] = useState('')
  const [guardianConsent, setGuardianConsent] = useState(false)
  const minor = dob ? isMinor(dob) : false
  const email = session.requester?.email ?? ''
  return (
    <Modal open title="Confirm website request" onOpenChange={(open) => !open && onClose()} wide>
      <div className="space-y-3 text-sm">
        {session.mode === 'ONLINE' ? (
          <p>
            A Google Calendar invite with a Meet link will be sent to <strong>{email || 'the patient email'}</strong>.
          </p>
        ) : (
          <p>A calendar invite will be sent when an email and calendar consent are on file.</p>
        )}
        {!email && session.mode === 'ONLINE' ? <p className="text-red-800">This request has no email. An online session cannot be confirmed until an email is added.</p> : null}
        <Field label="Doctor" htmlFor="cf-doctor">
          <Select id="cf-doctor" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
            <option value="">Select</option>
            {(doctors.data ?? []).filter((item) => item.active).map((item) => (
              <option key={item.id} value={item.id}>
                {item.fullName}
              </option>
            ))}
          </Select>
        </Field>
        {matches.length ? (
          <div className="space-y-2">
            <label className="flex gap-2">
              <input type="radio" checked={mode === 'link'} onChange={() => setMode('link')} /> Link to existing patient
            </label>
            {mode === 'link' ? (
              <Select value={patientId} onChange={(event) => setPatientId(event.target.value)} aria-label="Existing patient">
                {matches.map((match) => (
                  <option key={match.patientId} value={match.patientId}>
                    {match.label}
                  </option>
                ))}
              </Select>
            ) : null}
            <label className="flex gap-2">
              <input type="radio" checked={mode === 'create'} onChange={() => setMode('create')} /> Create new patient
            </label>
          </div>
        ) : (
          <p>No phone or email match. A new patient record will be created.</p>
        )}
        {mode === 'create' ? (
          <Field label="Date of birth" htmlFor="cf-dob" hint="Needed before the record is created. Minors need a guardian.">
            <Input id="cf-dob" type="date" value={dob} onChange={(event) => setDob(event.target.value)} />
          </Field>
        ) : null}
        {mode === 'create' && minor ? (
          <div className="space-y-2">
            <Field label="Guardian name" htmlFor="cf-gname">
              <Input id="cf-gname" value={guardianName} onChange={(event) => setGuardianName(event.target.value)} />
            </Field>
            <Field label="Guardian phone" htmlFor="cf-gphone">
              <Input id="cf-gphone" value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value)} />
            </Field>
            <Field label="Guardian email" htmlFor="cf-gmail">
              <Input id="cf-gmail" value={guardianEmail} onChange={(event) => setGuardianEmail(event.target.value)} />
            </Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={guardianConsent} onChange={(event) => setGuardianConsent(event.target.checked)} /> Guardian consent obtained</label>
            <p className="text-stone-600">Guardian access to therapy notes is not automatic; the treating doctor decides.</p>
          </div>
        ) : null}
        <Button
          disabled={save.isPending || (session.mode === 'ONLINE' && !email)}
          onClick={async () => {
            try {
              if (mode === 'link') {
                await save.mutateAsync({ id: session.id, patientId, doctorId })
              } else {
                if (!session.requester) return
                if (!dob) {
                  toast.error('Enter the date of birth.')
                  return
                }
                await save.mutateAsync({
                  id: session.id,
                  doctorId,
                  patient: {
                    fullName: session.requester.name,
                    dateOfBirth: dob,
                    phone: session.requester.phone,
                    email: session.requester.email,
                    emergencyName: minor ? guardianName : 'To be confirmed',
                    emergencyRelationship: minor ? 'Guardian' : 'Not recorded',
                    emergencyPhone: minor ? guardianPhone : session.requester.phone,
                    assignedDoctorId: doctorId,
                    preferredMode: session.mode,
                    referralSource: 'Website',
                    guardianName: minor ? guardianName : undefined,
                    guardianRelationship: minor ? 'Guardian' : undefined,
                    guardianPhone: minor ? guardianPhone : undefined,
                    guardianEmail: minor ? guardianEmail : undefined,
                    guardianConsent: minor ? guardianConsent : undefined,
                    guardianVerification: minor ? 'Collected while confirming the website request.' : undefined,
                  },
                })
              }
              toast.success(session.mode === 'ONLINE' ? 'Request confirmed. Creating a Meet link.' : 'Request confirmed')
              onClose()
            } catch (error) {
              toast.error(errorText(error))
            }
          }}
        >
          Confirm
        </Button>
      </div>
    </Modal>
  )
}

function ProposeDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const form = useForm<z.infer<typeof moveSchema>>({ resolver: zodResolver(moveSchema), defaultValues: { date: ymd(new Date(session.start)), time: '11:00', reason: '' } })
  const save = useProposeWebsite()
  return (
    <Modal open title="Propose another time" onOpenChange={(open) => !open && onClose()}>
      <form
        className="space-y-3"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await save.mutateAsync({ id: session.id, start: isoFromLocal(values.date, values.time), durationMinutes: session.durationMinutes, reason: values.reason })
            toast.success('New time proposed')
            onClose()
          } catch (error) {
            toast.error(errorText(error))
          }
        })}
      >
        <Field label="Date" htmlFor="pr-date" error={form.formState.errors.date?.message}>
          <Input id="pr-date" type="date" {...form.register('date')} />
        </Field>
        <Field label="Time" htmlFor="pr-time">
          <Input id="pr-time" type="time" {...form.register('time')} />
        </Field>
        <Field label="Reason" htmlFor="pr-reason" error={form.formState.errors.reason?.message}>
          <Textarea id="pr-reason" {...form.register('reason')} />
        </Field>
        <p className="text-sm text-stone-600">The patient will be told about the new time when the real website is connected. This prototype only stores the proposal.</p>
        <Button type="submit">Propose time</Button>
      </form>
    </Modal>
  )
}

function DeclineDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const form = useForm<{ reason: string }>({ resolver: zodResolver(z.object({ reason: z.string().trim().min(3, 'Add a reason') })), defaultValues: { reason: '' } })
  const save = useDeclineWebsite()
  return (
    <Modal open title="Decline request" onOpenChange={(open) => !open && onClose()}>
      <form
        className="space-y-3"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await save.mutateAsync({ id: session.id, reason: values.reason })
            toast.success('Request declined')
            onClose()
          } catch (error) {
            toast.error(errorText(error))
          }
        })}
      >
        <Field label="Reason" htmlFor="de-reason" error={form.formState.errors.reason?.message}>
          <Textarea id="de-reason" {...form.register('reason')} />
        </Field>
        <Button type="submit" variant="danger">
          Decline
        </Button>
      </form>
    </Modal>
  )
}
