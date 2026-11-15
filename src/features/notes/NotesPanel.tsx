import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useBreakGlass, useNotes, useRecordNoteView, useSaveClinical, useSaveProcess } from '@/api/hooks'
import { useAuth } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { errorText } from '@/lib/utils'
import { Button, Field, Modal, Textarea } from '@/components/ui'
import type { ProcessNote, SessionNotesBundle } from '@/types'

const clinicalSchema = z.object({
  assessment: z.string().trim().min(3, 'Add a short note'),
  observations: z.string().trim().min(3, 'Add a short note'),
  plan: z.string().trim().min(3, 'Add a short note'),
  nextSteps: z.string().trim().min(3, 'Add a short note'),
})

export function NotesPanel({ patientId, initialSession }: { patientId: string; initialSession?: string }) {
  const notes = useNotes(patientId)
  const [sessionId, setSessionId] = useState(initialSession ?? '')
  const [revealed, setRevealed] = useState<ProcessNote | null>(null)
  const record = useRecordNoteView()
  const bundle = (notes.data ?? []).find((item) => item.session.id === sessionId) ?? notes.data?.[0]
  useEffect(() => {
    if (!sessionId && notes.data?.[0]) setSessionId(notes.data[0].session.id)
  }, [notes.data, sessionId])
  useEffect(() => {
    setRevealed(null)
  }, [bundle?.session.id])
  useEffect(() => {
    if (!bundle) return
    if (bundle.clinical.access === 'ok') record.mutate({ sessionId: bundle.session.id, kind: 'clinical', outcome: 'SUCCESS' })
    if (bundle.clinical.access === 'denied') record.mutate({ sessionId: bundle.session.id, kind: 'clinical', outcome: 'DENIED' })
    if (bundle.process.access === 'ok') record.mutate({ sessionId: bundle.session.id, kind: 'process', outcome: 'SUCCESS' })
    if (bundle.process.access === 'denied') record.mutate({ sessionId: bundle.session.id, kind: 'process', outcome: 'DENIED' })
    // Record once per selected session. The mutation identity is not a dependency on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle?.session.id, bundle?.clinical.access, bundle?.process.access])

  if (notes.isLoading) return <p className="text-sm text-stone-600">Loading notes…</p>
  if (notes.isError) return <p className="text-sm text-red-800">{errorText(notes.error)}</p>
  if (!bundle) return <p className="text-sm text-stone-600">No sessions yet, so there are no notes.</p>

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <ul className="space-y-1">
        {(notes.data ?? []).map((item) => (
          <li key={item.session.id}>
            <button type="button" className={`w-full rounded-md px-2 py-2 text-left text-sm ${item.session.id === bundle.session.id ? 'bg-teal-50' : 'hover:bg-stone-50'}`} onClick={() => setSessionId(item.session.id)}>
              {formatDateTime(item.session.start)}
            </button>
          </li>
        ))}
      </ul>
      <div className="space-y-4">
        <ClinicalBlock bundle={bundle} />
        <ProcessBlock bundle={bundle} revealed={revealed} onReveal={setRevealed} />
      </div>
    </div>
  )
}

function ClinicalBlock({ bundle }: { bundle: SessionNotesBundle }) {
  const { actor } = useAuth()
  const save = useSaveClinical()
  const note = bundle.clinical.access === 'ok' ? bundle.clinical.note : undefined
  const form = useForm<z.infer<typeof clinicalSchema>>({
    resolver: zodResolver(clinicalSchema),
    values: {
      assessment: note?.assessment ?? '',
      observations: note?.observations ?? '',
      plan: note?.plan ?? '',
      nextSteps: note?.nextSteps ?? '',
    },
  })
  const author = note ? note.authorId === actor?.userId : actor?.doctorId === bundle.session.doctorId
  if (bundle.clinical.access === 'denied') return <section className="rounded-md border border-stone-200 p-3"><h3 className="font-medium">Clinical note</h3><p className="text-sm text-stone-600">No access.</p></section>
  if (bundle.clinical.access === 'empty' && !author) return <section className="rounded-md border border-stone-200 p-3"><h3 className="font-medium">Clinical note</h3><p className="text-sm text-stone-600">No note yet.</p></section>
  return (
    <section className="rounded-md border border-stone-200 p-3">
      <h3 className="font-medium">Clinical note</h3>
      {author ? (
        <form
          className="mt-2 space-y-2"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await save.mutateAsync({ sessionId: bundle.session.id, ...values })
              toast.success('Clinical note saved')
            } catch (error) {
              toast.error(errorText(error))
            }
          })}
        >
          <Field label="Assessment" htmlFor="n-a" error={form.formState.errors.assessment?.message}><Textarea id="n-a" {...form.register('assessment')} /></Field>
          <Field label="Observations" htmlFor="n-o" error={form.formState.errors.observations?.message}><Textarea id="n-o" {...form.register('observations')} /></Field>
          <Field label="Plan" htmlFor="n-p" error={form.formState.errors.plan?.message}><Textarea id="n-p" {...form.register('plan')} /></Field>
          <Field label="Next steps" htmlFor="n-n" error={form.formState.errors.nextSteps?.message}><Textarea id="n-n" {...form.register('nextSteps')} /></Field>
          <Button type="submit" size="sm" disabled={save.isPending}>Save clinical note</Button>
        </form>
      ) : note ? (
        <div className="mt-2 space-y-1 text-sm">
          <p>{note.assessment}</p>
          <p>{note.observations}</p>
          <p>{note.plan}</p>
          <p>{note.nextSteps}</p>
        </div>
      ) : null}
      {note ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-stone-600">Version history</p>
          <ul className="mt-1 text-xs text-stone-600">
            {note.versions.map((version) => (
              <li key={version.at}>
                {formatDateTime(version.at)} · {version.authorName}
                {version.body ? <span className="block whitespace-pre-wrap text-stone-800">{version.body}</span> : null}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-stone-500">Earlier wording is shown only to the author.</p>
        </div>
      ) : null}
    </section>
  )
}

