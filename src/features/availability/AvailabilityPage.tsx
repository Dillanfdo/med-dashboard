import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAvailability, useDoctors, useSaveAvailability } from '@/api/hooks'
import { useAuth } from '@/lib/auth'
import { formatTime } from '@/lib/format'
import { usePermission } from '@/lib/permissions'
import { errorText } from '@/lib/utils'
import { Button, Card, Field, Input, QueryState, Select } from '@/components/ui'
import type { SessionMode } from '@/types'

const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Block { dayOfWeek: number; startTime: string; endTime: string; modes: SessionMode[] }
interface Leave { date: string; reason: string }

export function AvailabilityPage() {
  const { actor } = useAuth()
  const all = usePermission('view_all', 'availability')
  const doctors = useDoctors()
  const [doctorId, setDoctorId] = useState(actor?.doctorId ?? '')
  useEffect(() => {
    document.title = 'Availability · Northlight'
    if (!doctorId && doctors.data?.[0]) setDoctorId(actor?.doctorId ?? doctors.data[0].id)
  }, [actor?.doctorId, doctorId, doctors.data])
  const query = useAvailability(doctorId || undefined)
  const save = useSaveAvailability()
  const [buffer, setBuffer] = useState(10)
  const [duration, setDuration] = useState(50)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [blocked, setBlocked] = useState<Leave[]>([])
  useEffect(() => {
    if (!query.data) return
    setBuffer(query.data.bufferMinutes)
    setDuration(query.data.defaultDuration)
    setBlocks(query.data.rules.map((rule) => ({ dayOfWeek: rule.dayOfWeek, startTime: rule.startTime, endTime: rule.endTime, modes: rule.modes })))
    setBlocked(query.data.blocked.map((item) => ({ date: item.date, reason: item.reason })))
  }, [query.data])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{all ? 'Availability' : 'My availability'}</h1>
      {all ? (
        <Select aria-label="Doctor" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
          {(doctors.data ?? []).map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}
        </Select>
      ) : null}
      <QueryState isLoading={query.isLoading} isError={query.isError} error={query.error} onRetry={() => void query.refetch()}>
        <Card>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Session duration (minutes)" htmlFor="av-dur"><Input id="av-dur" type="number" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></Field>
            <Field label="Buffer between sessions (minutes)" htmlFor="av-buf"><Input id="av-buf" type="number" value={buffer} onChange={(event) => setBuffer(Number(event.target.value))} /></Field>
          </div>
          <div className="mt-4 space-y-4">
            {days.map((day, index) => (
              <div key={day}>
                <p className="text-sm font-medium">{day}</p>
                {blocks.filter((block) => block.dayOfWeek === index).map((block, blockIndex) => (
                  <div key={`${index}-${blockIndex}`} className="mt-2 flex flex-wrap items-center gap-2">
                    <Input type="time" aria-label={`${day} start`} value={block.startTime} onChange={(event) => updateBlock(index, blockIndex, { startTime: event.target.value })} />
                    <Input type="time" aria-label={`${day} end`} value={block.endTime} onChange={(event) => updateBlock(index, blockIndex, { endTime: event.target.value })} />
                    <label className="text-sm"><input type="checkbox" checked={block.modes.includes('IN_PERSON')} onChange={(event) => toggleMode(index, blockIndex, 'IN_PERSON', event.target.checked)} /> In person</label>
                    <label className="text-sm"><input type="checkbox" checked={block.modes.includes('ONLINE')} onChange={(event) => toggleMode(index, blockIndex, 'ONLINE', event.target.checked)} /> Online</label>
                    <Button size="sm" variant="ghost" onClick={() => setBlocks((current) => current.filter((item) => !(item.dayOfWeek === index && current.filter((block) => block.dayOfWeek === index).indexOf(item) === blockIndex)))}>Remove</Button>
                  </div>
                ))}
                <Button className="mt-2" size="sm" variant="outline" onClick={() => setBlocks((current) => [...current, { dayOfWeek: index, startTime: '10:00', endTime: '13:00', modes: ['IN_PERSON', 'ONLINE'] }])}>Add block</Button>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium">Leave dates</p>
            {blocked.map((item, index) => (
              <div key={`${item.date}-${index}`} className="mt-2 flex gap-2">
                <Input type="date" aria-label="Leave date" value={item.date} onChange={(event) => setBlocked((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, date: event.target.value } : row))} />
                <Input aria-label="Leave reason" value={item.reason} onChange={(event) => setBlocked((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, reason: event.target.value } : row))} />
              </div>
            ))}
            <Button className="mt-2" size="sm" variant="outline" onClick={() => setBlocked((current) => [...current, { date: '', reason: 'Leave' }])}>Add leave</Button>
          </div>
          <Button className="mt-4" disabled={save.isPending} onClick={async () => {
            try {
              await save.mutateAsync({ doctorId, bufferMinutes: buffer, defaultDuration: duration, rules: blocks, blocked })
              toast.success('Availability saved')
            } catch (error) {
              toast.error(errorText(error))
            }
          }}>Save availability</Button>
        </Card>
        <Card>
          <h2 className="font-semibold">Availability as seen by the website</h2>
          <p className="mt-1 text-sm text-stone-600">Free slots only. No patient information. Minimum notice {query.data?.preview.minimumNoticeHours} hours.</p>
          {!query.data?.preview.enabled ? <p className="mt-2 text-sm">Website booking is turned off.</p> : null}
          {query.data?.preview.enabled && query.data.preview.slots.length === 0 ? <p className="mt-2 text-sm">No open slots in the next 7 days.</p> : null}
          <ul className="mt-2 space-y-1 text-sm">
            {(query.data?.preview.slots ?? []).map((slot) => (
              <li key={slot.start}>{slot.date} · {formatTime(slot.start)} · {slot.modes.map((mode) => (mode === 'ONLINE' ? 'Online' : 'In person')).join(', ')}</li>
            ))}
          </ul>
        </Card>
      </QueryState>
    </div>
  )

  function updateBlock(day: number, index: number, patch: Partial<Block>) {
    setBlocks((current) => {
      let seen = -1
      return current.map((block) => {
        if (block.dayOfWeek !== day) return block
        seen += 1
        return seen === index ? { ...block, ...patch } : block
      })
    })
  }
  function toggleMode(day: number, index: number, mode: SessionMode, on: boolean) {
    setBlocks((current) => {
      let seen = -1
      return current.map((block) => {
        if (block.dayOfWeek !== day) return block
        seen += 1
        if (seen !== index) return block
        const modes = on ? Array.from(new Set([...block.modes, mode])) : block.modes.filter((item) => item !== mode)
        return { ...block, modes }
      })
    })
  }
}
