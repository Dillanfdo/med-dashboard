import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import type { CreateSessionInput, DoctorInput, PatientInput } from '@/api'
import { useAuth } from '@/lib/auth'
import type { AuditAction, ConsentKind, PaymentMethod, PaymentStatus, RightsStatus, RightsType, SessionMode, SessionStatus } from '@/types'

function useScope() {
  const { actor } = useAuth()
  return actor ? `${actor.userId}:${actor.activeRole}` : ''
}

export function useSettings() {
  const scope = useScope()
  return useQuery({ queryKey: ['settings', scope], queryFn: () => api.settings.get(), enabled: !!scope })
}

export function useNotifications() {
  const scope = useScope()
  return useQuery({ queryKey: ['notifications', scope], queryFn: () => api.notifications.list(), enabled: !!scope })
}

export function useDoctors() {
  const scope = useScope()
  return useQuery({ queryKey: ['doctors', scope], queryFn: () => api.doctors.list(), enabled: !!scope })
}

export function usePatients(filters?: { search?: string; doctorId?: string; minor?: 'yes' | 'no' | ''; status?: string }) {
  const scope = useScope()
  return useQuery({
    queryKey: ['patients', scope, filters?.search ?? '', filters?.doctorId ?? '', filters?.minor ?? '', filters?.status ?? ''],
    queryFn: () => api.patients.list({ ...filters, minor: filters?.minor || undefined, status: filters?.status || undefined, doctorId: filters?.doctorId || undefined }),
    enabled: !!scope,
  })
}

export function usePatient(id?: string) {
  const scope = useScope()
  return useQuery({ queryKey: ['patient', scope, id], queryFn: () => api.patients.get(id!), enabled: !!scope && !!id })
}

export function useGuardian(id?: string) {
  const scope = useScope()
  return useQuery({ queryKey: ['guardian', scope, id], queryFn: () => api.patients.guardian(id!), enabled: !!scope && !!id })
}

export function useConsents(id?: string) {
  const scope = useScope()
  return useQuery({ queryKey: ['consents', scope, id], queryFn: () => api.patients.consents(id!), enabled: !!scope && !!id })
}

export function useRights(id?: string) {
  const scope = useScope()
  return useQuery({ queryKey: ['rights', scope, id], queryFn: () => api.patients.rights(id!), enabled: !!scope && !!id })
}

export function useSessions(filters?: { status?: string; doctorId?: string; mode?: string; source?: string; from?: string; to?: string }) {
  const scope = useScope()
  return useQuery({
    queryKey: ['sessions', scope, filters?.status ?? '', filters?.doctorId ?? '', filters?.mode ?? '', filters?.source ?? '', filters?.from ?? '', filters?.to ?? ''],
    queryFn: () =>
      api.sessions.list({
        status: filters?.status || undefined,
        doctorId: filters?.doctorId || undefined,
        mode: filters?.mode || undefined,
        source: filters?.source || undefined,
        from: filters?.from || undefined,
        to: filters?.to || undefined,
      }),
    enabled: !!scope,
  })
}

export function useSession(id?: string | null) {
  const scope = useScope()
  return useQuery({ queryKey: ['session', scope, id], queryFn: () => api.sessions.get(id!), enabled: !!scope && !!id })
}

export function useTimeline(id?: string | null) {
  const scope = useScope()
  return useQuery({ queryKey: ['timeline', scope, id], queryFn: () => api.sessions.timeline(id!), enabled: !!scope && !!id })
}

export function useWebsiteDetail(id?: string | null, enabled = true) {
  const scope = useScope()
  return useQuery({
    queryKey: ['website', scope, id],
    queryFn: () => api.sessions.websiteDetail(id!),
    enabled: !!scope && !!id && enabled,
  })
}

export function useSlotCheck(input?: { doctorId: string; start: string; durationMinutes: number; mode?: SessionMode; excludeSessionId?: string }) {
  return useQuery({
    queryKey: ['slot', input?.doctorId, input?.start, input?.durationMinutes, input?.mode, input?.excludeSessionId],
    queryFn: () => api.sessions.checkSlot(input!),
    enabled: !!input?.doctorId && !!input.start && !!input.durationMinutes,
  })
}

