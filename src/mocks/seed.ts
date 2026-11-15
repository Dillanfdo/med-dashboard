import { addDaysYmd, addMinutes, isoFromLocal, ymd } from '@/lib/format'
import type {
  AuditEvent,
  AvailabilityRule,
  ClinicalNote,
  Consent,
  Database,
  DoctorProfile,
  Patient,
  ProcessNote,
  Session,
  SessionStatus,
  User,
} from '@/types'
import { TENANT_ID } from '@/types'

const DOCTORS: Omit<DoctorProfile, 'tenantId'>[] = [
  {
    id: 'doc_ananya',
    userId: 'usr_ananya',
    fullName: 'Ananya Rao',
    dateOfBirth: '1984-02-02',
    designation: 'Clinical Psychologist',
    qualification: 'M.Phil, Clinical Psychology',
    institution: 'Sample Institute of Psychology, Bengaluru',
    rciNumber: 'A000011',
    rciStatus: 'REGISTERED',
    rciExpiry: '2028-01-15',
    otherRegistration: 'Sample counselling association, expires 2027',
    email: 'ananya.rao@example.com',
    phone: '9000001001',
    modes: ['IN_PERSON', 'ONLINE'],
    defaultFee: 2000,
    defaultDuration: 50,
    bufferMinutes: 10,
    active: true,
    alsoAdmin: true,
    color: '#115e59',
  },
  {
    id: 'doc_kabir',
    userId: 'usr_kabir',
    fullName: 'Kabir Mehta',
    dateOfBirth: '1990-06-15',
    designation: 'Counsellor',
    qualification: 'M.A. Counselling',
    institution: 'Sample College of Social Sciences, Pune',
    rciNumber: 'A000022',
    rciStatus: 'REGISTERED',
    rciExpiry: '2027-08-01',
    email: 'kabir.mehta@example.com',
    phone: '9000001002',
    modes: ['IN_PERSON', 'ONLINE'],
    defaultFee: 1500,
    defaultDuration: 50,
    bufferMinutes: 10,
    active: true,
    alsoAdmin: false,
    color: '#1e3a8a',
  },
  {
    id: 'doc_leela',
    userId: 'usr_leela',
    fullName: 'Leela Nair',
    dateOfBirth: '1979-09-09',
    designation: 'Psychiatrist',
    qualification: 'M.D. Psychiatry',
    institution: 'Sample Medical College, Kochi',
    rciStatus: 'NOT_APPLICABLE',
    otherRegistration: 'Sample medical council, expires 20 Dec 2026',
    rciExpiry: '2026-12-20',
    email: 'leela.nair@example.com',
    phone: '9000001003',
    modes: ['IN_PERSON', 'ONLINE'],
    defaultFee: 2500,
    defaultDuration: 50,
    bufferMinutes: 10,
    active: true,
    alsoAdmin: false,
    color: '#5b21b6',
  },
  {
    id: 'doc_rohan',
    userId: 'usr_rohan',
    fullName: 'Rohan Desai',
    dateOfBirth: '1988-12-12',
    designation: 'Clinical Psychologist',
    qualification: 'M.Phil, Clinical Psychology',
    institution: 'Sample University Department of Psychology, Ahmedabad',
    rciNumber: 'A000044',
    rciStatus: 'EXPIRED',
    rciExpiry: '2026-10-01',
    email: 'rohan.desai@example.com',
    phone: '9000001004',
    modes: ['ONLINE'],
    defaultFee: 1800,
    defaultDuration: 50,
    bufferMinutes: 15,
    active: true,
    alsoAdmin: false,
    color: '#9a3412',
  },
]

