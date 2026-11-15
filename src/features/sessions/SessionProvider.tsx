import { createContext, useContext, useState, type ReactNode } from 'react'
import { BookSessionDialog } from '@/features/sessions/BookSessionDialog'
import { SessionDrawer } from '@/features/sessions/SessionDrawer'

interface BookPrefill {
  doctorId?: string
  date?: string
  time?: string
}

interface SessionUi {
  openBook: (prefill?: BookPrefill) => void
  openSession: (id: string) => void
}

const Ctx = createContext<SessionUi | null>(null)

export function useSessionUi() {
  const value = useContext(Ctx)
  if (!value) throw new Error('Session tools are unavailable')
  return value
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [book, setBook] = useState<BookPrefill | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  return (
    <Ctx.Provider
      value={{
        openBook: (prefill) => setBook(prefill ?? {}),
        openSession: (id) => setSessionId(id),
      }}
    >
      {children}
      <BookSessionDialog
        open={book !== null}
        prefill={book ?? undefined}
        onOpenChange={(open) => {
          if (!open) setBook(null)
        }}
        onCreated={(id) => {
          setBook(null)
          setSessionId(id)
        }}
      />
      <SessionDrawer sessionId={sessionId} onOpenChange={(open) => !open && setSessionId(null)} />
    </Ctx.Provider>
  )
}

export type { BookPrefill }
