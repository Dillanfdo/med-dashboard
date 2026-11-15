import { istTimeValue, weekdayIndex, ymd } from '@/lib/format'
import { getDb } from '@/mocks/store'
import { BLOCKING_STATUSES, type PreviewSlot, type SessionMode } from '@/types'

function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function explainSlot(input: {
  doctorId: string
  startIso: string
  durationMinutes: number
  mode?: SessionMode
  excludeSessionId?: string
  allowPast?: boolean
}): string | null {
  const db = getDb()
  const doctor = db.doctors.find((item) => item.id === input.doctorId)
  if (!doctor || !doctor.active) return 'This doctor is inactive. Choose someone else.'
  if (!input.allowPast && new Date(input.startIso).getTime() < Date.now() - 60_000) {
    return 'Choose a time in the future.'
  }
  const date = ymd(new Date(input.startIso))
  if (db.blockedDates.some((item) => item.doctorId === input.doctorId && item.date === date)) {
    return 'This doctor is on leave that day.'
  }
  const startMin = toMinutes(istTimeValue(input.startIso))
  const endMin = startMin + input.durationMinutes
  const day = weekdayIndex(new Date(input.startIso))
  const rule = db.availability.find(
    (item) =>
      item.doctorId === input.doctorId &&
      item.dayOfWeek === day &&
      startMin >= toMinutes(item.startTime) &&
      endMin <= toMinutes(item.endTime),
  )
  if (!rule) return "That time is outside this doctor's working hours."
  if (input.mode && !rule.modes.includes(input.mode)) {
    return 'This doctor does not offer that mode in this time block.'
  }
  const buffer = doctor.bufferMinutes * 60_000
  const startMs = new Date(input.startIso).getTime()
  const endMs = startMs + input.durationMinutes * 60_000
  const clash = db.sessions.some((session) => {
    if (session.id === input.excludeSessionId) return false
    if (session.doctorId !== input.doctorId) return false
    if (!BLOCKING_STATUSES.includes(session.status)) return false
    const existingStart = new Date(session.start).getTime()
    const existingEnd = new Date(session.end).getTime()
    return startMs < existingEnd + buffer && existingStart < endMs + buffer
  })
  if (clash) return 'This doctor already has a session then. Pick another time.'
  return null
}

export function websiteSlots(doctorId: string): { enabled: boolean; minimumNoticeHours: number; slots: PreviewSlot[] } {
  const db = getDb()
  const settings = db.settings
  if (!settings.websiteBookingsEnabled) {
    return { enabled: false, minimumNoticeHours: settings.minimumNoticeHours, slots: [] }
  }
  const doctor = db.doctors.find((item) => item.id === doctorId)
  if (!doctor) return { enabled: true, minimumNoticeHours: settings.minimumNoticeHours, slots: [] }
  const today = ymd(new Date())
  const slots: PreviewSlot[] = []
  for (let offset = 0; offset < 7; offset += 1) {
    const date = ymd(new Date(new Date(`${today}T12:00:00+05:30`).getTime() + offset * 86_400_000))
    const day = weekdayIndex(new Date(`${date}T12:00:00+05:30`))
    const rules = db.availability.filter((item) => item.doctorId === doctorId && item.dayOfWeek === day)
    for (const rule of rules) {
      let cursor = toMinutes(rule.startTime)
      const end = toMinutes(rule.endTime)
      while (cursor + doctor.defaultDuration <= end) {
        const hh = String(Math.floor(cursor / 60)).padStart(2, '0')
        const mm = String(cursor % 60).padStart(2, '0')
        const startIso = new Date(`${date}T${hh}:${mm}:00+05:30`).toISOString()
        const noticeOk = new Date(startIso).getTime() >= Date.now() + settings.minimumNoticeHours * 3_600_000
        if (noticeOk && !explainSlot({ doctorId, startIso, durationMinutes: doctor.defaultDuration, mode: rule.modes[0] })) {
          slots.push({
            date,
            start: startIso,
            end: new Date(new Date(startIso).getTime() + doctor.defaultDuration * 60_000).toISOString(),
            modes: rule.modes,
          })
        }
        cursor += doctor.defaultDuration + doctor.bufferMinutes
      }
    }
  }
  return { enabled: true, minimumNoticeHours: settings.minimumNoticeHours, slots }
}
