import type {
  Actor,
  AnalyticsReport,
  AuditAction,
  AuditEvent,
  AvailabilityView,
  ClinicalNote,
  Consent,
  ConsentKind,
  Guardian,
  DoctorProfile,
  Patient,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PossibleMatch,
  ProcessNote,
  RightsRequest,
  RightsStatus,
  RightsType,
  Session,
  SessionMode,
  SessionNotesBundle,
  SessionStatus,
  SessionStatusEvent,
  SlotCheck,
  StaffNotification,
  ClinicSettings,
  WebsiteBookingRequest,
} from '@/types'

export interface PatientInput {
  fullName: string
  dateOfBirth: string
  gender?: string
  phone: string
  email: string
  addressLine?: string
  city?: string
  state?: string
  pin?: string
  emergencyName: string
  emergencyRelationship: string
  emergencyPhone: string
  assignedDoctorId: string
  preferredMode: Patient['preferredMode']
  referralSource: Patient['referralSource']
  status?: Patient['status']
  guardianName?: string
  guardianRelationship?: string
  guardianPhone?: string
  guardianEmail?: string
  guardianConsent?: boolean
  guardianVerification?: string
  consents?: { kind: ConsentKind; granted: boolean }[]
}

export interface DoctorInput {
  fullName: string
  dateOfBirth: string
  designation: DoctorProfile['designation']
  qualification: string
  institution: string
  rciNumber?: string
  rciStatus: DoctorProfile['rciStatus']
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
}

export interface CreateSessionInput {
  patientId: string
  doctorId: string
  start: string
  durationMinutes: number
  mode: SessionMode
  locationId?: string
  fee: number
  schedulingNotes?: string
}

export interface ClinicApi {
  auth: {
    signIn(email: string, password: string): Promise<{ userId: string; name: string; email: string }>
    verifyMfa(userId: string, code: string): Promise<Actor>
    devSignIn(userId: string): Promise<Actor>
    refresh(): Promise<Actor | null>
  }
  dev: {
    persistEnabled(): boolean
    setPersist(on: boolean): void
    reset(): Promise<void>
  }
  notifications: {
    list(): Promise<StaffNotification[]>
  }
  sessions: {
    list(query?: { status?: string; doctorId?: string; mode?: string; source?: string; from?: string; to?: string }): Promise<Session[]>
    get(id: string): Promise<Session>
    timeline(id: string): Promise<SessionStatusEvent[]>
    checkSlot(input: { doctorId: string; start: string; durationMinutes: number; mode?: SessionMode; excludeSessionId?: string }): Promise<SlotCheck>
    create(input: CreateSessionInput): Promise<Session>
    reschedule(id: string, input: { start: string; durationMinutes: number; reason: string }): Promise<Session>
    cancel(id: string, input: { reason: string; cancelledBy: 'CLINIC' | 'PATIENT' }): Promise<Session>
    setStatus(id: string, status: Extract<SessionStatus, 'COMPLETED' | 'NO_SHOW'>): Promise<Session>
    retryMeet(id: string): Promise<Session>
    websiteDetail(id: string): Promise<{ request: WebsiteBookingRequest | null; matches: PossibleMatch[] }>
    confirmWebsite(id: string, input: { patientId?: string; doctorId?: string; patient?: PatientInput }): Promise<Session>
    proposeWebsite(id: string, input: { start: string; durationMinutes: number; reason: string }): Promise<Session>
    declineWebsite(id: string, input: { reason: string }): Promise<Session>
    simulateWebsite(): Promise<Session>
  }
  patients: {
    list(query?: { search?: string; doctorId?: string; minor?: 'yes' | 'no'; status?: string }): Promise<Patient[]>
    get(id: string): Promise<Patient>
    guardian(id: string): Promise<Guardian | null>
    consents(id: string): Promise<Consent[]>
    create(input: PatientInput): Promise<Patient>
    update(id: string, input: PatientInput): Promise<Patient>
    setConsent(id: string, kind: ConsentKind, granted: boolean): Promise<void>
    exportRecord(id: string, reason: string): Promise<{ ok: true }>
    rights(id: string): Promise<RightsRequest[]>
    addRights(id: string, input: { type: RightsType; dueDate: string; detail: string }): Promise<RightsRequest>
    updateRights(id: string, requestId: string, status: RightsStatus): Promise<RightsRequest>
  }
  notes: {
    forPatient(patientId: string): Promise<SessionNotesBundle[]>
    saveClinical(sessionId: string, input: { assessment: string; observations: string; plan: string; nextSteps: string }): Promise<ClinicalNote>
    saveProcess(sessionId: string, input: { body: string }): Promise<ProcessNote>
    breakGlass(sessionId: string, reason: string): Promise<ProcessNote>
    recordView(sessionId: string, kind: 'clinical' | 'process', outcome: 'SUCCESS' | 'DENIED'): Promise<void>
  }
  doctors: {
    list(): Promise<DoctorProfile[]>
    create(input: DoctorInput): Promise<DoctorProfile>
    update(id: string, input: DoctorInput): Promise<DoctorProfile>
    deactivate(id: string, assignments: { sessionId: string; doctorId: string }[]): Promise<void>
    upcoming(id: string): Promise<Session[]>
  }
  availability: {
    get(doctorId: string): Promise<AvailabilityView>
    save(doctorId: string, input: { bufferMinutes: number; defaultDuration: number; rules: { dayOfWeek: number; startTime: string; endTime: string; modes: SessionMode[] }[]; blocked: { date: string; reason: string }[] }): Promise<AvailabilityView>
  }
  payments: {
    list(query?: { doctorId?: string; status?: string; method?: string; from?: string; to?: string }): Promise<Payment[]>
    forSession(sessionId: string): Promise<Payment[]>
    summary(): Promise<{ outstanding: number; outstandingCount: number; unpaidSessions: number }>
    record(input: { sessionId: string; amount: number; method: PaymentMethod; status: PaymentStatus; reference?: string; note?: string }): Promise<Payment>
    refund(id: string, reason: string): Promise<Payment>
    exportCsv(reason: string): Promise<string>
  }
  analytics: {
    get(): Promise<AnalyticsReport>
  }
  audit: {
    list(query?: { actorId?: string; action?: AuditAction | ''; from?: string; to?: string }): Promise<AuditEvent[]>
  }
  settings: {
    get(): Promise<ClinicSettings>
    update(input: Partial<Pick<ClinicSettings, 'clinicName' | 'city' | 'locations' | 'sessionTypes' | 'websiteBookingsEnabled' | 'minimumNoticeHours' | 'confirmMode' | 'adminCanViewClinicalNotes'>>): Promise<ClinicSettings>
    updateDevFlags(input: { idleTimeoutSeconds?: number; simulateMeetFailure?: boolean }): Promise<ClinicSettings>
    reconnect(doctorId: string): Promise<ClinicSettings>
  }
}
