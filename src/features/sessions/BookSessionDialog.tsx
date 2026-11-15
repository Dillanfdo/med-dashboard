import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useCreateSession, useDoctors, usePatients, useSavePatient, useSettings, useSlotCheck } from '@/api/hooks'
import type { BookPrefill } from '@/features/sessions/SessionProvider'
import { useAuth } from '@/lib/auth'
import { isMinor, isoFromLocal } from '@/lib/format'
import { errorText } from '@/lib/utils'
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'

const schema = z
  .object({
    patientId: z.string().min(1, 'Choose a patient'),
    doctorId: z.string().min(1, 'Choose a doctor'),
    date: z.string().min(1, 'Choose a date'),
    time: z.string().min(1, 'Choose a time'),
    durationMinutes: z.coerce.number().min(15, 'At least 15 minutes').max(180),
    mode: z.enum(['IN_PERSON', 'ONLINE']),
    locationId: z.string().optional(),
    fee: z.coerce.number().min(0),
    schedulingNotes: z.string().max(280).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'IN_PERSON' && !value.locationId) {
      ctx.addIssue({ code: 'custom', path: ['locationId'], message: 'Choose a clinic location' })
    }
  })

const inlineSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the name'),
  dateOfBirth: z.string().min(1, 'Enter the date of birth'),
  phone: z.string().min(10, 'Enter a mobile number'),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')),
})

type BookValues = z.infer<typeof schema>

