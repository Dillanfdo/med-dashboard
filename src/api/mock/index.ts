import type { ClinicApi, DoctorInput, PatientInput } from '@/api/interfaces'
import { getActor } from '@/api/actor'
import { ApiError } from '@/api/errors'
import { explainSlot, websiteSlots } from '@/api/mock/schedule'
import { ageInYears, addMinutes, formatInr, isMinor, monthKey, monthLabel, phoneDigits, registrationAlert, ymd } from '@/lib/format'
import { can } from '@/lib/permissions'
import { emitStore, getDb, persistEnabled, pushAudit, resetDatabase, setPersistEnabled, uid } from '@/mocks/store'
import type {
  Actor,
  AnalyticsPoint,
  AuditAction,
  AuditOutcome,
  ClinicalNote,
  ConsentKind,
  DoctorProfile,
  NoteVersion,
  Patient,
  Payment,
  ProcessNote,
  Role,
  Session,
  User,
} from '@/types'
import { BLOCKING_STATUSES, TENANT_ID } from '@/types'

const wait = (ms = 320) => new Promise((resolve) => setTimeout(resolve, ms))

function actorOf(user: User, prefer?: Role): Actor {
  const activeRole = prefer && user.roles.includes(prefer) ? prefer : user.roles.includes('ADMIN') ? 'ADMIN' : 'DOCTOR'
  return {
    userId: user.id,
    tenantId: user.tenantId,
    name: user.name,
    email: user.email,
    roles: [...user.roles],
    activeRole,
    doctorId: user.doctorId,
  }
}

function record(action: AuditAction, resourceType: string, resourceId: string, outcome: AuditOutcome = 'SUCCESS', reason?: string) {
  const actor = getActor()
  pushAudit({
    actorId: actor.userId,
    actorName: actor.name,
    actorRole: actor.activeRole,
    action,
    resourceType,
    resourceId,
    outcome,
    reason,
  })
}

function allow(action: Parameters<typeof can>[1], resource: Parameters<typeof can>[2]) {
  const actor = getActor()
  const ok = can(actor.activeRole, action, resource, {
    adminCanViewClinicalNotes: getDb().settings.adminCanViewClinicalNotes,
  })
  if (!ok) throw new ApiError('You do not have access to this in the current role.', 'FORBIDDEN')
}

function visiblePatients(actor: Actor) {
  const db = getDb()
  if (actor.activeRole === 'ADMIN') return db.patients
  if (!actor.doctorId) return []
  const seen = new Set(
    db.sessions.filter((session) => session.doctorId === actor.doctorId && session.patientId).map((session) => session.patientId as string),
  )
  return db.patients.filter((patient) => patient.assignedDoctorId === actor.doctorId || seen.has(patient.id))
}

function visibleSessions(actor: Actor) {
  const db = getDb()
  if (actor.activeRole === 'ADMIN') return db.sessions
  return db.sessions.filter((session) => session.doctorId === actor.doctorId)
}

function mustSession(id: string) {
  const actor = getActor()
  const session = visibleSessions(actor).find((item) => item.id === id)
  if (!session) throw new ApiError('That session is not available in this role.', 'FORBIDDEN')
  return session
}

function mustPatient(id: string) {
  const actor = getActor()
  const patient = visiblePatients(actor).find((item) => item.id === id)
  if (!patient) throw new ApiError('You do not have access to this record.', 'FORBIDDEN')
  return patient
}

function consentOn(patientId: string, kind: ConsentKind) {
  return getDb().consents.some((item) => item.patientId === patientId && item.kind === kind && item.granted)
}

function makeMeetLink() {
  const alpha = 'abcdefghijkmnopqrstuvwxyz'
  const chunk = (n: number) => Array.from({ length: n }, () => alpha[Math.floor(Math.random() * alpha.length)]).join('')
  return `https://meet.google.com/${chunk(3)}-${chunk(4)}-${chunk(3)}`
}

function kickMeet(sessionId: string) {
  const session = getDb().sessions.find((item) => item.id === sessionId)
  if (!session) return
  session.meetStatus = 'CREATING'
  session.inviteStatus = 'PENDING'
  const fail = getDb().settings.simulateMeetFailure
  emitStore()
  setTimeout(() => {
    const current = getDb().sessions.find((item) => item.id === sessionId)
    if (!current || current.status === 'CANCELLED') return
    if (fail) {
      current.meetStatus = 'FAILED'
      current.meetLink = undefined
      pushAudit({
        actorId: 'system',
        actorName: 'Calendar mock',
        actorRole: 'SYSTEM',
        action: 'UPDATE',
        resourceType: 'Session',
        resourceId: sessionId,
        outcome: 'DENIED',
        reason: 'Meet link creation failed (simulated)',
      })
    } else {
      current.meetStatus = 'READY'
      current.meetLink = makeMeetLink()
      current.inviteStatus = current.previousTimes.length > 0 ? 'UPDATED' : 'SENT'
      pushAudit({
        actorId: 'system',
        actorName: 'Calendar mock',
        actorRole: 'SYSTEM',
        action: 'UPDATE',
        resourceType: 'Session',
        resourceId: sessionId,
        outcome: 'SUCCESS',
        reason: 'Meet link created and calendar invite marked sent (simulated)',
      })
    }
    emitStore()
  }, 1300)
}

function addStatus(session: Session, note?: string) {
  const actor = getActor()
  getDb().statusEvents.push({
    id: uid('evt'),
    tenantId: TENANT_ID,
    sessionId: session.id,
    status: session.status,
    at: new Date().toISOString(),
    actorId: actor.userId,
    actorName: actor.name,
    note,
  })
}