const USERS: Omit<User, 'tenantId'>[] = [
  { id: 'usr_ananya', name: 'Ananya Rao', email: 'ananya.rao@example.com', roles: ['ADMIN', 'DOCTOR'], doctorId: 'doc_ananya', active: true },
  { id: 'usr_kabir', name: 'Kabir Mehta', email: 'kabir.mehta@example.com', roles: ['DOCTOR'], doctorId: 'doc_kabir', active: true },
  { id: 'usr_leela', name: 'Leela Nair', email: 'leela.nair@example.com', roles: ['DOCTOR'], doctorId: 'doc_leela', active: true },
  { id: 'usr_rohan', name: 'Rohan Desai', email: 'rohan.desai@example.com', roles: ['DOCTOR'], doctorId: 'doc_rohan', active: true },
  { id: 'usr_sana', name: 'Sana Kapoor', email: 'sana.kapoor@example.com', roles: ['ADMIN'], active: true },
]

interface PersonSeed {
  name: string
  dob: string
  doctorId: string
  phone: string
  email: string
  gender?: Patient['gender']
  closed?: boolean
  minor?: { name: string; relationship: string; phone: string; email: string }
}

const PEOPLE: PersonSeed[] = [
  { name: 'Asha Menon', dob: '1992-03-14', doctorId: 'doc_ananya', phone: '9000000001', email: 'asha.menon@example.com', gender: 'Female' },
  { name: 'Vikram Sethi', dob: '1988-07-02', doctorId: 'doc_ananya', phone: '9000000002', email: 'vikram.sethi@example.com', gender: 'Male' },
  { name: 'Riya Sample', dob: '1996-11-23', doctorId: 'doc_kabir', phone: '9000000007', email: 'riya.sample@example.com', gender: 'Female' },
  { name: 'Ishaan Kapoor', dob: '2012-04-12', doctorId: 'doc_ananya', phone: '9000000004', email: 'ishaan.kapoor@example.com', gender: 'Male', minor: { name: 'Neelam Kapoor', relationship: 'Mother', phone: '9000000201', email: 'neelam.kapoor@example.com' } },
  { name: 'Myra Banerjee', dob: '2010-09-01', doctorId: 'doc_kabir', phone: '9000000005', email: 'myra.banerjee@example.com', gender: 'Female', minor: { name: 'Partha Banerjee', relationship: 'Father', phone: '9000000202', email: 'partha.banerjee@example.com' } },
  { name: 'Dev Joshi', dob: '2015-01-20', doctorId: 'doc_leela', phone: '9000000006', email: 'dev.joshi@example.com', gender: 'Male', minor: { name: 'Renu Joshi', relationship: 'Mother', phone: '9000000203', email: 'renu.joshi@example.com' } },
  { name: 'Sara Qureshi', dob: '2009-06-06', doctorId: 'doc_rohan', phone: '9000000008', email: 'sara.qureshi@example.com', gender: 'Female', minor: { name: 'Imran Qureshi', relationship: 'Father', phone: '9000000204', email: 'imran.qureshi@example.com' } },
  { name: 'Aarav Jain', dob: '2017-11-02', doctorId: 'doc_ananya', phone: '9000000009', email: 'aarav.jain@example.com', gender: 'Male', minor: { name: 'Pooja Jain', relationship: 'Mother', phone: '9000000205', email: 'pooja.jain@example.com' } },
  { name: 'Neha Kulkarni', dob: '1985-12-09', doctorId: 'doc_kabir', phone: '9000000010', email: 'neha.kulkarni@example.com', gender: 'Female' },
  { name: 'Arjun Malhotra', dob: '1990-05-18', doctorId: 'doc_leela', phone: '9000000011', email: 'arjun.malhotra@example.com', gender: 'Male' },
  { name: 'Pooja Iyer', dob: '1994-08-30', doctorId: 'doc_rohan', phone: '9000000012', email: 'pooja.iyer@example.com', gender: 'Female' },
  { name: 'Sameer Bedi', dob: '1982-02-11', doctorId: 'doc_ananya', phone: '9000000013', email: 'sameer.bedi@example.com', gender: 'Male' },
  { name: 'Tanvi Shah', dob: '1998-01-25', doctorId: 'doc_kabir', phone: '9000000014', email: 'tanvi.shah@example.com', gender: 'Female' },
  { name: 'Rahul Ghosh', dob: '1979-10-04', doctorId: 'doc_leela', phone: '9000000015', email: 'rahul.ghosh@example.com', gender: 'Male' },
  { name: 'Diya Nambiar', dob: '2001-04-17', doctorId: 'doc_rohan', phone: '9000000016', email: 'diya.nambiar@example.com' },
  { name: 'Kunal Oberoi', dob: '1987-06-21', doctorId: 'doc_ananya', phone: '9000000017', email: 'kunal.oberoi@example.com', gender: 'Male', closed: true },
  { name: 'Fatima Sheikh', dob: '1993-09-12', doctorId: 'doc_kabir', phone: '9000000018', email: 'fatima.sheikh@example.com', gender: 'Female' },
  { name: 'Harish Rao', dob: '1975-03-03', doctorId: 'doc_leela', phone: '9000000019', email: '', gender: 'Male' },
  { name: 'Sneha Pillai', dob: '1991-12-28', doctorId: 'doc_rohan', phone: '9000000020', email: 'sneha.pillai@example.com', gender: 'Female' },
  { name: 'Manav Chopra', dob: '1986-08-08', doctorId: 'doc_ananya', phone: '9000000021', email: 'manav.chopra@example.com', gender: 'Male' },
  { name: 'Lakshmi Reddy', dob: '1984-05-05', doctorId: 'doc_kabir', phone: '9000000022', email: 'lakshmi.reddy@example.com', gender: 'Female' },
  { name: 'Omar Farooq', dob: '1997-07-19', doctorId: 'doc_leela', phone: '9000000023', email: 'omar.farooq@example.com', gender: 'Male' },
  { name: 'Geeta Bhatt', dob: '1978-11-11', doctorId: 'doc_rohan', phone: '9000000024', email: 'geeta.bhatt@example.com', gender: 'Female' },
  { name: 'Nikhil Das', dob: '1995-02-02', doctorId: 'doc_ananya', phone: '9000000025', email: 'nikhil.das@example.com' },
]

