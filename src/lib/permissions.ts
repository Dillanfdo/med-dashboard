import { createContext, createElement, useContext, type ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import type { Role } from '@/types'

/**
 * Permission matrix for the staff app.
 * Add a role by extending `Role` and adding one entry to `MATRIX`.
 * Screen and route checks should call `usePermission` — not ad-hoc role tests.
 */
export type Resource =
  | 'dashboard'
  | 'calendar'
  | 'sessions'
  | 'patients'
  | 'doctors'
  | 'payments'
  | 'analytics'
  | 'audit'
  | 'settings'
  | 'availability'
  | 'clinical_notes'
  | 'process_notes'
  | 'website_bookings'

export type Action =
  | 'view'
  | 'view_all'
  | 'view_own'
  | 'create'
  | 'update'
  | 'cancel'
  | 'reschedule'
  | 'export'
  | 'break_glass'
  | 'view_revenue'
  | 'deactivate'
  | 'record'

type Grant = { resource: Resource; actions: Action[] }

export const MATRIX: Record<Role, Grant[]> = {
  ADMIN: [
    { resource: 'dashboard', actions: ['view'] },
    { resource: 'calendar', actions: ['view_all'] },
    { resource: 'sessions', actions: ['view_all', 'create', 'update', 'cancel', 'reschedule'] },
    { resource: 'patients', actions: ['view_all', 'create', 'update', 'export'] },
    { resource: 'doctors', actions: ['view_all', 'create', 'update', 'deactivate'] },
    { resource: 'payments', actions: ['view', 'record', 'export'] },
    { resource: 'analytics', actions: ['view', 'view_revenue'] },
    { resource: 'audit', actions: ['view'] },
    { resource: 'settings', actions: ['view', 'update'] },
    { resource: 'availability', actions: ['view_all', 'update'] },
    { resource: 'clinical_notes', actions: ['view_all', 'create', 'update'] },
    { resource: 'process_notes', actions: ['break_glass'] },
    { resource: 'website_bookings', actions: ['view', 'update'] },
  ],
  DOCTOR: [
    { resource: 'dashboard', actions: ['view'] },
    { resource: 'calendar', actions: ['view_own'] },
    { resource: 'sessions', actions: ['view_own', 'create', 'update', 'cancel', 'reschedule'] },
    { resource: 'patients', actions: ['view_own', 'create', 'update'] },
    { resource: 'doctors', actions: ['view_own'] },
    { resource: 'availability', actions: ['view_own', 'update'] },
    { resource: 'clinical_notes', actions: ['view_own', 'create', 'update'] },
    { resource: 'process_notes', actions: ['view_own', 'create', 'update'] },
    { resource: 'analytics', actions: ['view'] },
    { resource: 'website_bookings', actions: ['view', 'update'] },
  ],
}

const ClinicalFlagContext = createContext(true)

export function ClinicalNotesFlagProvider({
  value,
  children,
}: {
  value: boolean
  children: ReactNode
}) {
  return createElement(ClinicalFlagContext.Provider, { value }, children)
}

export function can(
  role: Role,
  action: Action,
  resource: Resource,
  opts?: { adminCanViewClinicalNotes?: boolean },
): boolean {
  if (resource === 'clinical_notes' && role === 'ADMIN' && (action === 'view_all' || action === 'view')) {
    if (opts?.adminCanViewClinicalNotes === false && action === 'view_all') return false
  }
  return MATRIX[role].some((grant) => grant.resource === resource && grant.actions.includes(action))
}

export function usePermission(action: Action, resource: Resource): boolean {
  return useCan()(action, resource)
}

export function useCan() {
  const { actor } = useAuth()
  const adminCanViewClinicalNotes = useContext(ClinicalFlagContext)
  return (action: Action, resource: Resource) => {
    if (!actor) return false
    return can(actor.activeRole, action, resource, { adminCanViewClinicalNotes })
  }
}