function applyPatient(input: PatientInput, existing?: Patient): Patient {
  const actor = getActor()
  const name = input.fullName.trim()
  if (name.length < 2) throw new ApiError('Enter the full name.')
  const age = ageInYears(input.dateOfBirth)
  if (!input.dateOfBirth || Number.isNaN(age) || age < 0 || age > 110) throw new ApiError('Enter a valid date of birth.')
  const phone = phoneDigits(input.phone)
  if (!/^[6-9]\d{9}$/.test(phone)) throw new ApiError('Enter an Indian mobile number.')
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new ApiError('Enter a valid email or leave it blank.')
  if (actor.activeRole === 'DOCTOR' && actor.doctorId && input.assignedDoctorId !== actor.doctorId) {
    throw new ApiError('You can only assign a patient to yourself.')
  }
  const doctor = getDb().doctors.find((item) => item.id === input.assignedDoctorId && item.active)
  if (!doctor) throw new ApiError('Choose an active doctor.')
  if (!input.emergencyName.trim() || !input.emergencyPhone.trim()) throw new ApiError('Add an emergency contact.')
  if (isMinor(input.dateOfBirth)) {
    if (!input.guardianConsent) throw new ApiError('Guardian consent is required for a minor.')
    if (!input.guardianName?.trim() || !input.guardianPhone?.trim() || !input.guardianEmail?.trim()) {
      throw new ApiError('Add the guardian name, phone, and email.')
    }
  }
  const patient: Patient = {
    id: existing?.id ?? uid('pat'),
    tenantId: TENANT_ID,
    fullName: name,
    dateOfBirth: input.dateOfBirth,
    gender: (input.gender || undefined) as Patient['gender'],
    phone,
    email: input.email.trim(),
    address: input.addressLine
      ? { line1: input.addressLine, city: input.city ?? '', state: input.state ?? '', pin: input.pin ?? '' }
      : undefined,
    emergencyContact: {
      name: input.emergencyName.trim(),
      relationship: input.emergencyRelationship.trim() || 'Not recorded',
      phone: phoneDigits(input.emergencyPhone) || input.emergencyPhone.trim(),
    },
    assignedDoctorId: input.assignedDoctorId,
    preferredMode: input.preferredMode,
    referralSource: input.referralSource,
    status: input.status ?? existing?.status ?? 'ACTIVE',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  }
  const db = getDb()
  if (existing) {
    const index = db.patients.findIndex((item) => item.id === existing.id)
    db.patients[index] = patient
  } else db.patients.unshift(patient)

  if (isMinor(input.dateOfBirth)) {
    const guardian = {
      id: db.guardians.find((item) => item.patientId === patient.id)?.id ?? uid('grd'),
      tenantId: TENANT_ID,
      patientId: patient.id,
      name: input.guardianName?.trim() ?? '',
      relationship: input.guardianRelationship?.trim() || 'Guardian',
      phone: phoneDigits(input.guardianPhone ?? ''),
      email: input.guardianEmail?.trim() ?? '',
      consentObtained: true,
      verificationNote: input.guardianVerification?.trim() || 'Recorded in the prototype.',
    }
    const gIndex = db.guardians.findIndex((item) => item.patientId === patient.id)
    if (gIndex >= 0) db.guardians[gIndex] = guardian
    else db.guardians.push(guardian)
  } else {
    db.guardians = db.guardians.filter((item) => item.patientId !== patient.id)
  }

  if (!existing) {
    const defaults: { kind: ConsentKind; granted: boolean }[] = input.consents ?? [
      { kind: 'TREATMENT_RECORDS', granted: true },
      { kind: 'CALENDAR_INVITES', granted: true },
      { kind: 'GOOGLE_MEET', granted: true },
      { kind: 'PROMOTIONAL', granted: false },
    ]
    for (const item of defaults) {
      db.consents.push({
        id: uid('con'),
        tenantId: TENANT_ID,
        patientId: patient.id,
        kind: item.kind,
        granted: item.granted,
        updatedAt: new Date().toISOString(),
        updatedBy: actor.userId,
      })
    }
  }
  return patient
}

function paidAmount(sessionId: string) {
  return getDb()
    .payments.filter((item) => item.sessionId === sessionId && (item.status === 'PAID' || item.status === 'PARTIALLY_PAID'))
    .reduce((sum, item) => sum + item.amount, 0)
}

function sessionBalance(session: Session) {
  if (session.status === 'CANCELLED' || session.status === 'NO_SHOW' || !session.patientId) return 0
  const rows = getDb().payments.filter((item) => item.sessionId === session.id)
  if (rows.some((item) => item.status === 'WAIVED' || item.status === 'REFUNDED')) return 0
  return Math.max(0, session.fee - paidAmount(session.id))
}

function point(label: string, count: number, value = count, displayValue?: string): AnalyticsPoint {
  if (count < 5) return { label, total: null, display: '<5' }
  return { label, total: value, display: displayValue ?? String(value) }
}

function canReadClinical(actor: Actor, session: Session) {
  if (actor.doctorId && session.doctorId && actor.doctorId === session.doctorId) return true
  return actor.activeRole === 'ADMIN' && getDb().settings.adminCanViewClinicalNotes
}

function presentVersions(versions: NoteVersion[], authorId: string, readerId: string) {
  return versions.map((version) =>
    authorId === readerId ? version : { at: version.at, authorId: version.authorId, authorName: version.authorName },
  )
}

let websiteCounter = 0

