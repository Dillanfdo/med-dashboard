import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useDoctors, useSavePatient } from '@/api/hooks'
import type { PatientInput } from '@/api'
import { useAuth } from '@/lib/auth'
import { isMinor } from '@/lib/format'
import { errorText } from '@/lib/utils'
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui'
import type { Patient } from '@/types'

const schema = z
  .object({
    fullName: z.string().trim().min(2, 'Enter the full name'),
    dateOfBirth: z.string().min(1, 'Enter the date of birth'),
    gender: z.string().optional(),
    phone: z.string().trim().min(10, 'Enter a mobile number'),
    email: z.string().trim(),
    addressLine: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    pin: z.string().optional(),
    emergencyName: z.string().trim().min(2, 'Enter an emergency contact'),
    emergencyRelationship: z.string().trim().min(2, 'Enter the relationship'),
    emergencyPhone: z.string().trim().min(10, 'Enter a phone number'),
    assignedDoctorId: z.string().min(1, 'Choose a doctor'),
    preferredMode: z.enum(['IN_PERSON', 'ONLINE', 'EITHER']),
    referralSource: z.enum(['Website', 'Doctor referral', 'Self', 'School', 'Other']),
    status: z.enum(['ACTIVE', 'CLOSED']),
    guardianName: z.string().optional(),
    guardianRelationship: z.string().optional(),
    guardianPhone: z.string().optional(),
    guardianEmail: z.string().optional(),
    guardianConsent: z.boolean().optional(),
    guardianVerification: z.string().optional(),
    records: z.boolean(),
    calendar: z.boolean(),
    meet: z.boolean(),
    promo: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.email && !z.string().email().safeParse(value.email).success) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'Enter a valid email or leave it blank' })
    }
    if (value.dateOfBirth && isMinor(value.dateOfBirth)) {
      if (!value.guardianName || value.guardianName.trim().length < 2) ctx.addIssue({ code: 'custom', path: ['guardianName'], message: 'Enter the guardian name' })
      if (!value.guardianPhone || value.guardianPhone.trim().length < 10) ctx.addIssue({ code: 'custom', path: ['guardianPhone'], message: 'Enter the guardian phone' })
      if (!value.guardianEmail || !z.string().email().safeParse(value.guardianEmail).success) ctx.addIssue({ code: 'custom', path: ['guardianEmail'], message: 'Enter the guardian email' })
      if (!value.guardianConsent) ctx.addIssue({ code: 'custom', path: ['guardianConsent'], message: 'Confirm that guardian consent was obtained' })
    }
  })

type Values = z.infer<typeof schema>

function toInput(values: Values, includeConsents: boolean): PatientInput {
  return {
    fullName: values.fullName,
    dateOfBirth: values.dateOfBirth,
    gender: values.gender,
    phone: values.phone,
    email: values.email,
    addressLine: values.addressLine,
    city: values.city,
    state: values.state,
    pin: values.pin,
    emergencyName: values.emergencyName,
    emergencyRelationship: values.emergencyRelationship,
    emergencyPhone: values.emergencyPhone,
    assignedDoctorId: values.assignedDoctorId,
    preferredMode: values.preferredMode,
    referralSource: values.referralSource,
    status: values.status,
    guardianName: values.guardianName,
    guardianRelationship: values.guardianRelationship,
    guardianPhone: values.guardianPhone,
    guardianEmail: values.guardianEmail,
    guardianConsent: values.guardianConsent,
    guardianVerification: values.guardianVerification,
    consents: includeConsents
      ? [
          { kind: 'TREATMENT_RECORDS', granted: values.records },
          { kind: 'CALENDAR_INVITES', granted: values.calendar },
          { kind: 'GOOGLE_MEET', granted: values.meet },
          { kind: 'PROMOTIONAL', granted: values.promo },
        ]
      : undefined,
  }
}