const CLINICAL = [
  'Session discussed coping strategies; plan to continue weekly.',
  'Reviewed a simple breathing practice. Plan: continue fortnightly.',
  'Check-in on daily routine. Next step: keep a short practice log.',
]

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function createdAtFor(index: number, today: string) {
  if (index < 2) return isoFromLocal(addDaysYmd(today, -100), '11:00')
  if (index < 9) return isoFromLocal(addDaysYmd(today, -70), '11:00')
  if (index < 17) return isoFromLocal(addDaysYmd(today, -40), '11:00')
  return isoFromLocal(addDaysYmd(today, -12), '11:00')
}

function meetLink(rng: () => number) {
  const alpha = 'abcdefghijkmnopqrstuvwxyz'
  const chunk = (n: number) => Array.from({ length: n }, () => alpha[Math.floor(rng() * alpha.length)]).join('')
  return `https://meet.google.com/${chunk(3)}-${chunk(4)}-${chunk(3)}`
}

export function createSeed(): Database {
  const rng = mulberry32(20261115)
  const today = ymd(new Date())
  const doctors: DoctorProfile[] = DOCTORS.map((doctor) => ({ ...doctor, tenantId: TENANT_ID }))
  const users: User[] = USERS.map((user) => ({ ...user, tenantId: TENANT_ID }))
  const doctorById = new Map(doctors.map((doctor) => [doctor.id, doctor]))

  const patients: Patient[] = PEOPLE.map((person, index) => ({
    id: `pat_${1001 + index}`,
    tenantId: TENANT_ID,
    fullName: person.name,
    dateOfBirth: person.dob,
    gender: person.gender,
    phone: person.phone,
    email: person.email,
    address:
      index % 3 === 0
        ? { line1: `${12 + index} Sample Lane`, city: 'Bengaluru', state: 'Karnataka', pin: '560001' }
        : undefined,
    emergencyContact: person.minor
      ? { name: person.minor.name, relationship: person.minor.relationship, phone: person.minor.phone }
      : { name: 'Family Contact', relationship: 'Spouse', phone: '9000000301' },
    assignedDoctorId: person.doctorId,
    preferredMode: (['IN_PERSON', 'ONLINE', 'EITHER'] as const)[index % 3],
    referralSource: (['Website', 'Self', 'Doctor referral', 'School', 'Other'] as const)[index % 5],
    status: person.closed ? 'CLOSED' : 'ACTIVE',
    createdAt: createdAtFor(index, today),
  }))

  const guardians = PEOPLE.flatMap((person, index) =>
    person.minor
      ? [
          {
            id: `grd_${1001 + index}`,
            tenantId: TENANT_ID,
            patientId: `pat_${1001 + index}`,
            name: person.minor.name,
            relationship: person.minor.relationship,
            phone: person.minor.phone,
            email: person.minor.email,
            consentObtained: true,
            verificationNote: 'Sample note: guardian signed the clinic consent form at reception.',
          },
        ]
      : [],
  )

  const consents: Consent[] = patients.flatMap((patient, index) => {
    const kinds = ['TREATMENT_RECORDS', 'CALENDAR_INVITES', 'GOOGLE_MEET', 'PROMOTIONAL'] as const
    return kinds.map((kind) => ({
      id: `con_${patient.id}_${kind}`,
      tenantId: TENANT_ID,
      patientId: patient.id,
      kind,
      granted: kind === 'PROMOTIONAL' ? index % 6 === 0 : true,
      updatedAt: patient.createdAt,
      updatedBy: 'usr_sana',
    }))
  })

  const availability: AvailabilityRule[] = []
  for (const doctor of doctors) {
    for (const day of [1, 2, 3, 4, 5, 6]) {
      const morning = (day === 6 ? ['IN_PERSON'] : ['IN_PERSON', 'ONLINE']).filter((mode) =>
        doctor.modes.includes(mode as 'IN_PERSON' | 'ONLINE'),
      )
      const afternoon = (['IN_PERSON', 'ONLINE'] as const).filter((mode) => doctor.modes.includes(mode))
      if (morning.length) {
        availability.push({
          id: `avl_${doctor.id}_${day}_am`,
          tenantId: TENANT_ID,
          doctorId: doctor.id,
          dayOfWeek: day,
          startTime: '10:00',
          endTime: '13:00',
          modes: morning as ('IN_PERSON' | 'ONLINE')[],
        })
      }
      if (afternoon.length) {
        availability.push({
          id: `avl_${doctor.id}_${day}_pm`,
          tenantId: TENANT_ID,
          doctorId: doctor.id,
          dayOfWeek: day,
          startTime: '15:00',
          endTime: '18:00',
          modes: [...afternoon],
        })
      }
    }
  }

  const patientsByDoctor = new Map<string, Patient[]>()
  for (const patient of patients) {
    const list = patientsByDoctor.get(patient.assignedDoctorId) ?? []
    list.push(patient)
    patientsByDoctor.set(patient.assignedDoctorId, list)
  }

  const candidates: { date: string; time: string; when: 'past' | 'today' | 'future' }[] = []
  for (let offset = -88; offset <= 20; offset += 1) {
    const date = addDaysYmd(today, offset)
    const istDay = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(
      new Date(`${date}T12:00:00+05:30`),
    )
    if (istDay === 'Sun') continue
    const when = offset < 0 ? 'past' : offset === 0 ? 'today' : 'future'
    for (const time of ['10:00', '11:00', '12:00', '15:00', '16:00', '17:00']) {
      candidates.push({ date, time, when })
    }
  }

  const pick = (when: 'past' | 'today' | 'future', count: number) => {
    const pool = candidates.filter((item) => item.when === when)
    const shuffled = pool
      .map((item) => ({ item, n: rng() }))
      .sort((a, b) => a.n - b.n)
      .map((item) => item.item)
    return shuffled.slice(0, count)
  }

  const chosen = [...pick('past', 40), ...pick('today', 4), ...pick('future', 16)]
  const sessions: Session[] = []
  const used = new Set<string>()
  let cursor = 0
  for (const slot of chosen) {
    const doctor = doctors[cursor % doctors.length]
    cursor += 1
    const key = `${doctor.id}|${slot.date}|${slot.time}`
    if (used.has(key)) continue
    used.add(key)
    const list = patientsByDoctor.get(doctor.id) ?? []
    const patient = list[Math.floor(rng() * list.length)]
    const start = isoFromLocal(slot.date, slot.time)
    const end = addMinutes(start, doctor.defaultDuration)
    const past = new Date(start).getTime() < Date.now() - 60 * 60 * 1000
    sessions.push({
      id: `ses_${3001 + sessions.length}`,
      tenantId: TENANT_ID,
      patientId: patient.id,
      doctorId: doctor.id,
      start,
      end,
      durationMinutes: doctor.defaultDuration,
      mode: rng() > 0.45 ? 'ONLINE' : 'IN_PERSON',
      locationId: 'loc_koramangala',
      fee: doctor.defaultFee,
      schedulingNotes: rng() > 0.8 ? 'Ground-floor room if available.' : undefined,
      status: past ? 'COMPLETED' : 'CONFIRMED',
      source: 'INTERNAL',
      meetStatus: 'NONE',
      inviteStatus: 'SENT',
      previousTimes: [],
      createdAt: addMinutes(start, -60 * 24 * 3),
      createdBy: 'usr_sana',
    })
  }

  const past = sessions.filter((session) => new Date(session.start).getTime() < Date.now() - 60 * 60 * 1000)
  const upcoming = sessions.filter((session) => new Date(session.start).getTime() >= Date.now() - 60 * 60 * 1000)
  past.forEach((session, index) => {
    if (index < 3) session.status = 'NO_SHOW'
    else if (index < 9) session.status = 'CANCELLED'
    else session.status = 'COMPLETED'
    if (session.status === 'CANCELLED') {
      session.cancelReason = 'Patient requested'
      session.cancelledBy = 'PATIENT'
      session.inviteStatus = 'CANCELLED'
    }
  })
  upcoming.forEach((session, index) => {
    if (index < 3) {
      session.status = 'RESCHEDULED'
      session.previousTimes.push({
        start: addMinutes(session.start, -60 * 24),
        end: addMinutes(session.end, -60 * 24),
        reason: 'Clinic asked to move the time',
        changedAt: addMinutes(session.start, -60 * 48),
        changedBy: 'Sana Kapoor',
      })
      session.inviteStatus = 'UPDATED'
    } else if (index < 5) {
      session.status = 'CANCELLED'
      session.cancelReason = 'Doctor unavailable'
      session.cancelledBy = 'CLINIC'
      session.inviteStatus = 'CANCELLED'
    } else if (index < 7) {
      session.status = 'REQUESTED'
      session.inviteStatus = 'NOT_SENT'
      session.source = 'INTERNAL'
    } else {
      session.status = 'CONFIRMED'
    }
  })

  for (const session of sessions) {
    if (session.mode === 'IN_PERSON') session.locationId = rng() > 0.5 ? 'loc_koramangala' : 'loc_indiranagar'
    else session.locationId = undefined
    if (session.mode === 'ONLINE' && session.status !== 'CANCELLED' && session.status !== 'REQUESTED' && session.status !== 'NO_SHOW') {
      session.meetStatus = 'READY'
      session.meetLink = meetLink(rng)
    }
    if (session.mode === 'ONLINE' && (session.status === 'CANCELLED' || session.status === 'NO_SHOW')) {
      session.meetStatus = 'READY'
      session.meetLink = meetLink(rng)
    }
  }

  const websiteSeeds = [
    { name: 'Riya Sample', phone: '9000000007', email: 'riya.sample@example.com', doctorId: 'doc_kabir', mode: 'ONLINE' as const, offset: 1, time: '11:00', meet: true },
    { name: 'Website Guest A', phone: '9000000091', email: 'guest.a@example.com', doctorId: 'doc_ananya', mode: 'IN_PERSON' as const, offset: 2, time: '15:00', meet: false },
    { name: 'Website Guest B', phone: '9000000092', email: 'guest.b@example.com', doctorId: null, mode: 'ONLINE' as const, offset: 3, time: '16:00', meet: true },
    { name: 'Website Guest C', phone: '9000000093', email: 'guest.c@example.com', doctorId: 'doc_leela', mode: 'ONLINE' as const, offset: 4, time: '10:00', meet: false },
    { name: 'Website Guest D', phone: '9000000094', email: 'guest.d@example.com', doctorId: 'doc_rohan', mode: 'IN_PERSON' as const, offset: 5, time: '12:00', meet: false },
  ]

  const websiteRequests = websiteSeeds.map((item, index) => {
    let date = addDaysYmd(today, item.offset)
    const istDay = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(
      new Date(`${date}T12:00:00+05:30`),
    )
    if (istDay === 'Sun') date = addDaysYmd(date, 1)
    const start = isoFromLocal(date, item.time)
    const doctor = item.doctorId ? doctorById.get(item.doctorId) : undefined
    const session: Session = {
      id: `ses_${3101 + index}`,
      tenantId: TENANT_ID,
      patientId: null,
      doctorId: item.doctorId,
      start,
      end: addMinutes(start, 50),
      durationMinutes: 50,
      mode: item.mode,
      locationId: item.mode === 'IN_PERSON' ? 'loc_koramangala' : undefined,
      fee: doctor?.defaultFee ?? 0,
      status: 'REQUESTED',
      source: 'WEBSITE',
      meetStatus: 'NONE',
      inviteStatus: 'NOT_SENT',
      previousTimes: [],
      requester: { name: item.name, phone: item.phone, email: item.email },
      createdAt: new Date().toISOString(),
      createdBy: 'website',
    }
    sessions.push(session)
    return {
      id: `wbr_${5001 + index}`,
      tenantId: TENANT_ID,
      sessionId: session.id,
      token: `tok_sample_${5001 + index}`,
      requesterName: item.name,
      phone: item.phone,
      email: item.email,
      consentFlags: { records: true, calendar: true, meet: item.meet, promo: index === 4 },
      createdAt: session.createdAt,
    }
  })

  const statusEvents = sessions.flatMap((session) => {
    const doctor = session.doctorId ? doctorById.get(session.doctorId) : undefined
    const actorName = session.source === 'WEBSITE' ? 'Website' : 'Sana Kapoor'
    const actorId = session.source === 'WEBSITE' ? 'website' : 'usr_sana'
    const events = [
      {
        id: `evt_${session.id}_1`,
        tenantId: TENANT_ID,
        sessionId: session.id,
        status: (session.source === 'WEBSITE' ? 'REQUESTED' : 'CONFIRMED') as SessionStatus,
        at: session.createdAt,
        actorId,
        actorName,
        note: session.source === 'WEBSITE' ? 'Received from the public website' : 'Booked by the clinic',
      },
    ]
    if (session.status !== events[0].status) {
      events.push({
        id: `evt_${session.id}_2`,
        tenantId: TENANT_ID,
        sessionId: session.id,
        status: session.status,
        at: session.start,
        actorId: doctor?.userId ?? 'usr_sana',
        actorName: doctor?.fullName ?? 'Sana Kapoor',
        note: session.cancelReason ?? 'Status updated',
      })
    }
    return events
  })

  const payments = past
    .filter((session) => session.status === 'COMPLETED' && session.patientId)
    .flatMap((session, index) => {
      const kind = index % 10
      if (kind === 6 || kind === 7) return []
      const status = kind === 8 ? 'PARTIALLY_PAID' : kind === 9 ? (index % 20 === 9 ? 'REFUNDED' : 'WAIVED') : 'PAID'
      const method = (['UPI', 'CASH', 'BANK_TRANSFER', 'CARD', 'OTHER'] as const)[index % 5]
      const amount = status === 'PARTIALLY_PAID' ? Math.round(session.fee / 2) : status === 'WAIVED' ? 0 : session.fee
      return [
        {
          id: `pay_${4001 + index}`,
          tenantId: TENANT_ID,
          patientId: session.patientId as string,
          sessionId: session.id,
          amount,
          method,
          status: status as 'PAID' | 'PARTIALLY_PAID' | 'REFUNDED' | 'WAIVED',
          reference: method === 'CASH' ? undefined : `UTR SAMPLE ${4001 + index}`,
          receiptNumber: status === 'PAID' || status === 'REFUNDED' ? `RCP-2026-${4001 + index}` : undefined,
          recordedBy: 'usr_sana',
          recordedByName: 'Sana Kapoor',
          recordedAt: session.end,
          note: status === 'WAIVED' ? 'Sample waiver' : undefined,
        },
      ]
    })

  const completed = past.filter((session) => session.status === 'COMPLETED' && session.patientId)
  const clinicalNotes: ClinicalNote[] = completed.slice(0, 16).map((session, index) => {
    const doctor = doctorById.get(session.doctorId as string)!
    const text = CLINICAL[index % CLINICAL.length]
    const note: ClinicalNote = {
      id: `cnote_${6001 + index}`,
      tenantId: TENANT_ID,
      sessionId: session.id,
      patientId: session.patientId as string,
      authorId: doctor.userId,
      authorName: doctor.fullName,
      assessment: text,
      observations: 'Observations kept generic for this prototype.',
      plan: 'Continue the current rhythm of sessions.',
      nextSteps: 'Review the practice log next time.',
      versions: [],
      updatedAt: session.end,
    }
    note.versions = [
      {
        at: session.end,
        authorId: doctor.userId,
        authorName: doctor.fullName,
        body: text,
      },
    ]
    if (index === 0) {
      note.versions.unshift({
        at: addMinutes(session.end, -30),
        authorId: doctor.userId,
        authorName: doctor.fullName,
        body: 'Earlier sample wording, kept for the author only.',
      })
    }
    return note
  })

  const processNotes: ProcessNote[] = completed.slice(0, 7).map((session, index) => {
    const doctor = doctorById.get(session.doctorId as string)!
    return {
      id: `pnote_${7001 + index}`,
      tenantId: TENANT_ID,
      sessionId: session.id,
      patientId: session.patientId as string,
      authorId: doctor.userId,
      authorName: doctor.fullName,
      body: 'Private working note for the author. Sample prompt list for the next conversation. Not for the shared record.',
      versions: [
        {
          at: session.end,
          authorId: doctor.userId,
          authorName: doctor.fullName,
          body: 'Private working note for the author. Sample prompt list for the next conversation. Not for the shared record.',
        },
      ],
      updatedAt: session.end,
    }
  })

  const rightsRequests = [
    {
      id: 'rgt_1001',
      tenantId: TENANT_ID,
      patientId: 'pat_1001',
      type: 'ACCESS' as const,
      status: 'OPEN' as const,
      dueDate: addDaysYmd(today, 14),
      detail: 'Sample request: copy of records held by the clinic.',
      createdAt: isoFromLocal(addDaysYmd(today, -2), '12:00'),
      createdBy: 'usr_sana',
    },
    {
      id: 'rgt_1002',
      tenantId: TENANT_ID,
      patientId: 'pat_1002',
      type: 'GRIEVANCE' as const,
      status: 'IN_REVIEW' as const,
      dueDate: addDaysYmd(today, 7),
      detail: 'Sample grievance about appointment timing. No clinical content.',
      createdAt: isoFromLocal(addDaysYmd(today, -6), '12:00'),
      createdBy: 'usr_ananya',
    },
  ]

  const audit: AuditEvent[] = []
  const actors = users
  const actions = ['VIEW', 'CREATE', 'UPDATE', 'LOGIN', 'EXPORT'] as const
  for (let i = 0; i < 100; i += 1) {
    const actor = actors[i % actors.length]
    const action = actions[i % actions.length]
    const patient = patients[i % patients.length]
    audit.push({
      id: `aud_seed_${1000 + i}`,
      tenantId: TENANT_ID,
      at: isoFromLocal(addDaysYmd(today, -((i % 50) + 1)), i % 2 === 0 ? '09:30' : '16:10'),
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.roles[0],
      action,
      resourceType: action === 'LOGIN' ? 'SessionAuth' : i % 3 === 0 ? 'Patient' : 'Session',
      resourceId: action === 'LOGIN' ? actor.id : patient.id,
      outcome: 'SUCCESS',
      reason: action === 'EXPORT' ? 'Sample monthly file' : undefined,
    })
  }
  if (processNotes[0]) {
    audit.unshift({
      id: 'aud_seed_bg',
      tenantId: TENANT_ID,
      at: isoFromLocal(addDaysYmd(today, -3), '15:00'),
      actorId: 'usr_sana',
      actorName: 'Sana Kapoor',
      actorRole: 'ADMIN',
      action: 'BREAK_GLASS',
      resourceType: 'ProcessNote',
      resourceId: processNotes[0].id,
      outcome: 'SUCCESS',
      reason: 'Sample break-glass entry so the audit log can be demonstrated.',
    })
  }
  audit.sort((a, b) => (a.at < b.at ? 1 : -1))

  const blockedDate = addDaysYmd(today, 2)
  const blockedDay = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(
    new Date(`${blockedDate}T12:00:00+05:30`),
  )

  return {
    tenant: { id: TENANT_ID, name: 'Northlight Counselling' },
    users,
    doctors,
    patients,
    guardians,
    consents,
    sessions,
    statusEvents,
    clinicalNotes,
    processNotes,
    payments,
    audit,
    availability,
    blockedDates: [
      {
        id: 'blk_1001',
        tenantId: TENANT_ID,
        doctorId: 'doc_kabir',
        date: blockedDay === 'Sun' ? addDaysYmd(blockedDate, 1) : blockedDate,
        reason: 'Leave',
      },
    ],
    rightsRequests,
    websiteRequests,
    settings: {
      tenantId: TENANT_ID,
      clinicName: 'Northlight Counselling',
      city: 'Bengaluru',
      locations: [
        { id: 'loc_koramangala', name: 'Koramangala consulting room', address: '12 Sample Lane, Koramangala, Bengaluru 560034' },
        { id: 'loc_indiranagar', name: 'Indiranagar consulting room', address: '48 Example Road, Indiranagar, Bengaluru 560038' },
      ],
      sessionTypes: [
        { id: 'sty_standard', name: 'Standard session', durationMinutes: 50 },
        { id: 'sty_extended', name: 'Extended session', durationMinutes: 80 },
      ],
      websiteBookingsEnabled: true,
      minimumNoticeHours: 12,
      confirmMode: 'MANUAL',
      adminCanViewClinicalNotes: true,
      idleTimeoutSeconds: 0,
      simulateMeetFailure: false,
      consentTexts: [
        {
          id: 'txt_records',
          title: 'Storing treatment records',
          version: 'v1.0 (sample)',
          body: 'Sample text: the clinic stores treatment records so clinicians can continue care. This is placeholder wording for the client review.',
        },
        {
          id: 'txt_calendar',
          title: 'Google Calendar invites',
          version: 'v1.0 (sample)',
          body: 'Sample text: appointment emails contain the time and a Meet link only. They do not contain clinical details.',
        },
        {
          id: 'txt_meet',
          title: 'Online sessions via Google Meet',
          version: 'v1.0 (sample)',
          body: 'Sample text: online sessions use Google Meet. The clinic does not record sessions.',
        },
        {
          id: 'txt_promo',
          title: 'Promotional communication',
          version: 'v1.0 (sample)',
          body: 'Sample text: optional news about workshops. This is off unless a person opts in.',
        },
      ],
      googleConnections: [
        { doctorId: 'doc_ananya', status: 'CONNECTED' },
        { doctorId: 'doc_kabir', status: 'CONNECTED' },
        { doctorId: 'doc_leela', status: 'CONNECTED' },
        { doctorId: 'doc_rohan', status: 'RECONNECT' },
      ],
    },
  }
}
