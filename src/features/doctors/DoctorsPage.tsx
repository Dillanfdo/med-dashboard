import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useDeactivateDoctor, useDoctors, usePatients, useRefreshActor, useSaveDoctor, useUpcomingDoctor } from '@/api/hooks'
import { useAuth } from '@/lib/auth'
import { formatDateTime, formatInr, registrationAlert } from '@/lib/format'
import { errorText } from '@/lib/utils'
import { Badge, Button, Card, Field, Input, Modal, Select } from '@/components/ui'
import type { DoctorProfile, SessionMode } from '@/types'

const schema = z.object({
  fullName: z.string().trim().min(2, 'Enter the name'),
  dateOfBirth: z.string().min(1, 'Enter the date of birth'),
  designation: z.enum(['Clinical Psychologist', 'Counsellor', 'Psychiatrist', 'Other']),
  qualification: z.string().trim().min(2, 'Enter a qualification'),
  institution: z.string().trim().min(2, 'Enter an institution'),
  rciNumber: z.string().optional(),
  rciStatus: z.enum(['REGISTERED', 'EXPIRED', 'NOT_APPLICABLE']),
  rciExpiry: z.string().optional(),
  otherRegistration: z.string().optional(),
  email: z.string().trim().email('Enter a Google account email'),
  phone: z.string().min(10, 'Enter a mobile number'),
  inPerson: z.boolean(),
  online: z.boolean(),
  defaultFee: z.coerce.number().min(0),
  defaultDuration: z.coerce.number().min(15).max(180),
  bufferMinutes: z.coerce.number().min(0).max(60),
  alsoAdmin: z.boolean(),
}).refine((value) => value.inPerson || value.online, { message: 'Choose at least one mode', path: ['online'] })

type Values = z.infer<typeof schema>

