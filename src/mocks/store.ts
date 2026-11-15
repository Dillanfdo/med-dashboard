import { createSeed } from '@/mocks/seed'
import type { AuditEvent, Database } from '@/types'
import { TENANT_ID } from '@/types'

const FLAG = 'meddash.prototype.persist'
const DATA = 'meddash.prototype.db'

type Listener = () => void
const listeners = new Set<Listener>()

function readPersisted(): Database | null {
  try {
    if (localStorage.getItem(FLAG) !== '1') return null
    const raw = localStorage.getItem(DATA)
    if (!raw) return null
    return JSON.parse(raw) as Database
  } catch {
    return null
  }
}

let db: Database = readPersisted() ?? createSeed()

export function getDb(): Database {
  return db
}

export function subscribeStore(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function emitStore() {
  try {
    if (localStorage.getItem(FLAG) === '1') localStorage.setItem(DATA, JSON.stringify(db))
  } catch {
    /* ignore quota errors in the prototype */
  }
  listeners.forEach((listener) => listener())
}

export function persistEnabled() {
  try {
    return localStorage.getItem(FLAG) === '1'
  } catch {
    return false
  }
}

export function setPersistEnabled(on: boolean) {
  localStorage.setItem(FLAG, on ? '1' : '0')
  if (on) localStorage.setItem(DATA, JSON.stringify(db))
  else localStorage.removeItem(DATA)
}

export function resetDatabase() {
  db = createSeed()
  localStorage.removeItem(DATA)
  emitStore()
}

export function pushAudit(entry: Omit<AuditEvent, 'id' | 'tenantId' | 'at'> & { at?: string }) {
  const row: AuditEvent = {
    id: `aud_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
    tenantId: TENANT_ID,
    at: entry.at ?? new Date().toISOString(),
    actorId: entry.actorId,
    actorName: entry.actorName,
    actorRole: entry.actorRole,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    outcome: entry.outcome,
    reason: entry.reason,
  }
  db.audit.unshift(row)
  return row
}

export function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
}
