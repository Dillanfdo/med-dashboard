import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useDevSignIn, useSignIn, useVerifyMfa } from '@/api/hooks'
import { useAuth } from '@/lib/auth'
import { errorText } from '@/lib/utils'
import { Button, Field, Input } from '@/components/ui'

const credentials = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Enter a password'),
})
const mfa = z.object({ code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code') })

const personas = [
  { id: 'usr_ananya', label: 'Owner (Admin + Doctor)', email: 'ananya.rao@example.com' },
  { id: 'usr_kabir', label: 'Doctor only', email: 'kabir.mehta@example.com' },
  { id: 'usr_sana', label: 'Admin only', email: 'sana.kapoor@example.com' },
]

export function SignInPage() {
  const { actor, setSession } = useAuth()
  const signIn = useSignIn()
  const verify = useVerifyMfa()
  const dev = useDevSignIn()
  const [pending, setPending] = useState<{ userId: string; name: string; email: string } | null>(null)
  const [error, setError] = useState('')
  const form = useForm<z.infer<typeof credentials>>({ resolver: zodResolver(credentials), defaultValues: { email: '', password: '' } })
  const codeForm = useForm<z.infer<typeof mfa>>({ resolver: zodResolver(mfa), defaultValues: { code: '' } })
  if (actor) return <Navigate to="/" replace />

  return (
    <div className="min-h-screen bg-stone-100">
      <div className="bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-950">PROTOTYPE - fake data</div>
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-10">
        <div>
          <p className="text-sm font-medium text-teal-900">Northlight Counselling</p>
          <h1 className="mt-1 text-2xl font-semibold">Staff sign in</h1>
        </div>
        {!pending ? (
          <form
            className="space-y-3 rounded-xl bg-white p-5 shadow-sm"
            onSubmit={form.handleSubmit(async (values) => {
              setError('')
              try {
                const user = await signIn.mutateAsync(values)
                setPending(user)
              } catch (err) {
                setError(errorText(err))
              }
            })}
          >
            <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
              <Input id="email" autoComplete="username" {...form.register('email')} />
            </Field>
            <Field label="Password" htmlFor="password" error={form.formState.errors.password?.message}>
              <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
            </Field>
            {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
            <Button type="submit" disabled={signIn.isPending}>Continue</Button>
          </form>
        ) : (
          <form
            className="space-y-3 rounded-xl bg-white p-5 shadow-sm"
            onSubmit={codeForm.handleSubmit(async (values) => {
              setError('')
              try {
                const next = await verify.mutateAsync({ userId: pending.userId, code: values.code })
                setSession(next)
              } catch (err) {
                setError(errorText(err))
              }
            })}
          >
            <p className="text-sm text-stone-700">Enter the 6-digit code for {pending.email}. Prototype code: 123456.</p>
            <Field label="Code" htmlFor="code" error={codeForm.formState.errors.code?.message}>
              <Input id="code" inputMode="numeric" autoComplete="one-time-code" {...codeForm.register('code')} />
            </Field>
            {error ? <p className="text-sm text-red-800" role="alert">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="submit" disabled={verify.isPending}>Sign in</Button>
              <Button type="button" variant="outline" onClick={() => setPending(null)}>Back</Button>
            </div>
          </form>
        )}
        <section className="rounded-xl border border-dashed border-stone-300 bg-white p-4">
          <h2 className="text-sm font-semibold">Dev-only sign in as</h2>
          <p className="mt-1 text-xs text-stone-600">Any password works on the form. These buttons skip straight in.</p>
          <div className="mt-3 flex flex-col gap-2">
            {personas.map((persona) => (
              <Button
                key={persona.id}
                variant="outline"
                disabled={dev.isPending}
                onClick={async () => {
                  const next = await dev.mutateAsync(persona.id)
                  setSession(next)
                }}
              >
                {persona.label}
                <span className="text-xs text-stone-500">{persona.email}</span>
              </Button>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