function ProcessBlock({ bundle, revealed, onReveal }: { bundle: SessionNotesBundle; revealed: ProcessNote | null; onReveal: (note: ProcessNote | null) => void }) {
  const { actor } = useAuth()
  const save = useSaveProcess()
  const glass = useBreakGlass()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const note = bundle.process.access === 'ok' ? bundle.process.note : revealed
  const canWrite = actor?.doctorId === bundle.session.doctorId && (!note || note.authorId === actor.userId)
  const form = useForm<{ body: string }>({ resolver: zodResolver(z.object({ body: z.string().trim().min(3, 'Write a short note') })), values: { body: note?.body ?? '' } })
  return (
    <section className="rounded-md border border-stone-200 p-3">
      <h3 className="font-medium">Restricted process note</h3>
      <p className="text-xs text-stone-600">Private working notes. Visible only to the author.</p>
      {bundle.process.access === 'denied' && !revealed ? <p className="mt-2 text-sm">No access.</p> : null}
      {bundle.process.access === 'locked' && !revealed ? (
        <div className="mt-2">
          <p className="text-sm">Locked. Admins do not see process notes unless they record a break-glass reason.</p>
          <Button className="mt-2" size="sm" variant="outline" onClick={() => setOpen(true)}>Break-glass access</Button>
        </div>
      ) : null}
      {(bundle.process.access === 'empty' || bundle.process.access === 'ok' || revealed) && canWrite ? (
        <form className="mt-2 space-y-2" onSubmit={form.handleSubmit(async (values) => {
          try {
            await save.mutateAsync({ sessionId: bundle.session.id, body: values.body })
            toast.success('Process note saved')
          } catch (error) {
            toast.error(errorText(error))
          }
        })}>
          <Field label="Working note" htmlFor="proc" error={form.formState.errors.body?.message}><Textarea id="proc" {...form.register('body')} /></Field>
          <Button type="submit" size="sm">Save process note</Button>
        </form>
      ) : null}
      {note && !canWrite ? <p className="mt-2 whitespace-pre-wrap text-sm">{note.body}</p> : null}
      {bundle.process.access === 'ok' && note ? (
        <ul className="mt-2 text-xs text-stone-600">
          {note.versions.map((version) => <li key={version.at}>{formatDateTime(version.at)} · {version.authorName}</li>)}
        </ul>
      ) : null}
      <Modal open={open} onOpenChange={setOpen} title="Break-glass access" description="This access is logged. Process notes stay hidden from other staff after you close this page.">
        <p className="text-sm text-red-900">You are about to read a private working note. The audit log will store your name, the time, and the reason.</p>
        <Field label="Reason" htmlFor="bg-reason">
          <Textarea id="bg-reason" value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        <Button className="mt-3" disabled={glass.isPending} onClick={async () => {
          try {
            const result = await glass.mutateAsync({ sessionId: bundle.session.id, reason })
            onReveal(result)
            setOpen(false)
            toast.success('Access logged')
          } catch (error) {
            toast.error(errorText(error))
          }
        }}>Show note</Button>
      </Modal>
    </section>
  )
}
