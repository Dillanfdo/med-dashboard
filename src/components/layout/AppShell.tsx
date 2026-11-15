import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  CalendarDays,
  Clock,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  // ScrollText,
  Settings,
  Stethoscope,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useDevFlags, useNotifications, useResetDemo, useSettings } from '@/api/hooks'
import { api } from '@/api'
import { SessionProvider } from '@/features/sessions/SessionProvider'
import { useAuth } from '@/lib/auth'
import { useCan } from '@/lib/permissions'
import { errorText } from '@/lib/utils'
import { Button, Drawer, Menu, MenuItem } from '@/components/ui'

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, show: (can: ReturnType<typeof useCan>) => can('view', 'dashboard'), end: true },
  { to: '/calendar', label: 'Calendar', own: 'My Calendar', icon: CalendarDays, show: (can: ReturnType<typeof useCan>) => can('view_all', 'calendar') || can('view_own', 'calendar') },
  { to: '/sessions', label: 'Sessions', own: 'My Sessions', icon: Clock, show: (can: ReturnType<typeof useCan>) => can('view_all', 'sessions') || can('view_own', 'sessions') },
  { to: '/patients', label: 'Patients', own: 'My Patients', icon: Users, show: (can: ReturnType<typeof useCan>) => can('view_all', 'patients') || can('view_own', 'patients') },
  { to: '/doctors', label: 'Doctors', icon: Stethoscope, show: (can: ReturnType<typeof useCan>) => can('view_all', 'doctors') },
  { to: '/availability', label: 'Availability', own: 'My Availability', icon: CalendarDays, show: (can: ReturnType<typeof useCan>) => can('view_all', 'availability') || can('view_own', 'availability') },
  { to: '/payments', label: 'Payments', icon: IndianRupee, show: (can: ReturnType<typeof useCan>) => can('view', 'payments') },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, show: (can: ReturnType<typeof useCan>) => can('view', 'analytics') },
  // { to: '/audit', label: 'Audit Log', icon: ScrollText, show: (can: ReturnType<typeof useCan>) => can('view', 'audit') },
  { to: '/settings', label: 'Settings', icon: Settings, show: (can: ReturnType<typeof useCan>) => can('view', 'settings') },
]

