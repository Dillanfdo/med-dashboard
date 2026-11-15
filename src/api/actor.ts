import { ApiError } from '@/api/errors'
import type { Actor } from '@/types'

let current: Actor | null = null

export function setMockActor(actor: Actor | null) {
  current = actor
}

export function getActor(): Actor {
  if (!current) throw new ApiError('Sign in required.', 'UNAUTHENTICATED')
  return current
}