export function useNotes(patientId?: string) {
  const scope = useScope()
  return useQuery({ queryKey: ['notes', scope, patientId], queryFn: () => api.notes.forPatient(patientId!), enabled: !!scope && !!patientId })
}

export function useAvailability(doctorId?: string) {
  const scope = useScope()
  return useQuery({ queryKey: ['availability', scope, doctorId], queryFn: () => api.availability.get(doctorId!), enabled: !!scope && !!doctorId })
}

export function usePayments(filters?: { doctorId?: string; status?: string; method?: string; from?: string; to?: string }, enabled = true) {
  const scope = useScope()
  return useQuery({
    queryKey: ['payments', scope, filters?.doctorId ?? '', filters?.status ?? '', filters?.method ?? '', filters?.from ?? '', filters?.to ?? ''],
    queryFn: () => api.payments.list(filters),
    enabled: !!scope && enabled,
  })
}

export function useSessionPayments(sessionId?: string | null, enabled = true) {
  const scope = useScope()
  return useQuery({
    queryKey: ['session-payments', scope, sessionId],
    queryFn: () => api.payments.forSession(sessionId!),
    enabled: !!scope && !!sessionId && enabled,
  })
}

export function usePaymentSummary(enabled = true) {
  const scope = useScope()
  return useQuery({ queryKey: ['payment-summary', scope], queryFn: () => api.payments.summary(), enabled: !!scope && enabled })
}

export function useAnalytics() {
  const scope = useScope()
  return useQuery({ queryKey: ['analytics', scope], queryFn: () => api.analytics.get(), enabled: !!scope })
}

export function useAudit(filters?: { actorId?: string; action?: AuditAction | ''; from?: string; to?: string }, enabled = true) {
  const scope = useScope()
  return useQuery({
    queryKey: ['audit', scope, filters?.actorId ?? '', filters?.action ?? '', filters?.from ?? '', filters?.to ?? ''],
    queryFn: () => api.audit.list(filters),
    enabled: !!scope && enabled,
  })
}

export function useUpcomingDoctor(id?: string | null) {
  const scope = useScope()
  return useQuery({ queryKey: ['upcoming', scope, id], queryFn: () => api.doctors.upcoming(id!), enabled: !!scope && !!id })
}

export function useSignIn() {
  return useMutation({ mutationFn: (input: { email: string; password: string }) => api.auth.signIn(input.email, input.password) })
}

export function useVerifyMfa() {
  return useMutation({ mutationFn: (input: { userId: string; code: string }) => api.auth.verifyMfa(input.userId, input.code) })
}

export function useDevSignIn() {
  return useMutation({ mutationFn: (userId: string) => api.auth.devSignIn(userId) })
}

export function useRefreshActor() {
  return useMutation({ mutationFn: () => api.auth.refresh() })
}

export function useCreateSession() {
  return useMutation({ mutationFn: (input: CreateSessionInput) => api.sessions.create(input) })
}

export function useReschedule() {
  return useMutation({ mutationFn: (input: { id: string; start: string; durationMinutes: number; reason: string }) => api.sessions.reschedule(input.id, input) })
}

export function useCancelSession() {
  return useMutation({ mutationFn: (input: { id: string; reason: string; cancelledBy: 'CLINIC' | 'PATIENT' }) => api.sessions.cancel(input.id, input) })
}

export function useSetSessionStatus() {
  return useMutation({ mutationFn: (input: { id: string; status: Extract<SessionStatus, 'COMPLETED' | 'NO_SHOW'> }) => api.sessions.setStatus(input.id, input.status) })
}

export function useRetryMeet() {
  return useMutation({ mutationFn: (id: string) => api.sessions.retryMeet(id) })
}

export function useConfirmWebsite() {
  return useMutation({
    mutationFn: (input: { id: string; patientId?: string; doctorId?: string; patient?: PatientInput }) =>
      api.sessions.confirmWebsite(input.id, input),
  })
}

export function useProposeWebsite() {
  return useMutation({
    mutationFn: (input: { id: string; start: string; durationMinutes: number; reason: string }) => api.sessions.proposeWebsite(input.id, input),
  })
}