export function PatientFormDialog({ open, onOpenChange, patient }: { open: boolean; onOpenChange: (open: boolean) => void; patient?: Patient }) {
  const { actor } = useAuth()
  const doctors = useDoctors()
  const save = useSavePatient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      dateOfBirth: '',
      gender: '',
      phone: '',
      email: '',
      emergencyName: '',
      emergencyRelationship: '',
      emergencyPhone: '',
      assignedDoctorId: actor?.doctorId ?? '',
      preferredMode: 'EITHER',
      referralSource: 'Self',
      status: 'ACTIVE',
      records: true,
      calendar: true,
      meet: true,
      promo: false,
      guardianConsent: false,
    },
  })
  useEffect(() => {
    if (!open) return
    form.reset({
      fullName: patient?.fullName ?? '',
      dateOfBirth: patient?.dateOfBirth ?? '',
      gender: patient?.gender ?? '',
      phone: patient?.phone ?? '',
      email: patient?.email ?? '',
      addressLine: patient?.address?.line1 ?? '',
      city: patient?.address?.city ?? '',
      state: patient?.address?.state ?? '',
      pin: patient?.address?.pin ?? '',
      emergencyName: patient?.emergencyContact.name ?? '',
      emergencyRelationship: patient?.emergencyContact.relationship ?? '',
      emergencyPhone: patient?.emergencyContact.phone ?? '',
      assignedDoctorId: patient?.assignedDoctorId ?? actor?.doctorId ?? '',
      preferredMode: patient?.preferredMode ?? 'EITHER',
      referralSource: patient?.referralSource ?? 'Self',
      status: patient?.status ?? 'ACTIVE',
      records: true,
      calendar: true,
      meet: true,
      promo: false,
      guardianConsent: false,
    })
  }, [open, patient, actor?.doctorId, form])
  const dob = form.watch('dateOfBirth')
  const minor = dob ? isMinor(dob) : false
  const admin = actor?.activeRole === 'ADMIN'

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={patient ? 'Edit patient' : 'Onboard patient'} wide>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await save.mutateAsync({ id: patient?.id, values: toInput(values, !patient) })
            toast.success('Patient record saved')
            onOpenChange(false)
          } catch (error) {
            toast.error(errorText(error))
          }
        })}
      >
        <Field label="Full name" htmlFor="p-name" error={form.formState.errors.fullName?.message}><Input id="p-name" {...form.register('fullName')} /></Field>
        <Field label="Date of birth" htmlFor="p-dob" error={form.formState.errors.dateOfBirth?.message} hint={minor ? `Age ${new Date().getFullYear() - Number(dob.slice(0, 4))} · Minor` : undefined}><Input id="p-dob" type="date" {...form.register('dateOfBirth')} /></Field>
        <Field label="Gender (optional)" htmlFor="p-gender"><Select id="p-gender" {...form.register('gender')}><option value="">Not specified</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option></Select></Field>
        <Field label="Phone" htmlFor="p-phone" error={form.formState.errors.phone?.message}><Input id="p-phone" {...form.register('phone')} /></Field>
        <Field label="Email" htmlFor="p-email" error={form.formState.errors.email?.message}><Input id="p-email" {...form.register('email')} /></Field>
        <Field label="Assigned doctor" htmlFor="p-doctor" error={form.formState.errors.assignedDoctorId?.message}>
          <Select id="p-doctor" disabled={!admin && !!actor?.doctorId} {...form.register('assignedDoctorId')}>
            <option value="">Select</option>
            {(doctors.data ?? []).filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
          </Select>
        </Field>
        <Field label="Address" htmlFor="p-address"><Input id="p-address" {...form.register('addressLine')} /></Field>
        <Field label="City" htmlFor="p-city"><Input id="p-city" {...form.register('city')} /></Field>
        <Field label="State" htmlFor="p-state"><Input id="p-state" {...form.register('state')} /></Field>
        <Field label="PIN" htmlFor="p-pin"><Input id="p-pin" {...form.register('pin')} /></Field>
        <Field label="Emergency contact" htmlFor="p-ec" error={form.formState.errors.emergencyName?.message}><Input id="p-ec" {...form.register('emergencyName')} /></Field>
        <Field label="Relationship" htmlFor="p-rel" error={form.formState.errors.emergencyRelationship?.message}><Input id="p-rel" {...form.register('emergencyRelationship')} /></Field>
        <Field label="Emergency phone" htmlFor="p-ep" error={form.formState.errors.emergencyPhone?.message}><Input id="p-ep" {...form.register('emergencyPhone')} /></Field>
        <Field label="Preferred mode" htmlFor="p-mode"><Select id="p-mode" {...form.register('preferredMode')}><option value="EITHER">Either</option><option value="IN_PERSON">In person</option><option value="ONLINE">Online</option></Select></Field>
        <Field label="Referral source" htmlFor="p-ref"><Select id="p-ref" {...form.register('referralSource')}><option>Website</option><option>Doctor referral</option><option>Self</option><option>School</option><option>Other</option></Select></Field>
        {patient ? <Field label="Status" htmlFor="p-status"><Select id="p-status" {...form.register('status')}><option value="ACTIVE">Active</option><option value="CLOSED">Closed</option></Select></Field> : null}
        {minor ? (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
            <p className="text-sm font-medium">Guardian</p>
            <p className="text-xs text-stone-700">Guardian access to therapy notes is not automatic; the treating doctor decides.</p>
            <Field label="Guardian name" htmlFor="g-name" error={form.formState.errors.guardianName?.message}><Input id="g-name" {...form.register('guardianName')} /></Field>
            <Field label="Relationship" htmlFor="g-rel"><Select id="g-rel" {...form.register('guardianRelationship')}><option value="">Select</option><option>Parent</option><option>Legal guardian</option><option>Other</option></Select></Field>
            <Field label="Guardian phone" htmlFor="g-phone" error={form.formState.errors.guardianPhone?.message}><Input id="g-phone" {...form.register('guardianPhone')} /></Field>
            <Field label="Guardian email" htmlFor="g-email" error={form.formState.errors.guardianEmail?.message}><Input id="g-email" {...form.register('guardianEmail')} /></Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" {...form.register('guardianConsent')} /> Guardian consent obtained
            </label>
            {form.formState.errors.guardianConsent ? <p className="text-sm text-red-800">{form.formState.errors.guardianConsent.message}</p> : null}
            <Field label="How consent was verified" htmlFor="g-note"><Textarea id="g-note" {...form.register('guardianVerification')} /></Field>
          </div>
        ) : null}
        {!patient ? (
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">Consents</legend>
            <label className="flex gap-2 text-sm"><input type="checkbox" {...form.register('records')} /> Storing treatment records</label>
            <label className="flex gap-2 text-sm"><input type="checkbox" {...form.register('calendar')} /> Google Calendar invites and reminders by email</label>
            <label className="flex gap-2 text-sm"><input type="checkbox" {...form.register('meet')} /> Online sessions via Google Meet</label>
            <label className="flex gap-2 text-sm"><input type="checkbox" {...form.register('promo')} /> Promotional communication (off unless chosen)</label>
            <p className="text-sm text-stone-500">Session recording: not offered</p>
          </fieldset>
        ) : null}
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  )
}