export const api: ClinicApi = {
  auth: {
    async signIn(email, password) {
      await wait()
      const user = getDb().users.find((item) => item.email.toLowerCase() === email.trim().toLowerCase())
      if (!user || !user.active || password.trim().length === 0) throw new ApiError('Those sign-in details were not accepted.')
      return { userId: user.id, name: user.name, email: user.email }
    },
    async verifyMfa(userId, code) {
      await wait()
      const user = getDb().users.find((item) => item.id === userId && item.active)
      if (!user) throw new ApiError('That sign-in expired. Start again.')
      if (code.trim() !== '123456') {
        pushAudit({
          actorId: user.id,
          actorName: user.name,
          actorRole: user.roles[0],
          action: 'LOGIN',
          resourceType: 'SessionAuth',
          resourceId: user.id,
          outcome: 'DENIED',
          reason: 'MFA code not accepted',
        })
        emitStore()
        throw new ApiError('That code was not accepted. The prototype code is 123456.')
      }
      pushAudit({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.roles[0],
        action: 'LOGIN',
        resourceType: 'SessionAuth',
        resourceId: user.id,
        outcome: 'SUCCESS',
        reason: 'MFA accepted (prototype)',
      })
      emitStore()
      return actorOf(user)
    },
    async devSignIn(userId) {
      await wait(180)
      const user = getDb().users.find((item) => item.id === userId && item.active)
      if (!user) throw new ApiError('That prototype account is inactive.')
      pushAudit({
        actorId: user.id,
        actorName: user.name,
        actorRole: user.roles[0],
        action: 'LOGIN',
        resourceType: 'SessionAuth',
        resourceId: user.id,
        outcome: 'SUCCESS',
        reason: 'Dev persona picker',
      })
      emitStore()
      return actorOf(user)
    },
    async refresh() {
      const actor = getActor()
      const user = getDb().users.find((item) => item.id === actor.userId)
      if (!user || !user.active) return null
      return actorOf(user, user.roles.includes(actor.activeRole) ? actor.activeRole : undefined)
    },
  },
  dev: {
    persistEnabled() {
      return persistEnabled()
    },
    setPersist(on) {
      setPersistEnabled(on)
    },
    async reset() {
      await wait(200)
      resetDatabase()
    },
  },
  notifications: {
    async list() {
      await wait(180)
      const actor = getActor()
      const items = []
      const pending = visibleSessions(actor).filter((session) => session.status === 'REQUESTED' && session.source === 'WEBSITE')
      if (pending.length) {
        items.push({
          id: 'note-web',
          title: 'Website booking requests',
          body: `${pending.length} request${pending.length === 1 ? '' : 's'} waiting for review.`,
          href: '/sessions?source=WEBSITE',
        })
      }
      if (actor.activeRole === 'ADMIN') {
        const flags = getDb().doctors.filter((doctor) => doctor.active && registrationAlert(doctor.rciExpiry))
        if (flags.length) {
          items.push({
            id: 'note-reg',
            title: 'Professional registration',
            body: `${flags.length} registration${flags.length === 1 ? '' : 's'} expired or expiring within 60 days.`,
            href: '/doctors',
          })
        }
        const unpaid = getDb().sessions.filter((session) => session.status === 'COMPLETED' && sessionBalance(session) > 0).length
        if (unpaid > 0) {
          items.push({
            id: 'note-pay',
            title: 'Unpaid sessions',
            body: `${unpaid} completed session${unpaid === 1 ? '' : 's'} still have a balance.`,
            href: '/payments',
          })
        }
      }
      return items
    },
  },
  sessions: {
    async list(query) {
      await wait()
      const actor = getActor()
      allow(actor.activeRole === 'ADMIN' ? 'view_all' : 'view_own', 'sessions')
      return visibleSessions(actor)
        .filter((session) => (query?.status ? session.status === query.status : true))
        .filter((session) => (query?.doctorId ? session.doctorId === query.doctorId : true))
        .filter((session) => (query?.mode ? session.mode === query.mode : true))
        .filter((session) => (query?.source ? session.source === query.source : true))
        .filter((session) => (query?.from ? ymd(new Date(session.start)) >= query.from : true))
        .filter((session) => (query?.to ? ymd(new Date(session.start)) <= query.to : true))
        .sort((a, b) => (a.start < b.start ? 1 : -1))
    },
    async get(id) {
      await wait(200)
      return mustSession(id)
    },
    async timeline(id) {
      await wait(160)
      mustSession(id)
      return getDb()
        .statusEvents.filter((event) => event.sessionId === id)
        .sort((a, b) => (a.at < b.at ? -1 : 1))
    },
    async checkSlot(input) {
      await wait(160)
      getActor()
      const message = explainSlot({
        doctorId: input.doctorId,
        startIso: input.start,
        durationMinutes: input.durationMinutes,
        mode: input.mode,
        excludeSessionId: input.excludeSessionId,
      })
      return { ok: !message, message: message ?? undefined }
    },
    async create(input) {
      await wait(420)
      const actor = getActor()
      allow('create', 'sessions')
      if (actor.activeRole === 'DOCTOR' && input.doctorId !== actor.doctorId) {
        throw new ApiError('In the doctor role you book only on your own calendar.')
      }
      const patient = mustPatient(input.patientId)
      const doctor = getDb().doctors.find((item) => item.id === input.doctorId)
      if (!doctor) throw new ApiError('Choose a doctor.')
      if (input.mode === 'ONLINE' && !patient.email.trim()) {
        throw new ApiError('Add an email on the patient record before booking an online session. The Meet link is sent by calendar invite.')
      }
      if (input.mode === 'IN_PERSON' && !input.locationId) throw new ApiError('Choose a clinic location for an in-person session.')
      const message = explainSlot({
        doctorId: input.doctorId,
        startIso: input.start,
        durationMinutes: input.durationMinutes,
        mode: input.mode,
      })
      if (message) throw new ApiError(message)
      const fee = actor.activeRole === 'ADMIN' ? input.fee : doctor.defaultFee
      const session: Session = {
        id: uid('ses'),
        tenantId: TENANT_ID,
        patientId: patient.id,
        doctorId: doctor.id,
        start: input.start,
        end: addMinutes(input.start, input.durationMinutes),
        durationMinutes: input.durationMinutes,
        mode: input.mode,
        locationId: input.mode === 'IN_PERSON' ? input.locationId : undefined,
        fee,
        schedulingNotes: input.schedulingNotes?.trim().slice(0, 280),
        status: 'CONFIRMED',
        source: 'INTERNAL',
        meetStatus: input.mode === 'ONLINE' ? 'CREATING' : 'NONE',
        inviteStatus: input.mode === 'ONLINE' ? 'PENDING' : consentOn(patient.id, 'CALENDAR_INVITES') ? 'SENT' : 'NOT_SENT',
        previousTimes: [],
        createdAt: new Date().toISOString(),
        createdBy: actor.userId,
      }
      getDb().sessions.unshift(session)
      addStatus(session, 'Booked by the clinic')
      record('CREATE', 'Session', session.id, 'SUCCESS', input.mode === 'ONLINE' ? 'Online session confirmed' : 'In-person session confirmed')
      emitStore()
      if (input.mode === 'ONLINE') kickMeet(session.id)
      return session
    },
    async reschedule(id, input) {
      await wait(400)
      allow('reschedule', 'sessions')
      const session = mustSession(id)
      if (!session.doctorId) throw new ApiError('Assign a doctor before moving this session.')
      if (!['CONFIRMED', 'RESCHEDULED', 'REQUESTED'].includes(session.status)) {
        throw new ApiError('This session can no longer be rescheduled.')
      }
      if (input.reason.trim().length < 3) throw new ApiError('Add a reason for the change.')
      const message = explainSlot({
        doctorId: session.doctorId,
        startIso: input.start,
        durationMinutes: input.durationMinutes,
        mode: session.mode,
        excludeSessionId: session.id,
      })
      if (message) throw new ApiError(message)
      const actor = getActor()
      session.previousTimes.push({
        start: session.start,
        end: session.end,
        reason: input.reason.trim(),
        changedAt: new Date().toISOString(),
        changedBy: actor.name,
      })
      session.start = input.start
      session.durationMinutes = input.durationMinutes
      session.end = addMinutes(input.start, input.durationMinutes)
      if (session.status !== 'REQUESTED') session.status = 'RESCHEDULED'
      if (session.inviteStatus === 'SENT' || session.inviteStatus === 'UPDATED') session.inviteStatus = 'UPDATED'
      addStatus(session, input.reason.trim())
      record('UPDATE', 'Session', session.id, 'SUCCESS', 'Rescheduled. Calendar invite will be updated.')
      emitStore()
      return session
    },
    async cancel(id, input) {
      await wait(400)
      allow('cancel', 'sessions')
      const session = mustSession(id)
      if (session.status === 'CANCELLED') throw new ApiError('This session is already cancelled.')
      if (input.reason.trim().length < 3) throw new ApiError('Choose or write a cancellation reason.')
      session.status = 'CANCELLED'
      session.cancelReason = input.reason.trim()
      session.cancelledBy = input.cancelledBy
      session.inviteStatus = session.inviteStatus === 'NOT_SENT' ? 'NOT_SENT' : 'CANCELLED'
      addStatus(session, `${input.cancelledBy === 'CLINIC' ? 'Clinic' : 'Patient'}: ${input.reason.trim()}`)
      record('UPDATE', 'Session', session.id, 'SUCCESS', 'Cancelled. Calendar event will be cancelled.')
      emitStore()
      return session
    },
    async setStatus(id, status) {
      await wait(280)
      allow('update', 'sessions')
      const session = mustSession(id)
      if (!['CONFIRMED', 'RESCHEDULED'].includes(session.status)) throw new ApiError('Only a booked session can be marked this way.')
      session.status = status
      addStatus(session, status === 'COMPLETED' ? 'Marked completed' : 'Marked as no-show')
      record('UPDATE', 'Session', session.id)
      emitStore()
      return session
    },
    async retryMeet(id) {
      await wait(200)
      allow('update', 'sessions')
      const session = mustSession(id)
      if (session.mode !== 'ONLINE') throw new ApiError('Meet links are only created for online sessions.')
      if (session.status === 'CANCELLED') throw new ApiError('This session is cancelled.')
      kickMeet(session.id)
      return session
    },
    async websiteDetail(id) {
      await wait(200)
      const actor = getActor()
      const session = mustSession(id)
      const request = getDb().websiteRequests.find((item) => item.sessionId === id) ?? null
      const matches = []
      if (session.requester) {
        const phone = phoneDigits(session.requester.phone)
        const email = session.requester.email.trim().toLowerCase()
        for (const patient of visiblePatients(actor)) {
          const samePhone = phoneDigits(patient.phone) === phone
          const sameEmail = !!email && patient.email.toLowerCase() === email
          if (samePhone || sameEmail) {
            matches.push({ patientId: patient.id, label: `${patient.fullName} · ${patient.id}`, via: samePhone ? 'phone' as const : 'email' as const })
          }
        }
      }
      return { request, matches }
    },
    async confirmWebsite(id, input) {
      await wait(480)
      allow('update', 'website_bookings')
      const session = mustSession(id)
      if (session.status !== 'REQUESTED' || session.source !== 'WEBSITE') throw new ApiError('This request is no longer waiting.')
      const doctorId = input.doctorId || session.doctorId
      if (!doctorId) throw new ApiError('Choose a doctor before confirming.')
      const actor = getActor()
      if (actor.activeRole === 'DOCTOR' && doctorId !== actor.doctorId) throw new ApiError('You can confirm only your own requests.')
      let patientId = input.patientId
      if (!patientId && input.patient) patientId = applyPatient(input.patient).id
      if (!patientId) throw new ApiError('Link an existing patient or create one.')
      const patient = mustPatient(patientId)
      if (session.mode === 'ONLINE' && !patient.email.trim()) {
        throw new ApiError('Online confirmation needs a patient email so the calendar invite and Meet link can be sent.')
      }
      const message = explainSlot({
        doctorId,
        startIso: session.start,
        durationMinutes: session.durationMinutes,
        mode: session.mode,
        excludeSessionId: session.id,
      })
      if (message) throw new ApiError(message)
      const doctor = getDb().doctors.find((item) => item.id === doctorId)!
      session.patientId = patient.id
      session.doctorId = doctorId
      session.fee = doctor.defaultFee
      session.status = 'CONFIRMED'
      session.meetStatus = session.mode === 'ONLINE' ? 'CREATING' : 'NONE'
      session.inviteStatus = session.mode === 'ONLINE' ? 'PENDING' : consentOn(patient.id, 'CALENDAR_INVITES') ? 'SENT' : 'NOT_SENT'
      if (session.mode === 'IN_PERSON' && !session.locationId) session.locationId = getDb().settings.locations[0]?.id
      addStatus(session, 'Website request confirmed')
      record('UPDATE', 'WebsiteBookingRequest', id, 'SUCCESS', 'Confirmed')
      emitStore()
      if (session.mode === 'ONLINE') kickMeet(session.id)
      return session
    },
    async proposeWebsite(id, input) {
      await wait(360)
      allow('update', 'website_bookings')
      const session = mustSession(id)
      if (session.status !== 'REQUESTED') throw new ApiError('This request is no longer waiting.')
      if (!session.doctorId && !input) throw new ApiError('Choose a time.')
      if (!session.doctorId) throw new ApiError('Assign a doctor before proposing a time.')
      if (input.reason.trim().length < 3) throw new ApiError('Add a short reason for the new time.')
      const message = explainSlot({
        doctorId: session.doctorId,
        startIso: input.start,
        durationMinutes: input.durationMinutes,
        mode: session.mode,
        excludeSessionId: session.id,
      })
      if (message) throw new ApiError(message)
      const actor = getActor()
      session.previousTimes.push({
        start: session.start,
        end: session.end,
        reason: input.reason.trim(),
        changedAt: new Date().toISOString(),
        changedBy: actor.name,
      })
      session.start = input.start
      session.durationMinutes = input.durationMinutes
      session.end = addMinutes(input.start, input.durationMinutes)
      addStatus(session, `Proposed another time. ${input.reason.trim()}`)
      record('UPDATE', 'WebsiteBookingRequest', id, 'SUCCESS', 'Proposed another time')
      emitStore()
      return session
    },
    async declineWebsite(id, input) {
      await wait(320)
      allow('update', 'website_bookings')
      const session = mustSession(id)
      if (session.status !== 'REQUESTED') throw new ApiError('This request is no longer waiting.')
      if (input.reason.trim().length < 3) throw new ApiError('Add a reason for declining.')
      session.status = 'CANCELLED'
      session.cancelReason = input.reason.trim()
      session.cancelledBy = 'CLINIC'
      session.inviteStatus = 'NOT_SENT'
      addStatus(session, `Declined. ${input.reason.trim()}`)
      record('UPDATE', 'WebsiteBookingRequest', id, 'SUCCESS', 'Declined')
      emitStore()
      return session
    },
    async simulateWebsite() {
      await wait(420)
      getActor()
      const actor = getActor()
      const db = getDb()
      const doctor =
        actor.activeRole === 'DOCTOR' && actor.doctorId
          ? db.doctors.find((item) => item.id === actor.doctorId)
          : db.doctors.filter((item) => item.active)[websiteCounter % db.doctors.filter((item) => item.active).length]
      if (!doctor) throw new ApiError('No active doctor is available for a sample request.')
      const preview = websiteSlots(doctor.id)
      const slot = preview.slots[websiteCounter % Math.max(preview.slots.length, 1)]
      if (!slot) throw new ApiError('No free website slot was found. Adjust working hours or notice time and try again.')
      websiteCounter += 1
      const useMatch = websiteCounter % 3 === 0
      const requester = useMatch
        ? { name: 'Riya Sample', phone: '9000000007', email: 'riya.sample@example.com' }
        : { name: `Website Guest ${websiteCounter}`, phone: `90000008${String(websiteCounter).padStart(2, '0')}`.slice(0, 10), email: `guest.${websiteCounter}@example.com` }
      const mode = slot.modes.includes('ONLINE') && websiteCounter % 2 === 0 ? 'ONLINE' : slot.modes[0]
      const session: Session = {
        id: uid('ses'),
        tenantId: TENANT_ID,
        patientId: null,
        doctorId: doctor.id,
        start: slot.start,
        end: slot.end,
        durationMinutes: doctor.defaultDuration,
        mode,
        locationId: mode === 'IN_PERSON' ? db.settings.locations[0]?.id : undefined,
        fee: doctor.defaultFee,
        status: 'REQUESTED',
        source: 'WEBSITE',
        meetStatus: 'NONE',
        inviteStatus: 'NOT_SENT',
        previousTimes: [],
        requester,
        createdAt: new Date().toISOString(),
        createdBy: 'website',
      }
      db.sessions.unshift(session)
      db.websiteRequests.unshift({
        id: uid('wbr'),
        tenantId: TENANT_ID,
        sessionId: session.id,
        token: uid('tok'),
        requesterName: requester.name,
        phone: requester.phone,
        email: requester.email,
        consentFlags: { records: true, calendar: true, meet: mode === 'ONLINE', promo: false },
        createdAt: session.createdAt,
      })
      getDb().statusEvents.push({
        id: uid('evt'),
        tenantId: TENANT_ID,
        sessionId: session.id,
        status: 'REQUESTED',
        at: session.createdAt,
        actorId: 'website',
        actorName: 'Website',
        note: 'Simulated public website request',
      })
      record('CREATE', 'WebsiteBookingRequest', session.id, 'SUCCESS', 'Simulated website booking')
      emitStore()
      return session
    },
  },
  patients: {
    async list(query) {
      await wait()
      const actor = getActor()
      allow(actor.activeRole === 'ADMIN' ? 'view_all' : 'view_own', 'patients')
      const search = query?.search?.trim().toLowerCase()
      return visiblePatients(actor)
        .filter((patient) => (query?.doctorId ? patient.assignedDoctorId === query.doctorId : true))
        .filter((patient) => (query?.status ? patient.status === query.status : true))
        .filter((patient) => (query?.minor === 'yes' ? isMinor(patient.dateOfBirth) : query?.minor === 'no' ? !isMinor(patient.dateOfBirth) : true))
        .filter((patient) =>
          search
            ? patient.fullName.toLowerCase().includes(search) ||
              patient.phone.includes(search.replace(/\s/g, '')) ||
              patient.id.toLowerCase().includes(search) ||
              patient.email.toLowerCase().includes(search)
            : true,
        )
        .sort((a, b) => a.fullName.localeCompare(b.fullName))
    },
    async get(id) {
      await wait(180)
      return mustPatient(id)
    },
    async guardian(id) {
      await wait(120)
      mustPatient(id)
      return getDb().guardians.find((item) => item.patientId === id) ?? null
    },
    async consents(id) {
      await wait(120)
      mustPatient(id)
      return getDb().consents.filter((item) => item.patientId === id)
    },
    async create(input) {
      await wait(420)
      allow('create', 'patients')
      const patient = applyPatient(input)
      record('CREATE', 'Patient', patient.id)
      emitStore()
      return patient
    },
    async update(id, input) {
      await wait(400)
      allow('update', 'patients')
      const existing = mustPatient(id)
      const patient = applyPatient(input, existing)
      record('UPDATE', 'Patient', patient.id)
      emitStore()
      return patient
    },
    async setConsent(id, kind, granted) {
      await wait(240)
      allow('update', 'patients')
      mustPatient(id)
      const actor = getActor()
      const db = getDb()
      const current = db.consents.find((item) => item.patientId === id && item.kind === kind)
      if (current) {
        current.granted = granted
        current.updatedAt = new Date().toISOString()
        current.updatedBy = actor.userId
      } else {
        db.consents.push({
          id: uid('con'),
          tenantId: TENANT_ID,
          patientId: id,
          kind,
          granted,
          updatedAt: new Date().toISOString(),
          updatedBy: actor.userId,
        })
      }
      record('UPDATE', 'Consent', id, 'SUCCESS', kind)
      emitStore()
    },
    async exportRecord(id, reason) {
      await wait(360)
      allow('export', 'patients')
      mustPatient(id)
      if (reason.trim().length < 3) throw new ApiError('Add a reason for the export.')
      record('EXPORT', 'Patient', id, 'SUCCESS', reason.trim())
      emitStore()
      return { ok: true as const }
    },
    async rights(id) {
      await wait(140)
      mustPatient(id)
      return getDb().rightsRequests.filter((item) => item.patientId === id)
    },
    async addRights(id, input) {
      await wait(300)
      allow('update', 'patients')
      mustPatient(id)
      if (input.detail.trim().length < 3) throw new ApiError('Describe the request.')
      const row = {
        id: uid('rgt'),
        tenantId: TENANT_ID,
        patientId: id,
        type: input.type,
        status: 'OPEN' as const,
        dueDate: input.dueDate,
        detail: input.detail.trim(),
        createdAt: new Date().toISOString(),
        createdBy: getActor().userId,
      }
      getDb().rightsRequests.unshift(row)
      record('CREATE', 'RightsRequest', row.id)
      emitStore()
      return row
    },
    async updateRights(id, requestId, status) {
      await wait(240)
      allow('update', 'patients')
      mustPatient(id)
      const row = getDb().rightsRequests.find((item) => item.id === requestId && item.patientId === id)
      if (!row) throw new ApiError('That request was not found.')
      row.status = status
      record('UPDATE', 'RightsRequest', row.id, 'SUCCESS', status)
      emitStore()
      return row
    },
  },
  notes: {
    async forPatient(patientId) {
      await wait(280)
      const actor = getActor()
      mustPatient(patientId)
      const sessions = getDb()
        .sessions.filter((session) => session.patientId === patientId)
        .sort((a, b) => (a.start < b.start ? 1 : -1))
      return sessions.map((session) => {
        const clinical = getDb().clinicalNotes.find((note) => note.sessionId === session.id)
        const process = getDb().processNotes.find((note) => note.sessionId === session.id)
        const clinicalAccess = !canReadClinical(actor, session)
          ? ({ access: 'denied' } as const)
          : clinical
            ? {
                access: 'ok' as const,
                note: { ...clinical, versions: presentVersions(clinical.versions, clinical.authorId, actor.userId) },
              }
            : ({ access: 'empty' } as const)
        let processAccess: SessionNotes['process']
        if (process && process.authorId === actor.userId) {
          processAccess = { access: 'ok', note: { ...process, versions: presentVersions(process.versions, process.authorId, actor.userId) } }
        } else if (!process && actor.doctorId && actor.doctorId === session.doctorId) {
          processAccess = { access: 'empty' }
        } else if (actor.activeRole === 'ADMIN') {
          processAccess = process ? { access: 'locked' } : { access: 'empty' }
        } else processAccess = { access: 'denied' }
        return { session, clinical: clinicalAccess, process: processAccess }
      })
    },
    async saveClinical(sessionId, input) {
      await wait(360)
      const actor = getActor()
      const session = mustSession(sessionId)
      if (!session.patientId) throw new ApiError('Link a patient before writing a note.')
      if (actor.doctorId !== session.doctorId) throw new ApiError('Only the treating doctor can edit this note.')
      if (input.assessment.trim().length < 3) throw new ApiError('Add a short clinical note.')
      const db = getDb()
      const existing = db.clinicalNotes.find((note) => note.sessionId === sessionId)
      const snapshot = [input.assessment, input.observations, input.plan, input.nextSteps].map((part) => part.trim()).join('\n')
      if (existing) {
        if (existing.authorId !== actor.userId) throw new ApiError('Only the author can edit this note.')
        existing.assessment = input.assessment.trim()
        existing.observations = input.observations.trim()
        existing.plan = input.plan.trim()
        existing.nextSteps = input.nextSteps.trim()
        existing.updatedAt = new Date().toISOString()
        existing.versions.push({ at: existing.updatedAt, authorId: actor.userId, authorName: actor.name, body: snapshot })
        record('UPDATE', 'ClinicalNote', existing.id)
        emitStore()
        return { ...existing, versions: presentVersions(existing.versions, existing.authorId, actor.userId) }
      }
      const note: ClinicalNote = {
        id: uid('cnote'),
        tenantId: TENANT_ID,
        sessionId,
        patientId: session.patientId,
        authorId: actor.userId,
        authorName: actor.name,
        assessment: input.assessment.trim(),
        observations: input.observations.trim(),
        plan: input.plan.trim(),
        nextSteps: input.nextSteps.trim(),
        versions: [{ at: new Date().toISOString(), authorId: actor.userId, authorName: actor.name, body: snapshot }],
        updatedAt: new Date().toISOString(),
      }
      db.clinicalNotes.unshift(note)
      record('CREATE', 'ClinicalNote', note.id)
      emitStore()
      return note
    },
    async saveProcess(sessionId, input) {
      await wait(360)
      const actor = getActor()
      const session = mustSession(sessionId)
      if (!session.patientId) throw new ApiError('Link a patient before writing a note.')
      if (actor.doctorId !== session.doctorId) throw new ApiError('Only the treating doctor can write a process note.')
      if (input.body.trim().length < 3) throw new ApiError('Write a short process note.')
      const db = getDb()
      const existing = db.processNotes.find((note) => note.sessionId === sessionId)
      if (existing) {
        if (existing.authorId !== actor.userId) throw new ApiError('Only the author can edit this note.')
        existing.body = input.body.trim()
        existing.updatedAt = new Date().toISOString()
        existing.versions.push({ at: existing.updatedAt, authorId: actor.userId, authorName: actor.name, body: existing.body })
        record('UPDATE', 'ProcessNote', existing.id)
        emitStore()
        return existing
      }
      const note: ProcessNote = {
        id: uid('pnote'),
        tenantId: TENANT_ID,
        sessionId,
        patientId: session.patientId,
        authorId: actor.userId,
        authorName: actor.name,
        body: input.body.trim(),
        versions: [{ at: new Date().toISOString(), authorId: actor.userId, authorName: actor.name, body: input.body.trim() }],
        updatedAt: new Date().toISOString(),
      }
      db.processNotes.unshift(note)
      record('CREATE', 'ProcessNote', note.id)
      emitStore()
      return note
    },
    async breakGlass(sessionId, reason) {
      await wait(400)
      allow('break_glass', 'process_notes')
      if (reason.trim().length < 8) throw new ApiError('Type a reason of at least a short sentence.')
      mustSession(sessionId)
      const note = getDb().processNotes.find((item) => item.sessionId === sessionId)
      if (!note) throw new ApiError('There is no process note on this session.')
      record('BREAK_GLASS', 'ProcessNote', note.id, 'SUCCESS', reason.trim())
      emitStore()
      return { ...note, versions: note.versions.map((version) => ({ at: version.at, authorId: version.authorId, authorName: version.authorName })) }
    },
    async recordView(sessionId, kind, outcome) {
      const session = getDb().sessions.find((item) => item.id === sessionId)
      if (!session) return
      const note =
        kind === 'clinical'
          ? getDb().clinicalNotes.find((item) => item.sessionId === sessionId)
          : getDb().processNotes.find((item) => item.sessionId === sessionId)
      record(outcome === 'DENIED' ? 'VIEW' : 'VIEW', kind === 'clinical' ? 'ClinicalNote' : 'ProcessNote', note?.id ?? session.id, outcome)
      emitStore()
    },
  },
  doctors: {
    async list() {
      await wait()
      const actor = getActor()
      if (actor.activeRole === 'ADMIN') {
        allow('view_all', 'doctors')
        return getDb().doctors
      }
      allow('view_own', 'doctors')
      return getDb().doctors.filter((doctor) => doctor.id === actor.doctorId)
    },
    async create(input) {
      await wait(460)
      allow('create', 'doctors')
      const doctor = insertDoctor(input)
      record('CREATE', 'DoctorProfile', doctor.id)
      if (input.alsoAdmin) record('PERMISSION_CHANGE', 'User', doctor.userId, 'SUCCESS', 'Also acts as admin')
      emitStore()
      return doctor
    },
    async update(id, input) {
      await wait(420)
      allow('update', 'doctors')
      const existing = getDb().doctors.find((item) => item.id === id)
  if (!existing) throw new ApiError('That doctor was not found.')
  if (existing.active && !input.active) throw new ApiError('Use Deactivate so upcoming sessions can be reassigned.')
  const wasAdmin = existing.alsoAdmin
      const doctor = insertDoctor(input, existing)
      record('UPDATE', 'DoctorProfile', doctor.id)
      if (wasAdmin !== input.alsoAdmin) {
        record('PERMISSION_CHANGE', 'User', doctor.userId, 'SUCCESS', input.alsoAdmin ? 'Granted admin role' : 'Removed admin role')
      }
      emitStore()
      return doctor
    },
    async upcoming(id) {
      await wait(160)
      allow('view_all', 'doctors')
      return getDb()
        .sessions.filter((session) => session.doctorId === id && BLOCKING_STATUSES.includes(session.status) && new Date(session.start).getTime() > Date.now())
        .sort((a, b) => (a.start < b.start ? -1 : 1))
    },
    async deactivate(id, assignments) {
      await wait(480)
      allow('deactivate', 'doctors')
      const actor = getActor()
      if (actor.doctorId === id) throw new ApiError('You cannot deactivate the account you are using.')
      const doctor = getDb().doctors.find((item) => item.id === id)
      if (!doctor) throw new ApiError('That doctor was not found.')
      const upcoming = getDb().sessions.filter(
        (session) => session.doctorId === id && BLOCKING_STATUSES.includes(session.status) && new Date(session.start).getTime() > Date.now(),
      )
      if (upcoming.length && assignments.length !== upcoming.length) {
        throw new ApiError('Reassign every upcoming session before deactivating this doctor.')
      }
      for (const session of upcoming) {
        const next = assignments.find((item) => item.sessionId === session.id)
        if (!next) throw new ApiError('Reassign every upcoming session before deactivating this doctor.')
        const message = explainSlot({
          doctorId: next.doctorId,
          startIso: session.start,
          durationMinutes: session.durationMinutes,
          mode: session.mode,
          excludeSessionId: session.id,
        })
        if (message) throw new ApiError(`${message} Pick another doctor for the session at ${session.start}.`)
        session.doctorId = next.doctorId
        if (session.inviteStatus === 'SENT' || session.inviteStatus === 'UPDATED') session.inviteStatus = 'UPDATED'
        addStatus(session, `Reassigned while deactivating ${doctor.fullName}`)
      }
      doctor.active = false
      const user = getDb().users.find((item) => item.id === doctor.userId)
      if (user) user.active = false
      record('UPDATE', 'DoctorProfile', doctor.id, 'SUCCESS', 'Deactivated. Future access revoked.')
      emitStore()
    },
  },
  availability: {
    async get(doctorId) {
      await wait(240)
      const actor = getActor()
      if (actor.activeRole === 'DOCTOR' && actor.doctorId !== doctorId) throw new ApiError('You can view only your own availability.')
      if (actor.activeRole === 'ADMIN') allow('view_all', 'availability')
      else allow('view_own', 'availability')
      const doctor = getDb().doctors.find((item) => item.id === doctorId)
      if (!doctor) throw new ApiError('That doctor was not found.')
      return {
        rules: getDb().availability.filter((item) => item.doctorId === doctorId),
        blocked: getDb().blockedDates.filter((item) => item.doctorId === doctorId),
        bufferMinutes: doctor.bufferMinutes,
        defaultDuration: doctor.defaultDuration,
        preview: websiteSlots(doctorId),
      }
    },
    async save(doctorId, input) {
      await wait(420)
      const actor = getActor()
      allow('update', 'availability')
      if (actor.activeRole === 'DOCTOR' && actor.doctorId !== doctorId) throw new ApiError('You can edit only your own availability.')
      const doctor = getDb().doctors.find((item) => item.id === doctorId)
      if (!doctor) throw new ApiError('That doctor was not found.')
      if (input.defaultDuration < 15 || input.defaultDuration > 180) throw new ApiError('Session duration should be between 15 and 180 minutes.')
      if (input.bufferMinutes < 0 || input.bufferMinutes > 60) throw new ApiError('Buffer should be between 0 and 60 minutes.')
      for (const rule of input.rules) {
        if (rule.modes.length === 0) throw new ApiError('Each working block needs at least one mode.')
        if (rule.endTime <= rule.startTime) throw new ApiError('A working block must end after it starts.')
        const unsupported = rule.modes.find((mode) => !doctor.modes.includes(mode))
        if (unsupported) throw new ApiError('A block uses a mode this doctor does not offer.')
      }
      doctor.bufferMinutes = input.bufferMinutes
      doctor.defaultDuration = input.defaultDuration
      const db = getDb()
      db.availability = db.availability.filter((item) => item.doctorId !== doctorId)
      for (const rule of input.rules) {
        db.availability.push({ id: uid('avl'), tenantId: TENANT_ID, doctorId, ...rule })
      }
      db.blockedDates = db.blockedDates.filter((item) => item.doctorId !== doctorId)
      for (const blocked of input.blocked) {
        if (!blocked.date || blocked.reason.trim().length < 2) throw new ApiError('Each leave date needs a short reason.')
        db.blockedDates.push({ id: uid('blk'), tenantId: TENANT_ID, doctorId, date: blocked.date, reason: blocked.reason.trim() })
      }
      record('UPDATE', 'AvailabilityRule', doctorId)
      emitStore()
      return api.availability.get(doctorId)
    },
  },
  payments: {
    async list(query) {
      await wait()
      allow('view', 'payments')
      const sessions = getDb().sessions
      return getDb()
        .payments.filter((payment) => {
          const session = sessions.find((item) => item.id === payment.sessionId)
          if (query?.doctorId && session?.doctorId !== query.doctorId) return false
          if (query?.status && payment.status !== query.status) return false
          if (query?.method && payment.method !== query.method) return false
          const day = ymd(new Date(payment.recordedAt))
          if (query?.from && day < query.from) return false
          if (query?.to && day > query.to) return false
          return true
        })
        .sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))
    },
    async forSession(sessionId) {
      await wait(140)
      allow('view', 'payments')
      mustSession(sessionId)
      return getDb().payments.filter((item) => item.sessionId === sessionId)
    },
    async summary() {
      await wait(180)
      allow('view', 'payments')
      const completed = getDb().sessions.filter((session) => session.status === 'COMPLETED')
      const open = completed.filter((session) => sessionBalance(session) > 0)
      return {
        outstanding: open.reduce((sum, session) => sum + sessionBalance(session), 0),
        outstandingCount: open.length,
        unpaidSessions: open.length,
      }
    },
    async record(input) {
      await wait(400)
      allow('record', 'payments')
      const session = mustSession(input.sessionId)
      if (!session.patientId) throw new ApiError('Link a patient before recording a payment.')
      if (input.reference && /^\d{13,19}$/.test(input.reference.replace(/\s/g, ''))) {
        throw new ApiError('Enter a transaction reference, not a card number.')
      }
      if (input.amount < 0) throw new ApiError('Amount cannot be negative.')
      const actor = getActor()
      const payment: Payment = {
        id: uid('pay'),
        tenantId: TENANT_ID,
        patientId: session.patientId,
        sessionId: session.id,
        amount: input.status === 'WAIVED' ? 0 : input.amount,
        method: input.method,
        status: input.status,
        reference: input.reference?.trim() || undefined,
        receiptNumber: input.status === 'PAID' || input.status === 'PARTIALLY_PAID' ? `RCP-2026-${Math.floor(1000 + Math.random() * 9000)}` : undefined,
        recordedBy: actor.userId,
        recordedByName: actor.name,
        recordedAt: new Date().toISOString(),
        note: input.note?.trim(),
      }
      getDb().payments.unshift(payment)
      record('CREATE', 'Payment', payment.id, 'SUCCESS', input.status)
      emitStore()
      return payment
    },
    async refund(id, reason) {
      await wait(360)
      allow('record', 'payments')
      if (reason.trim().length < 3) throw new ApiError('Add a reason for the refund.')
      const payment = getDb().payments.find((item) => item.id === id)
      if (!payment) throw new ApiError('That payment was not found.')
      mustSession(payment.sessionId)
      payment.status = 'REFUNDED'
      payment.note = reason.trim()
      record('UPDATE', 'Payment', payment.id, 'SUCCESS', 'Marked refunded')
      emitStore()
      return payment
    },
    async exportCsv(reason) {
      await wait(300)
      allow('export', 'payments')
      if (reason.trim().length < 3) throw new ApiError('Add a reason for the export.')
      const rows = [
        ['Date', 'Patient id', 'Session id', 'Amount INR', 'Method', 'Status', 'Receipt', 'Reference', 'Recorded by'],
        ...getDb().payments.map((payment) => [
          payment.recordedAt,
          payment.patientId,
          payment.sessionId,
          String(payment.amount),
          payment.method,
          payment.status,
          payment.receiptNumber ?? '',
          payment.reference ?? '',
          payment.recordedByName,
        ]),
      ]
      record('EXPORT', 'Payment', 'payments', 'SUCCESS', reason.trim())
      emitStore()
      return rows.map((row) => row.map((cell) => `"${cell.split('"').join('""')}"`).join(',')).join('\n')
    },
  },
  analytics: {
    async get() {
      await wait(360)
      const actor = getActor()
      allow('view', 'analytics')
      const own = actor.activeRole === 'DOCTOR'
      const sessions = visibleSessions(actor).filter((session) => (own && actor.doctorId ? session.doctorId === actor.doctorId : true))
      const months = recentMonths(4)
      const sessionsPerMonth = months.map((key) => {
        const count = sessions.filter((session) => monthKey(session.start) === key).length
        return point(monthLabel(key), count)
      })
      const modeSplit = (['IN_PERSON', 'ONLINE'] as const).map((mode) => point(mode === 'IN_PERSON' ? 'In person' : 'Online', sessions.filter((session) => session.mode === mode).length))
      const outcomes = (['COMPLETED', 'CANCELLED', 'NO_SHOW'] as const).map((status) =>
        point(status === 'NO_SHOW' ? 'No-show' : status[0] + status.slice(1).toLowerCase(), sessions.filter((session) => session.status === status).length),
      )
      const patients = visiblePatients(actor).filter((patient) => (own && actor.doctorId ? patient.assignedDoctorId === actor.doctorId : true))
      const newPatientsPerMonth = months.map((key) => point(monthLabel(key), patients.filter((patient) => monthKey(patient.createdAt) === key).length))
      const report = {
        scope: own ? 'own' as const : 'all' as const,
        sessionsPerMonth,
        modeSplit,
        outcomes,
        newPatientsPerMonth,
        suppressedNote: 'Groups with fewer than 5 records are shown as <5 so a chart cannot point to one person.',
      }
      if (!own && can(actor.activeRole, 'view_revenue', 'analytics', { adminCanViewClinicalNotes: true })) {
        const sessionsPerDoctor = getDb().doctors.map((doctor) =>
          point(doctor.fullName, sessions.filter((session) => session.doctorId === doctor.id).length),
        )
        const revenuePerMonth = months.map((key) => {
          const rows = getDb().payments.filter((payment) => payment.status === 'PAID' && monthKey(payment.recordedAt) === key)
          return point(monthLabel(key), rows.length, rows.reduce((sum, row) => sum + row.amount, 0), formatInr(rows.reduce((sum, row) => sum + row.amount, 0)))
        })
        const open = getDb().sessions.filter((session) => session.status === 'COMPLETED' && sessionBalance(session) > 0)
        const outstanding = point('Outstanding', open.length, open.reduce((sum, session) => sum + sessionBalance(session), 0), formatInr(open.reduce((sum, session) => sum + sessionBalance(session), 0)))
        const sourceSplit = (['INTERNAL', 'WEBSITE'] as const).map((source) =>
          point(source === 'INTERNAL' ? 'Clinic' : 'Website', sessions.filter((session) => session.source === source).length),
        )
        return { ...report, sessionsPerDoctor, revenuePerMonth, outstanding, sourceSplit }
      }
      return report
    },
  },
  audit: {
    async list(query) {
      await wait()
      allow('view', 'audit')
      return getDb()
        .audit.filter((event) => (query?.actorId ? event.actorId === query.actorId : true))
        .filter((event) => (query?.action ? event.action === query.action : true))
        .filter((event) => (query?.from ? ymd(new Date(event.at)) >= query.from : true))
        .filter((event) => (query?.to ? ymd(new Date(event.at)) <= query.to : true))
        .slice(0, 300)
    },
  },
  settings: {
    async get() {
      await wait(160)
      getActor()
      return structuredClone(getDb().settings)
    },
    async update(input) {
      await wait(380)
      allow('update', 'settings')
      const settings = getDb().settings
      const previous = settings.adminCanViewClinicalNotes
      if (input.clinicName) settings.clinicName = input.clinicName
      if (input.city) settings.city = input.city
      if (input.locations) settings.locations = input.locations
      if (input.sessionTypes) settings.sessionTypes = input.sessionTypes
      if (typeof input.websiteBookingsEnabled === 'boolean') settings.websiteBookingsEnabled = input.websiteBookingsEnabled
      if (typeof input.minimumNoticeHours === 'number') settings.minimumNoticeHours = input.minimumNoticeHours
      if (input.confirmMode) settings.confirmMode = input.confirmMode
      if (typeof input.adminCanViewClinicalNotes === 'boolean') settings.adminCanViewClinicalNotes = input.adminCanViewClinicalNotes
      record('UPDATE', 'Settings', TENANT_ID)
      if (typeof input.adminCanViewClinicalNotes === 'boolean' && input.adminCanViewClinicalNotes !== previous) {
        record('PERMISSION_CHANGE', 'Settings', 'clinical_notes', 'SUCCESS', input.adminCanViewClinicalNotes ? 'Admins can view clinical notes' : 'Admins cannot view clinical notes')
      }
      emitStore()
      return structuredClone(settings)
    },
    async updateDevFlags(input) {
      await wait(120)
      getActor()
      const settings = getDb().settings
      if (typeof input.idleTimeoutSeconds === 'number') settings.idleTimeoutSeconds = input.idleTimeoutSeconds
      if (typeof input.simulateMeetFailure === 'boolean') settings.simulateMeetFailure = input.simulateMeetFailure
      record('UPDATE', 'Settings', 'dev-flags', 'SUCCESS', 'Prototype display setting')
      emitStore()
      return structuredClone(settings)
    },
    async reconnect(doctorId) {
      await wait(700)
      allow('update', 'settings')
      const row = getDb().settings.googleConnections.find((item) => item.doctorId === doctorId)
      if (row) row.status = 'CONNECTED'
      else getDb().settings.googleConnections.push({ doctorId, status: 'CONNECTED' })
      record('UPDATE', 'GoogleConnection', doctorId, 'SUCCESS', 'Reconnect simulated')
      emitStore()
      return structuredClone(getDb().settings)
    },
  },
}