export function DoctorsPage() {
  const doctors = useDoctors()
  const [editing, setEditing] = useState<DoctorProfile | null>(null)
  const [open, setOpen] = useState(false)
  const [deactivateId, setDeactivateId] = useState<string | null>(null)
  useEffect(() => { document.title = 'Doctors · Northlight' }, [])
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Doctors</h1>
          <p className="text-sm text-stone-600">Professional registration is tracked separately from the Doctor role.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true) }}>Onboard doctor</Button>
      </div>
      <div className="grid gap-3">
        {(doctors.data ?? []).map((doctor) => {
          const flag = registrationAlert(doctor.rciExpiry)
          return (
            <Card key={doctor.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{doctor.fullName}</h2>
                  <p className="text-sm text-stone-600">{doctor.designation} · {doctor.qualification}</p>
                  <p className="text-sm text-stone-600">{doctor.institution}</p>
                  <p className="text-sm">{doctor.email} · {doctor.phone}</p>
                  <p className="text-sm">Fee {formatInr(doctor.defaultFee)} · {doctor.defaultDuration} min · buffer {doctor.bufferMinutes} min</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {!doctor.active ? <Badge tone="red">Inactive</Badge> : <Badge tone="teal">Active</Badge>}
                    {doctor.alsoAdmin ? <Badge tone="blue">Also admin</Badge> : null}
                    {flag === 'expired' ? <Badge tone="red">Registration expired</Badge> : null}
                    {flag === 'expiring' ? <Badge tone="amber">Registration expiring within 60 days</Badge> : null}
                    {doctor.rciNumber ? <Badge>RCI {doctor.rciNumber}</Badge> : null}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(doctor); setOpen(true) }}>Edit</Button>
                  {doctor.active ? <Button size="sm" variant="danger" onClick={() => setDeactivateId(doctor.id)}>Deactivate</Button> : null}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
      <DoctorForm key={editing?.id ?? 'new'} open={open} doctor={editing ?? undefined} onOpenChange={setOpen} />
      <DeactivateDialog id={deactivateId} onClose={() => setDeactivateId(null)} />
    </div>
  )
}

function DoctorForm({ open, onOpenChange, doctor }: { open: boolean; onOpenChange: (open: boolean) => void; doctor?: DoctorProfile }) {
  const save = useSaveDoctor()
  const refresh = useRefreshActor()
  const { setSession } = useAuth()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: doctor?.fullName ?? '',
      dateOfBirth: doctor?.dateOfBirth ?? '',
      designation: doctor?.designation ?? 'Counsellor',
      qualification: doctor?.qualification ?? '',
      institution: doctor?.institution ?? '',
      rciNumber: doctor?.rciNumber ?? '',
      rciStatus: doctor?.rciStatus ?? 'REGISTERED',
      rciExpiry: doctor?.rciExpiry ?? '',
      otherRegistration: doctor?.otherRegistration ?? '',
      email: doctor?.email ?? '',
      phone: doctor?.phone ?? '',
      inPerson: doctor?.modes.includes('IN_PERSON') ?? true,
      online: doctor?.modes.includes('ONLINE') ?? true,
      defaultFee: doctor?.defaultFee ?? 1500,
      defaultDuration: doctor?.defaultDuration ?? 50,
      bufferMinutes: doctor?.bufferMinutes ?? 10,
      alsoAdmin: doctor?.alsoAdmin ?? false,
    },
  })
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={doctor ? 'Edit doctor' : 'Onboard doctor'} wide>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(async (values) => {
        const modes: SessionMode[] = []
        if (values.inPerson) modes.push('IN_PERSON')
        if (values.online) modes.push('ONLINE')
        try {
          await save.mutateAsync({
            id: doctor?.id,
            values: { ...values, modes, active: doctor?.active ?? true, rciNumber: values.rciNumber, rciExpiry: values.rciExpiry, otherRegistration: values.otherRegistration },
          })
          const actor = await refresh.mutateAsync()
          if (actor) setSession(actor)
          toast.success('Doctor profile saved')
          onOpenChange(false)
        } catch (error) {
          toast.error(errorText(error))
        }
      })}>
        <Field label="Full name" htmlFor="d-name" error={form.formState.errors.fullName?.message}><Input id="d-name" {...form.register('fullName')} /></Field>
        <Field label="Date of birth" htmlFor="d-dob" hint="Doctors cannot be under 18." error={form.formState.errors.dateOfBirth?.message}><Input id="d-dob" type="date" {...form.register('dateOfBirth')} /></Field>
        <Field label="Designation" htmlFor="d-des"><Select id="d-des" {...form.register('designation')}><option>Clinical Psychologist</option><option>Counsellor</option><option>Psychiatrist</option><option>Other</option></Select></Field>
        <Field label="Qualification" htmlFor="d-q" error={form.formState.errors.qualification?.message}><Input id="d-q" {...form.register('qualification')} /></Field>
        <Field label="Institution" htmlFor="d-i" error={form.formState.errors.institution?.message}><Input id="d-i" {...form.register('institution')} /></Field>
        <Field label="Email (Google account)" htmlFor="d-email" error={form.formState.errors.email?.message}><Input id="d-email" {...form.register('email')} /></Field>
        <Field label="Phone" htmlFor="d-phone" error={form.formState.errors.phone?.message}><Input id="d-phone" {...form.register('phone')} /></Field>
        <Field label="RCI number (optional)" htmlFor="d-rci"><Input id="d-rci" {...form.register('rciNumber')} /></Field>
        <Field label="Registration status" htmlFor="d-status"><Select id="d-status" {...form.register('rciStatus')}><option value="REGISTERED">Registered</option><option value="EXPIRED">Expired</option><option value="NOT_APPLICABLE">Not applicable</option></Select></Field>
        <Field label="Registration expiry" htmlFor="d-exp"><Input id="d-exp" type="date" {...form.register('rciExpiry')} /></Field>
        <Field label="Other registration" htmlFor="d-other"><Input id="d-other" {...form.register('otherRegistration')} /></Field>
        <Field label="Default fee (INR)" htmlFor="d-fee"><Input id="d-fee" type="number" {...form.register('defaultFee')} /></Field>
        <Field label="Default duration" htmlFor="d-dur"><Input id="d-dur" type="number" {...form.register('defaultDuration')} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('inPerson')} /> In person</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register('online')} /> Online</label>
        {form.formState.errors.online ? <p className="text-sm text-red-800">{form.formState.errors.online.message}</p> : null}
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" {...form.register('alsoAdmin')} /> Also acts as admin</label>
        <div className="sm:col-span-2"><Button type="submit" disabled={save.isPending}>Save</Button></div>
      </form>
    </Modal>
  )
}

function DeactivateDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const upcoming = useUpcomingDoctor(id)
  const doctors = useDoctors()
  const patients = usePatients()
  const save = useDeactivateDoctor()
  const [map, setMap] = useState<Record<string, string>>({})
  const others = (doctors.data ?? []).filter((doctor) => doctor.id !== id && doctor.active)
  return (
    <Modal open={!!id} onOpenChange={(open) => !open && onClose()} title="Deactivate doctor" description="Access is revoked. Upcoming sessions must be reassigned first." wide>
      <div className="space-y-3 text-sm">
        {(upcoming.data ?? []).length === 0 ? <p>No upcoming sessions.</p> : (upcoming.data ?? []).map((session) => (
          <label key={session.id} className="block">
            {formatDateTime(session.start)} · {patients.data?.find((item) => item.id === session.patientId)?.fullName ?? session.requester?.name ?? 'Unlinked'}
            <Select className="mt-1" value={map[session.id] ?? ''} onChange={(event) => setMap((current) => ({ ...current, [session.id]: event.target.value }))}>
              <option value="">Reassign to</option>
              {others.map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}
            </Select>
          </label>
        ))}
        <Button disabled={save.isPending} variant="danger" onClick={async () => {
          if (!id) return
          const assignments = (upcoming.data ?? []).map((session) => ({ sessionId: session.id, doctorId: map[session.id] }))
          if (assignments.some((item) => !item.doctorId)) {
            toast.error('Choose a doctor for every upcoming session.')
            return
          }
          try {
            await save.mutateAsync({ id, assignments })
            toast.success('Doctor deactivated')
            onClose()
          } catch (error) {
            toast.error(errorText(error))
          }
        }}>Deactivate</Button>
      </div>
    </Modal>
  )
}
