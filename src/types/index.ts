export const TENANT_ID = 'ten_northlight'

export type Role = 'ADMIN' | 'DOCTOR'
export type Designation = 'Clinical Psychologist' | 'Counsellor' | 'Psychiatrist' | 'Other'
export type Gender = 'Female' | 'Male' | 'Non-binary' | 'Prefer not to say'
export type SessionMode = 'IN_PERSON' | 'ONLINE'
export type SessionStatus =
  | 'REQUESTED'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'RESCHEDULED'
export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'BANK_TRANSFER' | 'OTHER'
export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'REFUNDED' | 'WAIVED'
export type MeetStatus = 'NONE' | 'CREATING' | 'READY' | 'FAILED'
export type InviteStatus = 'NOT_SENT' | 'PENDING' | 'SENT' | 'UPDATED' | 'CANCELLED'
export type BookingSource = 'INTERNAL' | 'WEBSITE'
export type CancelledBy = 'CLINIC' | 'PATIENT'
export type PatientStatus = 'ACTIVE' | 'CLOSED'
export type PreferredMode = 'IN_PERSON' | 'ONLINE' | 'EITHER'
export type ReferralSource = 'Website' | 'Doctor referral' | 'Self' | 'School' | 'Other'
export type ConsentKind = 'TREATMENT_RECORDS' | 'CALENDAR_INVITES' | 'GOOGLE_MEET' | 'PROMOTIONAL'
export type RightsType = 'ACCESS' | 'CORRECTION' | 'ERASURE' | 'GRIEVANCE'
export type RightsStatus = 'OPEN' | 'IN_REVIEW' | 'DONE'
export type AuditAction =
  | 'VIEW'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'EXPORT'
  | 'LOGIN'
  | 'BREAK_GLASS'
  | 'PERMISSION_CHANGE'
export type AuditOutcome = 'SUCCESS' | 'DENIED'
export type GoogleStatus = 'CONNECTED' | 'RECONNECT' | 'NOT_CONNECTED'
export type ConfirmMode = 'MANUAL' | 'AUTO'

export interface Tenant {
  id: string
  name: string
}

export interface User {
  id: string
  tenantId: string
  name: string
  email: string
  roles: Role[]
  doctorId?: string
  active: boolean
}

export interface Actor {
  userId: string
  tenantId: string
  name: string
  email: string
  roles: Role[]
  activeRole: Role
  doctorId?: string
}

export interface DoctorProfile {
  id: string
  tenantId: string
  userId: string
  fullName: string
  dateOfBirth: string
  designation: Designation
  qualification: string
  institution: string
  rciNumber?: string
  rciStatus: 'REGISTERED' | 'EXPIRED' | 'NOT_APPLICABLE'
  rciExpiry?: string
  otherRegistration?: string
  email: string
  phone: string
  modes: SessionMode[]
  defaultFee: number
  defaultDuration: number
  bufferMinutes: number
  active: boolean
  alsoAdmin: boolean
  color: string
}

export interface Address {
  line1: string
  city: string
  state: string
  pin: string
}

export interface EmergencyContact {
  name: string
  relationship: string
  phone: string
}

export interface Patient {
  id: string
  tenantId: string
  fullName: string
  dateOfBirth: string
  gender?: Gender
  phone: string
  email: string
  address?: Address
  emergencyContact: EmergencyContact
  assignedDoctorId: string
  preferredMode: PreferredMode
  referralSource: ReferralSource
  status: PatientStatus
  createdAt: string
}

export interface Guardian {
  id: string
  tenantId: string
  patientId: string
  name: string
  relationship: string
  phone: string
  email: string
  consentObtained: boolean
  verificationNote: string
}

export interface Consent {
  id: string
  tenantId: string
  patientId: string
  kind: ConsentKind
  granted: boolean
  updatedAt: string
  updatedBy: string
}

export interface PreviousTime {
  start: string
  end: string
  reason: string
  changedAt: string
  changedBy: string
}

export interface Session {
  id: string
  tenantId: string
  patientId: string | null
  doctorId: string | null
  start: string
  end: string
  durationMinutes: number
  mode: SessionMode
  locationId?: string
  fee: number
  schedulingNotes?: string
  status: SessionStatus
  source: BookingSource
  meetLink?: string
  meetStatus: MeetStatus
  inviteStatus: InviteStatus
  previousTimes: PreviousTime[]
  cancelReason?: string
  cancelledBy?: CancelledBy
  requester?: { name: string; phone: string; email: string }
  createdAt: string
  createdBy: string
}

export interface SessionStatusEvent {
  id: string
  tenantId: string
  sessionId: string
  status: SessionStatus
  at: string
  actorId: string
  actorName: string
  note?: string
}

export interface NoteVersion {
  at: string
  authorId: string
  authorName: string
  /** Present only when the reader is the author. */
  body?: string
}