function recentMonths(count: number) {
  const keys: string[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getTime())
    date.setUTCDate(1)
    date.setUTCMonth(date.getUTCMonth() - i)
    keys.push(monthKey(date.toISOString()))
  }
  return keys
}

function insertDoctor(input: DoctorInput, existing?: DoctorProfile): DoctorProfile {
  const age = ageInYears(input.dateOfBirth)
  if (Number.isNaN(age) || age < 18) throw new ApiError('A doctor profile cannot be created for a minor.')
  const phone = phoneDigits(input.phone)
  if (!/^[6-9]\d{9}$/.test(phone)) throw new ApiError('Enter an Indian mobile number.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new ApiError('Enter the Google account email used for Calendar and Meet.')
  if (input.modes.length === 0) throw new ApiError('Choose at least one session mode.')
  if (input.defaultFee < 0) throw new ApiError('Fee cannot be negative.')
  const db = getDb()
  const emailTaken = db.users.some((user) => user.email.toLowerCase() === input.email.trim().toLowerCase() && user.id !== existing?.userId)
  if (emailTaken) throw new ApiError('That email is already used by a staff account.')
  const colors = ['#115e59', '#1e3a8a', '#5b21b6', '#9a3412', '#155e75', '#3f6212']
  const doctor: DoctorProfile = {
    id: existing?.id ?? uid('doc'),
    tenantId: TENANT_ID,
    userId: existing?.userId ?? uid('usr'),
    fullName: input.fullName.trim(),
    dateOfBirth: input.dateOfBirth,
    designation: input.designation,
    qualification: input.qualification.trim(),
    institution: input.institution.trim(),
    rciNumber: input.rciNumber?.trim() || undefined,
    rciStatus: input.rciStatus,
    rciExpiry: input.rciExpiry || undefined,
    otherRegistration: input.otherRegistration?.trim() || undefined,
    email: input.email.trim(),
    phone,
    modes: input.modes,
    defaultFee: input.defaultFee,
    defaultDuration: input.defaultDuration,
    bufferMinutes: input.bufferMinutes,
    active: input.active,
    alsoAdmin: input.alsoAdmin,
    color: existing?.color ?? colors[db.doctors.length % colors.length],
  }
  if (existing) {
    const index = db.doctors.findIndex((item) => item.id === existing.id)
    db.doctors[index] = doctor
  } else db.doctors.push(doctor)
  const roles: Role[] = input.alsoAdmin ? ['ADMIN', 'DOCTOR'] : ['DOCTOR']
  const user = db.users.find((item) => item.id === doctor.userId)
  if (user) {
    user.name = doctor.fullName
    user.email = doctor.email
    user.roles = roles
    user.doctorId = doctor.id
    user.active = input.active
  } else {
    db.users.push({
      id: doctor.userId,
      tenantId: TENANT_ID,
      name: doctor.fullName,
      email: doctor.email,
      roles,
      doctorId: doctor.id,
      active: input.active,
    })
  }
  if (!db.settings.googleConnections.some((item) => item.doctorId === doctor.id)) {
    db.settings.googleConnections.push({ doctorId: doctor.id, status: 'NOT_CONNECTED' })
  }
  return doctor
}

type SessionNotes = { process: { access: 'ok'; note: ProcessNote } | { access: 'empty' } | { access: 'denied' } | { access: 'locked' } }
