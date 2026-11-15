import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth'
import { can, usePermission, type Action, type Resource } from '@/lib/permissions'

export function RequireAccess({
  action,
  resource,
  also,
  children,
}: {
  action: Action
  resource: Resource
  also?: { action: Action; resource: Resource }
  children: ReactNode
}) {
  const primary = usePermission(action, resource)
  const secondary = usePermission(also?.action ?? action, also?.resource ?? resource)
  const allowed = primary || (also ? secondary : false)
  const { actor } = useAuth()
  if (allowed) return children
  const other = actor?.roles.find((role) => role !== actor.activeRole)
  const otherOk = other ? can(other, action, resource) || (also ? can(other, also.action, also.resource) : false) : false
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6">
      <h1 className="text-xl font-semibold">No access</h1>
      <p className="mt-2 text-sm text-stone-600">This page is hidden for the role you are acting as.</p>
      {otherOk && other ? <p className="mt-2 text-sm">Switch acting as {other === 'ADMIN' ? 'Admin' : 'Doctor'} to open it.</p> : null}
      <Link className="mt-4 inline-block text-sm text-teal-900 underline" to="/">
        Back to dashboard
      </Link>
    </div>
  )
}