export interface ClinicalNote {
  id: string
  tenantId: string
  sessionId: string
  patientId: string
  authorId: string
  authorName: string
  assessment: string
  observations: string
  plan: string
  nextSteps: string
  versions: NoteVersion[]
  updatedAt: string
}

export interface ProcessNote {
  id: string
  tenantId: string
  sessionId: string
  patientId: string
  authorId: string
  authorName: string
  body: string
  versions: NoteVersion[]
  updatedAt: string
}

export interface Payment {
  id: string
  tenantId: string
  patientId: string
  sessionId: string
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  reference?: string
  receiptNumber?: string
  recordedBy: string
  recordedByName: string
  recordedAt: string
  note?: string
}

export interface AuditEvent {
  id: string
  tenantId: string
  at: string
  actorId: string
  actorName: string
  actorRole: Role | 'SYSTEM'
  action: AuditAction
  resourceType: string
  resourceId: string
  outcome: AuditOutcome
  reason?: string
}

export interface AvailabilityRule {
  id: string
  tenantId: string
  doctorId: string
  dayOfWeek: number
  startTime: string
  endTime: string
  modes: SessionMode[]
}

export interface BlockedDate {
  id: string
  tenantId: string
  doctorId: string
  date: string
  reason: string
}

export interface WebsiteBookingRequest {
  id: string
  tenantId: string
  sessionId: string
  token: string
  requesterName: string
  phone: string
  email: string
  consentFlags: {
    records: boolean
    calendar: boolean
    meet: boolean
    promo: boolean
  }
  createdAt: string
}

export interface RightsRequest {
  id: string
  tenantId: string
  patientId: string
  type: RightsType
  status: RightsStatus
  dueDate: string
  detail: string
  createdAt: string
  createdBy: string
}

export interface ClinicLocation {
  id: string
  name: string
  address: string
}

export interface SessionType {
  id: string
  name: string
  durationMinutes: number
}

export interface ConsentText {
  id: string
  title: string
  version: string
  body: string
}

export interface ClinicSettings {
  tenantId: string
  clinicName: string
  city: string
  locations: ClinicLocation[]
  sessionTypes: SessionType[]
  websiteBookingsEnabled: boolean
  minimumNoticeHours: number
  confirmMode: ConfirmMode
  adminCanViewClinicalNotes: boolean
  idleTimeoutSeconds: number
  simulateMeetFailure: boolean
  consentTexts: ConsentText[]
  googleConnections: { doctorId: string; status: GoogleStatus }[]
}

export interface Database {
  tenant: Tenant
  users: User[]
  doctors: DoctorProfile[]
  patients: Patient[]
  guardians: Guardian[]
  consents: Consent[]
  sessions: Session[]
  statusEvents: SessionStatusEvent[]
  clinicalNotes: ClinicalNote[]
  processNotes: ProcessNote[]
  payments: Payment[]
  audit: AuditEvent[]
  availability: AvailabilityRule[]
  blockedDates: BlockedDate[]
  rightsRequests: RightsRequest[]
  websiteRequests: WebsiteBookingRequest[]
  settings: ClinicSettings
}

export interface StaffNotification {
  id: string
  title: string
  body: string
  href: string
}

export interface AnalyticsPoint {
  label: string
  total: number | null
  display: string
}

export interface AnalyticsReport {
  scope: 'all' | 'own'
  sessionsPerMonth: AnalyticsPoint[]
  modeSplit: AnalyticsPoint[]
  outcomes: AnalyticsPoint[]
  newPatientsPerMonth: AnalyticsPoint[]
  sessionsPerDoctor?: AnalyticsPoint[]
  revenuePerMonth?: AnalyticsPoint[]
  outstanding?: AnalyticsPoint
  sourceSplit?: AnalyticsPoint[]
  suppressedNote: string
}

export interface SlotCheck {
  ok: boolean
  message?: string
}

export interface PreviewSlot {
  date: string
  start: string
  end: string
  modes: SessionMode[]
}

export interface AvailabilityView {
  rules: AvailabilityRule[]
  blocked: BlockedDate[]
  bufferMinutes: number
  defaultDuration: number
  preview: { enabled: boolean; minimumNoticeHours: number; slots: PreviewSlot[] }
}

export type NoteAccess<T> =
  | { access: 'ok'; note: T }
  | { access: 'empty' }
  | { access: 'denied' }
  | { access: 'locked' }

export interface SessionNotesBundle {
  session: Session
  clinical: NoteAccess<ClinicalNote>
  process: NoteAccess<ProcessNote>
}

export interface PossibleMatch {
  patientId: string
  label: string
  via: 'phone' | 'email'
}

export const BLOCKING_STATUSES: SessionStatus[] = ['REQUESTED', 'CONFIRMED', 'RESCHEDULED']

export const CANCEL_REASONS = [
  'Patient requested',
  'Doctor unavailable',
  'Clinic closed',
  'Booked in error',
  'Other',
] as const