export function useDeclineWebsite() {
  return useMutation({ mutationFn: (input: { id: string; reason: string }) => api.sessions.declineWebsite(input.id, input) })
}

export function useSimulateWebsite() {
  return useMutation({ mutationFn: () => api.sessions.simulateWebsite() })
}

export function useSavePatient() {
  return useMutation({
    mutationFn: (input: { id?: string; values: PatientInput }) => (input.id ? api.patients.update(input.id, input.values) : api.patients.create(input.values)),
  })
}

export function useSetConsent() {
  return useMutation({ mutationFn: (input: { id: string; kind: ConsentKind; granted: boolean }) => api.patients.setConsent(input.id, input.kind, input.granted) })
}

export function useExportPatient() {
  return useMutation({ mutationFn: (input: { id: string; reason: string }) => api.patients.exportRecord(input.id, input.reason) })
}

export function useAddRights() {
  return useMutation({ mutationFn: (input: { id: string; type: RightsType; dueDate: string; detail: string }) => api.patients.addRights(input.id, input) })
}

export function useUpdateRights() {
  return useMutation({ mutationFn: (input: { id: string; requestId: string; status: RightsStatus }) => api.patients.updateRights(input.id, input.requestId, input.status) })
}

export function useSaveClinical() {
  return useMutation({
    mutationFn: (input: { sessionId: string; assessment: string; observations: string; plan: string; nextSteps: string }) =>
      api.notes.saveClinical(input.sessionId, input),
  })
}

export function useSaveProcess() {
  return useMutation({ mutationFn: (input: { sessionId: string; body: string }) => api.notes.saveProcess(input.sessionId, input) })
}

export function useBreakGlass() {
  return useMutation({ mutationFn: (input: { sessionId: string; reason: string }) => api.notes.breakGlass(input.sessionId, input.reason) })
}

export function useRecordNoteView() {
  return useMutation({
    mutationFn: (input: { sessionId: string; kind: 'clinical' | 'process'; outcome: 'SUCCESS' | 'DENIED' }) =>
      api.notes.recordView(input.sessionId, input.kind, input.outcome),
  })
}

export function useSaveDoctor() {
  return useMutation({ mutationFn: (input: { id?: string; values: DoctorInput }) => (input.id ? api.doctors.update(input.id, input.values) : api.doctors.create(input.values)) })
}

export function useDeactivateDoctor() {
  return useMutation({ mutationFn: (input: { id: string; assignments: { sessionId: string; doctorId: string }[] }) => api.doctors.deactivate(input.id, input.assignments) })
}

export function useSaveAvailability() {
  return useMutation({
    mutationFn: (input: { doctorId: string; bufferMinutes: number; defaultDuration: number; rules: { dayOfWeek: number; startTime: string; endTime: string; modes: SessionMode[] }[]; blocked: { date: string; reason: string }[] }) =>
      api.availability.save(input.doctorId, input),
  })
}

export function useRecordPayment() {
  return useMutation({
    mutationFn: (input: { sessionId: string; amount: number; method: PaymentMethod; status: PaymentStatus; reference?: string; note?: string }) =>
      api.payments.record(input),
  })
}

export function useRefundPayment() {
  return useMutation({ mutationFn: (input: { id: string; reason: string }) => api.payments.refund(input.id, input.reason) })
}

export function useExportPayments() {
  return useMutation({ mutationFn: (reason: string) => api.payments.exportCsv(reason) })
}

export function useUpdateSettings() {
  return useMutation({ mutationFn: (input: Parameters<typeof api.settings.update>[0]) => api.settings.update(input) })
}

export function useDevFlags() {
  return useMutation({ mutationFn: (input: { idleTimeoutSeconds?: number; simulateMeetFailure?: boolean }) => api.settings.updateDevFlags(input) })
}

export function useReconnectGoogle() {
  return useMutation({ mutationFn: (doctorId: string) => api.settings.reconnect(doctorId) })
}

export function useResetDemo() {
  return useMutation({ mutationFn: () => api.dev.reset() })
}