export function AppShell() {
  const { actor, setSession, switchRole } = useAuth()
  const can = useCan()
  const navigate = useNavigate()
  const settings = useSettings()
  const notes = useNotifications()
  const flags = useDevFlags()
  const reset = useResetDemo()
  const [navOpen, setNavOpen] = useState(false)
  const [idleOpen, setIdleOpen] = useState(false)
  const [persist, setPersist] = useState(() => api.dev.persistEnabled())
  const allDoctors = can('view_all', 'calendar')

  useEffect(() => {
    const seconds = settings.data?.idleTimeoutSeconds ?? 0
    if (!seconds || idleOpen) return
    let timer = window.setTimeout(() => setIdleOpen(true), seconds * 1000)
    const bump = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setIdleOpen(true), seconds * 1000)
    }
    window.addEventListener('pointerdown', bump)
    window.addEventListener('keydown', bump)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', bump)
      window.removeEventListener('keydown', bump)
    }
  }, [settings.data?.idleTimeoutSeconds, idleOpen])

  const items = links
    .filter((item) => item.show(can))
    .map((item) => ({ ...item, text: !allDoctors && item.own ? item.own : item.label }))

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Primary">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={() => setNavOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-2 rounded-md px-3 py-2 text-sm ${isActive ? 'bg-teal-800 text-white' : 'text-stone-800 hover:bg-stone-100'}`
          }
        >
          <item.icon className="h-4 w-4" aria-hidden />
          {item.text}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <SessionProvider>
      <div className="min-h-screen">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        <div className="bg-amber-100 px-4 py-1.5 text-center text-xs font-medium text-amber-950">PROTOTYPE - fake data. Do not enter real patient information.</div>
        <div className="flex min-h-[calc(100vh-2rem)]">
          <aside className="hidden w-60 shrink-0 border-r border-stone-200 bg-white p-3 lg:block">{nav}</aside>
          <div className="min-w-0 flex-1">
            <header className="flex flex-wrap items-center gap-2 border-b border-stone-200 bg-white px-3 py-2">
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu" onClick={() => setNavOpen(true)}>
                <MenuIcon className="h-5 w-5" />
              </Button>
              <div className="mr-auto">
                <p className="text-sm font-semibold text-teal-900">{settings.data?.clinicName ?? 'Northlight Counselling'}</p>
                <p className="text-xs text-stone-600">Staff workspace</p>
              </div>
              {actor && actor.roles.length > 1 ? (
                <div role="radiogroup" aria-label="Acting as" className="flex items-center gap-1 rounded-md border border-stone-300 p-0.5">
                  <span className="px-2 text-xs text-stone-600">Acting as</span>
                  {actor.roles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      role="radio"
                      aria-checked={actor.activeRole === role}
                      onClick={() => switchRole(role)}
                      className={`rounded px-2 py-1 text-xs font-medium ${actor.activeRole === role ? 'bg-teal-800 text-white' : 'text-stone-700'}`}
                    >
                      {role === 'ADMIN' ? 'Admin' : 'Doctor'}
                    </button>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-stone-600">Acting as {actor?.activeRole === 'ADMIN' ? 'Admin' : 'Doctor'}</span>
              )}
              <Menu
                label="Notifications"
                trigger={
                  <Button variant="ghost" size="icon" aria-label="Notifications">
                    <Bell className="h-5 w-5" />
                  </Button>
                }
              >
                {(notes.data ?? []).length === 0 ? <p className="px-2 py-2 text-sm text-stone-600">No alerts</p> : null}
                {(notes.data ?? []).map((item) => (
                  <MenuItem key={item.id} onSelect={() => navigate(item.href)}>
                    <span className="block font-medium">{item.title}</span>
                    <span className="block text-xs text-stone-600">{item.body}</span>
                  </MenuItem>
                ))}
              </Menu>
              <Menu
                label="Account"
                trigger={
                  <Button variant="outline" size="sm">
                    {actor?.name}
                  </Button>
                }
              >
                <p className="px-2 py-1 text-xs text-stone-600">{actor?.email}</p>
                <MenuItem
                  onSelect={() => {
                    setSession(null)
                    navigate('/sign-in')
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <LogOut className="h-4 w-4" /> Sign out
                  </span>
                </MenuItem>
              </Menu>
            </header>
            <main id="main" className="p-4 md:p-6">
              <Outlet />
            </main>
          </div>
        </div>
        <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-700">
          <span>Prototype — all data is fake</span>
          <label className="inline-flex items-center gap-1">
            Idle timeout
            <select
              className="h-7 rounded border border-stone-300 bg-white px-1"
              value={String(settings.data?.idleTimeoutSeconds ?? 0)}
              onChange={(event) => flags.mutate({ idleTimeoutSeconds: Number(event.target.value) })}
            >
              <option value="0">Off</option>
              <option value="45">45 seconds</option>
              <option value="120">2 minutes</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={settings.data?.simulateMeetFailure ?? false}
              onChange={(event) => flags.mutate({ simulateMeetFailure: event.target.checked })}
            />
            Next Meet link fails
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={persist}
              onChange={(event) => {
                api.dev.setPersist(event.target.checked)
                setPersist(event.target.checked)
              }}
            />
            Remember mock data
          </label>
          <button
            type="button"
            className="underline"
            onClick={() =>
              reset.mutate(undefined, {
                onSuccess: () => toast.success('Fake data reset'),
                onError: (error) => toast.error(errorText(error)),
              })
            }
          >
            Reset fake data
          </button>
        </div>
      </div>
      <Drawer open={navOpen} onOpenChange={setNavOpen} title="Menu">
        {nav}
      </Drawer>
      {idleOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/50 p-4" role="alertdialog" aria-labelledby="idle-title" aria-modal="true">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 id="idle-title" className="text-lg font-semibold">
              Session expiring due to inactivity
            </h2>
            <p className="mt-2 text-sm text-stone-600">This is a prototype timeout. Stay signed in, or sign out.</p>
            <div className="mt-4 flex gap-2">
              <Button onClick={() => setIdleOpen(false)}>Stay signed in</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSession(null)
                  navigate('/sign-in')
                }}
              >
                Sign out
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </SessionProvider>
  )
}
