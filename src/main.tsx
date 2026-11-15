import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import App from './App'
import { api } from '@/api'
import { subscribeStore } from '@/mocks/store'
import { AuthProvider, useAuth } from '@/lib/auth'
import { ClinicalNotesFlagProvider } from '@/lib/permissions'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

function StoreSync() {
  const client = useQueryClient()
  useEffect(() => subscribeStore(() => { void client.invalidateQueries() }), [client])
  return null
}

function FlagsBridge({ children }: { children: React.ReactNode }) {
  const { actor } = useAuth()
  const settings = useQuery({ queryKey: ['settings', actor ? `${actor.userId}:${actor.activeRole}` : ''], queryFn: () => api.settings.get(), enabled: !!actor })
  return <ClinicalNotesFlagProvider value={settings.data?.adminCanViewClinicalNotes ?? true}>{children}</ClinicalNotesFlagProvider>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FlagsBridge>
          <BrowserRouter>
            <StoreSync />
            <App />
            <Toaster position="top-center" />
          </BrowserRouter>
        </FlagsBridge>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
