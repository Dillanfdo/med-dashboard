import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useDoctors, useReconnectGoogle, useSettings, useUpdateSettings } from '@/api/hooks'
import { errorText } from '@/lib/utils'
import { Badge, Button, Card, Field, Input, Select, Switch } from '@/components/ui'

const schema = z.object({
  clinicName: z.string().min(2),
  city: z.string().min(2),
  minimumNoticeHours: z.coerce.number().min(0).max(168),
  confirmMode: z.enum(['MANUAL', 'AUTO']),
  websiteBookingsEnabled: z.boolean(),
  adminCanViewClinicalNotes: z.boolean(),
})

export function SettingsPage() {
  const settings = useSettings()
  const doctors = useDoctors()
  const save = useUpdateSettings()
  const reconnect = useReconnectGoogle()
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    values: settings.data
      ? {
          clinicName: settings.data.clinicName,
          city: settings.data.city,
          minimumNoticeHours: settings.data.minimumNoticeHours,
          confirmMode: settings.data.confirmMode,
          websiteBookingsEnabled: settings.data.websiteBookingsEnabled,
          adminCanViewClinicalNotes: settings.data.adminCanViewClinicalNotes,
        }
      : undefined,
  })
  useEffect(() => { document.title = 'Settings · Northlight' }, [])
  if (!settings.data) return <p className="text-sm text-stone-600">Loading settings…</p>
  const data = settings.data
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={form.handleSubmit(async (values) => {
          try {
            await save.mutateAsync({ ...values, locations: data.locations, sessionTypes: data.sessionTypes })
            toast.success('Settings saved')
          } catch (error) {
            toast.error(errorText(error))
          }
        })}>
          <Field label="Clinic name" htmlFor="s-name"><Input id="s-name" {...form.register('clinicName')} /></Field>
          <Field label="City" htmlFor="s-city"><Input id="s-city" {...form.register('city')} /></Field>
          <Field label="Minimum notice (hours)" htmlFor="s-notice"><Input id="s-notice" type="number" {...form.register('minimumNoticeHours')} /></Field>
          <Field label="Website confirm mode" htmlFor="s-mode" hint="Auto-confirm is stored for the review. Requests still wait for staff because date of birth is not on the public form.">
            <Select id="s-mode" {...form.register('confirmMode')}><option value="MANUAL">Manual confirm</option><option value="AUTO">Auto confirm</option></Select>
          </Field>
          <label className="flex items-center gap-2 text-sm"><Switch checked={form.watch('websiteBookingsEnabled')} onCheckedChange={(value) => form.setValue('websiteBookingsEnabled', value)} label="Website bookings enabled" /> Website bookings</label>
          <label className="flex items-center gap-2 text-sm"><Switch checked={form.watch('adminCanViewClinicalNotes')} onCheckedChange={(value) => form.setValue('adminCanViewClinicalNotes', value)} label="Admins can view clinical notes" /> Admins can view clinical notes</label>
          <div className="sm:col-span-2"><Button type="submit">Save settings</Button></div>
        </form>
        <div className="mt-4 text-sm">
          <p className="font-medium">Locations</p>
          <ul>{data.locations.map((location) => <li key={location.id}>{location.name} — {location.address}</li>)}</ul>
          <p className="mt-3 font-medium">Session types</p>
          <ul>{data.sessionTypes.map((item) => <li key={item.id}>{item.name} · {item.durationMinutes} min</li>)}</ul>
        </div>
      </Card>
      <Card>
        <h2 className="font-semibold">Calendar integration</h2>
        <p className="mt-1 text-sm text-stone-600">Connected to Google Workspace (simulated). Invites are sent from each doctor's Google account.</p>
        <ul className="mt-3 space-y-2 text-sm">
          {data.googleConnections.map((row) => {
            const doctor = doctors.data?.find((item) => item.id === row.doctorId)
            return (
              <li key={row.doctorId} className="flex items-center justify-between gap-2">
                <span>{doctor?.fullName ?? row.doctorId}</span>
                <span className="flex items-center gap-2">
                  <Badge tone={row.status === 'CONNECTED' ? 'teal' : 'amber'}>{row.status === 'CONNECTED' ? 'Connected' : row.status === 'RECONNECT' ? 'Reconnect needed' : 'Not connected'}</Badge>
                  {row.status !== 'CONNECTED' ? <Button size="sm" variant="outline" onClick={() => reconnect.mutate(row.doctorId, { onSuccess: () => toast.success('Connection simulated'), onError: (error) => toast.error(errorText(error)) })}>Reconnect</Button> : null}
                </span>
              </li>
            )
          })}
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">Notice and consent text</h2>
        <p className="text-sm text-stone-600">View only in this prototype.</p>
        <div className="mt-3 space-y-3">
          {data.consentTexts.map((text) => (
            <article key={text.id}>
              <h3 className="text-sm font-medium">{text.title} · {text.version}</h3>
              <p className="text-sm text-stone-700">{text.body}</p>
            </article>
          ))}
        </div>
      </Card>
    </div>
  )
}