export function BookSessionDialog({
  open,
  onOpenChange,
  prefill,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  prefill?: BookPrefill
  onCreated: (id: string) => void
}) {
  const { actor } = useAuth()
  const doctors = useDoctors()
  const patients = usePatients()
  const settings = useSettings()
  const create = useCreateSession()
  const savePatient = useSavePatient()
  const [step, setStep] = useState<'form' | 'confirm'>('form')
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const isAdmin = actor?.activeRole === 'ADMIN'
  const form = useForm<BookValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      patientId: '',
      doctorId: actor?.activeRole === 'DOCTOR' ? actor.doctorId ?? '' : '',
      date: '',
      time: '10:00',
      durationMinutes: 50,
      mode: 'IN_PERSON',
      locationId: '',
      fee: 0,
      schedulingNotes: '',
    },
  })
  const inline = useForm<z.infer<typeof inlineSchema>>({
    resolver: zodResolver(inlineSchema),
    defaultValues: { fullName: '', dateOfBirth: '', phone: '', email: '' },
  })

  useEffect(() => {
    if (!open) return
    setStep('form')
    const doctorId = prefill?.doctorId || (actor?.activeRole === 'DOCTOR' ? actor.doctorId ?? '' : '')
    const doctor = doctors.data?.find((item) => item.id === doctorId)
    form.reset({
      patientId: '',
      doctorId,
      date: prefill?.date ?? '',
      time: prefill?.time ?? '10:00',
      durationMinutes: doctor?.defaultDuration ?? 50,
      mode: doctor?.modes[0] ?? 'IN_PERSON',
      locationId: settings.data?.locations[0]?.id ?? '',
      fee: doctor?.defaultFee ?? 0,
      schedulingNotes: '',
    })
    // Reset only when the dialog opens. Doctor and location lists are read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill?.date, prefill?.time, prefill?.doctorId])

  const doctorId = form.watch('doctorId')
  const date = form.watch('date')
  const time = form.watch('time')
  const duration = Number(form.watch('durationMinutes'))
  const mode = form.watch('mode')
  const patientId = form.watch('patientId')
  const start = date && time ? isoFromLocal(date, time) : ''
  const slot = useSlotCheck(doctorId && start ? { doctorId, start, durationMinutes: duration || 50, mode } : undefined)
  const patient = patients.data?.find((item) => item.id === patientId)
  const filtered = (patients.data ?? []).filter((item) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return item.fullName.toLowerCase().includes(q) || item.phone.includes(q.replace(/\s/g, '')) || item.id.toLowerCase().includes(q)
  })

  useEffect(() => {
    const doctor = doctors.data?.find((item) => item.id === doctorId)
    if (!doctor) return
    form.setValue('durationMinutes', doctor.defaultDuration)
    if (isAdmin) form.setValue('fee', doctor.defaultFee)
    else form.setValue('fee', doctor.defaultFee)
  }, [doctorId, doctors.data, form, isAdmin])

  const submit = form.handleSubmit((values) => {
    if (slot.data && !slot.data.ok) return
    if (values.mode === 'ONLINE' && !patient?.email) {
      form.setError('patientId', { message: 'This patient has no email. Add one before booking online.' })
      return
    }
    setStep('confirm')
  })

  const save = form.handleSubmit(async (values) => {
    try {
      const session = await create.mutateAsync({
        patientId: values.patientId,
        doctorId: values.doctorId,
        start: isoFromLocal(values.date, values.time),
        durationMinutes: values.durationMinutes,
        mode: values.mode,
        locationId: values.mode === 'IN_PERSON' ? values.locationId : undefined,
        fee: values.fee,
        schedulingNotes: values.schedulingNotes,
      })
      toast.success(values.mode === 'ONLINE' ? 'Session booked. Creating a Meet link.' : 'Session booked')
      onCreated(session.id)
    } catch (error) {
      toast.error(errorText(error))
    }
  })

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Book session" description="Scheduling details only. Do not put clinical information here." wide>
      {step === 'form' ? (
        <form className="space-y-3" onSubmit={submit}>
          <Field label="Patient" htmlFor="book-search" error={form.formState.errors.patientId?.message}>
            <Input id="book-search" placeholder="Search name, phone, or id" value={query} onChange={(event) => setQuery(event.target.value)} />
            <div className="mt-2 max-h-36 overflow-auto rounded-md border border-stone-200">
              {filtered.slice(0, 8).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`block w-full px-3 py-2 text-left text-sm hover:bg-stone-50 ${patientId === item.id ? 'bg-teal-50' : ''}`}
                  onClick={() => form.setValue('patientId', item.id, { shouldValidate: true })}
                >
                  {item.fullName} <span className="text-stone-500">{item.id}</span>
                  {!item.email ? <span className="ml-2 text-amber-800">No email</span> : null}
                </button>
              ))}
              {filtered.length === 0 ? <p className="px-3 py-2 text-sm text-stone-600">No matching patient.</p> : null}
            </div>
            <button type="button" className="mt-1 text-sm text-teal-900 underline" onClick={() => setCreating((value) => !value)}>
              {creating ? 'Hide new patient' : 'Create new patient'}
            </button>
          </Field>
          {creating ? (
            <div className="space-y-2 rounded-md border border-stone-200 p-3">
              <Field label="Name" htmlFor="inline-name" error={inline.formState.errors.fullName?.message}>
                <Input id="inline-name" {...inline.register('fullName')} />
              </Field>
              <Field label="Date of birth" htmlFor="inline-dob" error={inline.formState.errors.dateOfBirth?.message}>
                <Input id="inline-dob" type="date" {...inline.register('dateOfBirth')} />
              </Field>
              <Field label="Phone" htmlFor="inline-phone" error={inline.formState.errors.phone?.message}>
                <Input id="inline-phone" {...inline.register('phone')} />
              </Field>
              <Field label="Email" htmlFor="inline-email" error={inline.formState.errors.email?.message}>
                <Input id="inline-email" {...inline.register('email')} />
              </Field>
              {isMinor(inline.watch('dateOfBirth') || '2000-01-01') && inline.watch('dateOfBirth') ? (
                <p className="text-sm text-amber-900">This date of birth is under 18. Use the full patient form so a guardian can be recorded.</p>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={savePatient.isPending}
                onClick={inline.handleSubmit(async (values) => {
                  if (isMinor(values.dateOfBirth)) {
                    toast.error('Minors need a guardian. Open Patients and use Onboard patient.')
                    return
                  }
                  const doctor = form.getValues('doctorId') || actor?.doctorId
                  if (!doctor) {
                    toast.error('Choose a doctor first.')
                    return
                  }
                  try {
                    const created = await savePatient.mutateAsync({
                      values: {
                        fullName: values.fullName,
                        dateOfBirth: values.dateOfBirth,
                        phone: values.phone,
                        email: values.email,
                        emergencyName: 'To be confirmed',
                        emergencyRelationship: 'Not recorded',
                        emergencyPhone: values.phone,
                        assignedDoctorId: doctor,
                        preferredMode: 'EITHER',
                        referralSource: 'Self',
                      },
                    })
                    form.setValue('patientId', created.id, { shouldValidate: true })
                    setCreating(false)
                    toast.success('Patient record saved')
                  } catch (error) {
                    toast.error(errorText(error))
                  }
                })}
              >
                Save patient
              </Button>
            </div>
          ) : null}
          {isAdmin ? (
            <Field label="Doctor" htmlFor="book-doctor" error={form.formState.errors.doctorId?.message}>
              <Select id="book-doctor" {...form.register('doctorId')}>
                <option value="">Select</option>
                {(doctors.data ?? []).filter((item) => item.active).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.fullName} · {item.designation}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <p className="text-sm text-stone-600">Doctor: {actor?.name}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Date" htmlFor="book-date" error={form.formState.errors.date?.message}>
              <Input id="book-date" type="date" {...form.register('date')} />
            </Field>
            <Field label="Time" htmlFor="book-time" error={form.formState.errors.time?.message}>
              <Input id="book-time" type="time" {...form.register('time')} />
            </Field>
          </div>
          <Field label="Duration (minutes)" htmlFor="book-duration" error={form.formState.errors.durationMinutes?.message}>
            <Input id="book-duration" type="number" {...form.register('durationMinutes')} />
          </Field>
          <Field label="Mode" htmlFor="book-mode">
            <Select id="book-mode" {...form.register('mode')}>
              <option value="IN_PERSON">In person</option>
              <option value="ONLINE">Online</option>
            </Select>
          </Field>
          {mode === 'IN_PERSON' ? (
            <Field label="Location" htmlFor="book-location" error={form.formState.errors.locationId?.message}>
              <Select id="book-location" {...form.register('locationId')}>
                <option value="">Select</option>
                {(settings.data?.locations ?? []).map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Fee (INR)" htmlFor="book-fee" hint={isAdmin ? 'Defaults from the doctor. Admins can change it.' : 'Set from the doctor profile. Only an admin can change it.'}>
            <Input id="book-fee" type="number" readOnly={!isAdmin} {...form.register('fee')} />
          </Field>
          <Field label="Scheduling note" htmlFor="book-note" hint="Not clinical. Kept off the calendar invite.">
            <Textarea id="book-note" {...form.register('schedulingNotes')} />
          </Field>
          {slot.data?.message ? (
            <p className="text-sm text-red-800" role="alert">
              {slot.data.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button type="submit">Continue</Button>
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-stone-800">
            {mode === 'ONLINE' ? (
              <>
                A Google Calendar invite with a Meet link will be sent to <strong>{patient?.email}</strong>.
              </>
            ) : (
              <>A Google Calendar invite will be sent when calendar consent is on{patient?.email ? ` (${patient.email})` : ''}.</>
            )}
          </p>
          <p className="text-sm text-stone-600">Invites contain the time and, for online sessions, a Meet link. They never contain clinical details.</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setStep('form')}>
              Back
            </Button>
            <Button type="button" disabled={create.isPending || slot.data?.ok === false} onClick={() => void save()}>
              {create.isPending ? 'Saving…' : 'Save session'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
