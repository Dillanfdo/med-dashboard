import type { SessionStatus } from '@/types'

export const TZ = 'Asia/Kolkata'

export function ymd(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function weekdayIndex(date: Date): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(date)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name)
}

export function weekdayIndexFromYmd(date: string): number {
  return weekdayIndex(new Date(`${date}T12:00:00+05:30`))
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function ageInYears(dob: string, now = new Date()): number {
  if (!dob) return NaN
  const today = ymd(now)
  const [ty, tm, td] = today.split('-').map(Number)
  const [y, m, d] = dob.split('-').map(Number)
  if (!y || !m || !d) return NaN
  let age = ty - y
  if (tm < m || (tm === m && td < d)) age -= 1
  return age
}

export function isMinor(dob: string, now = new Date()): boolean {
  return ageInYears(dob, now) < 18
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '—'
  const first = parts[0][0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function appointmentTitle(name?: string, patientId?: string | null): string {
  if (name && name.trim()) return `Appointment · ${initials(name)}`
  if (patientId) return `Appointment · ${patientId}`
  return 'Appointment'
}

export function phoneDigits(input: string): string {
  const digits = input.replace(/\D/g, '')
  return digits.length > 10 ? digits.slice(-10) : digits
}

export function formatPhone(input: string): string {
  const d = phoneDigits(input)
  if (d.length !== 10) return input
  return `${d.slice(0, 5)} ${d.slice(5)}`
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

export function isoFromLocal(date: string, time: string): string {
  return new Date(`${date}T${time}:00+05:30`).toISOString()
}

export function istTimeValue(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '00'
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${hour}:${minute}`
}

export function monthKey(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
  }).format(new Date(iso))
  return parts
}

export function monthLabel(key: string): string {
  const date = new Date(`${key}-01T12:00:00+05:30`)
  return new Intl.DateTimeFormat('en-GB', { timeZone: TZ, month: 'short', year: 'numeric' }).format(date)
}

export function addDaysYmd(date: string, days: number): string {
  const next = new Date(new Date(`${date}T12:00:00+05:30`).getTime() + days * 86_400_000)
  return ymd(next)
}

export function registrationAlert(expiry?: string, now = new Date()): 'expired' | 'expiring' | null {
  if (!expiry) return null
  const today = ymd(now)
  if (expiry < today) return 'expired'
  const limit = ymd(new Date(now.getTime() + 60 * 86_400_000))
  if (expiry <= limit) return 'expiring'
  return null
}

export function statusLabel(status: SessionStatus): string {
  const labels: Record<SessionStatus, string> = {
    REQUESTED: 'Requested',
    CONFIRMED: 'Confirmed',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    NO_SHOW: 'No-show',
    RESCHEDULED: 'Rescheduled',
  }
  return labels[status]
}

export function modeLabel(mode: string): string {
  if (mode === 'IN_PERSON') return 'In person'
  if (mode === 'ONLINE') return 'Online'
  if (mode === 'EITHER') return 'Either'
  return mode
}
