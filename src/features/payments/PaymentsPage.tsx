import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useDoctors, useExportPayments, usePatients, usePayments, usePaymentSummary, useRefundPayment, useSessions, useSettings } from '@/api/hooks'
import { formatDate, formatInr } from '@/lib/format'
import { errorText } from '@/lib/utils'
import { Button, Card, Field, Input, Modal, QueryState, Select, Textarea } from '@/components/ui'
import type { Payment } from '@/types'

export function PaymentsPage() {
  const [doctorId, setDoctorId] = useState('')
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const payments = usePayments({ doctorId, status, method, from, to })
  const summary = usePaymentSummary()
  const doctors = useDoctors()
  const patients = usePatients()
  const sessions = useSessions()
  const settings = useSettings()
  const [refund, setRefund] = useState<Payment | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  useEffect(() => { document.title = 'Payments · Northlight' }, [])
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Payments</h1>
          <p className="text-sm text-stone-600">Admins only. Card numbers are not collected.</p>
        </div>
        <Button variant="outline" onClick={() => setExportOpen(true)}>Export CSV</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm text-stone-600">Outstanding</p><p className="text-2xl font-semibold">{summary.data ? formatInr(summary.data.outstanding) : '…'}</p></Card>
        <Card><p className="text-sm text-stone-600">Unpaid completed sessions</p><p className="text-2xl font-semibold">{summary.data?.unpaidSessions ?? '…'}</p></Card>
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        <Input type="date" aria-label="From" value={from} onChange={(event) => setFrom(event.target.value)} />
        <Input type="date" aria-label="To" value={to} onChange={(event) => setTo(event.target.value)} />
        <Select aria-label="Doctor" value={doctorId} onChange={(event) => setDoctorId(event.target.value)}>
          <option value="">All doctors</option>
          {(doctors.data ?? []).map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.fullName}</option>)}
        </Select>
        <Select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All statuses</option>
          {['PENDING', 'PAID', 'PARTIALLY_PAID', 'REFUNDED', 'WAIVED'].map((item) => <option key={item}>{item}</option>)}
        </Select>
        <Select aria-label="Method" value={method} onChange={(event) => setMethod(event.target.value)}>
          <option value="">All methods</option>
          {['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'OTHER'].map((item) => <option key={item}>{item}</option>)}
        </Select>
      </div>
      <QueryState isLoading={payments.isLoading} isError={payments.isError} error={payments.error} onRetry={() => void payments.refetch()} isEmpty={(payments.data ?? []).length === 0} emptyTitle="No payments" emptyBody="Record a payment from a session.">
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="px-3 py-2">Date</th><th className="px-3 py-2">Patient</th><th className="px-3 py-2">Session</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Method</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Receipt</th><th className="px-3 py-2">Recorded by</th><th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(payments.data ?? []).map((payment) => {
                const patient = patients.data?.find((item) => item.id === payment.patientId)
                const session = sessions.data?.find((item) => item.id === payment.sessionId)
                return (
                  <tr key={payment.id} className="border-t border-stone-100">
                    <td className="px-3 py-2">{formatDate(payment.recordedAt)}</td>
                    <td className="px-3 py-2">{patient?.fullName ?? payment.patientId}</td>
                    <td className="px-3 py-2">{session ? formatDate(session.start) : payment.sessionId}</td>
                    <td className="px-3 py-2">{formatInr(payment.amount)}</td>
                    <td className="px-3 py-2">{payment.method}</td>
                    <td className="px-3 py-2">{payment.status}</td>
                    <td className="px-3 py-2">{payment.receiptNumber ? <button type="button" className="text-teal-900 underline" onClick={() => printReceipt(payment, settings.data?.clinicName ?? 'Clinic', patient?.fullName ?? payment.patientId)}>{payment.receiptNumber}</button> : '—'}</td>
                    <td className="px-3 py-2">{payment.recordedByName}</td>
                    <td className="px-3 py-2">{payment.status === 'PAID' || payment.status === 'PARTIALLY_PAID' ? <Button size="sm" variant="outline" onClick={() => setRefund(payment)}>Refund</Button> : null}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </QueryState>
      <RefundDialog payment={refund} onClose={() => setRefund(null)} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  )
}

function printReceipt(payment: Payment, clinic: string, patient: string) {
  const win = window.open('', '_blank', 'noopener,noreferrer')
  if (!win) return
  win.document.write(`<!doctype html><title>Receipt</title><body style="font-family:sans-serif;padding:24px"><h1>${clinic}</h1><p>Sample receipt ${payment.receiptNumber ?? ''}</p><p>${patient}</p><p>${formatInr(payment.amount)} · ${payment.method} · ${payment.status}</p><p>Reference: ${payment.reference ?? '—'}</p><p>Recorded by ${payment.recordedByName}</p></body>`)
  win.document.close()
  win.focus()
  win.print()
}

function RefundDialog({ payment, onClose }: { payment: Payment | null; onClose: () => void }) {
  const form = useForm<{ reason: string }>({ resolver: zodResolver(z.object({ reason: z.string().min(3, 'Add a reason') })), defaultValues: { reason: '' } })
  const save = useRefundPayment()
  return (
    <Modal open={!!payment} onOpenChange={(open) => !open && onClose()} title="Mark refund">
      <form className="space-y-3" onSubmit={form.handleSubmit(async (values) => {
        if (!payment) return
        try {
          await save.mutateAsync({ id: payment.id, reason: values.reason })
          toast.success('Marked refunded')
          onClose()
        } catch (error) {
          toast.error(errorText(error))
        }
      })}>
        <Field label="Reason" htmlFor="rf" error={form.formState.errors.reason?.message}><Textarea id="rf" {...form.register('reason')} /></Field>
        <Button type="submit">Confirm refund</Button>
      </form>
    </Modal>
  )
}

function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const form = useForm<{ reason: string }>({ resolver: zodResolver(z.object({ reason: z.string().min(3, 'Add a reason') })), defaultValues: { reason: '' } })
  const exp = useExportPayments()
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Export payments CSV">
      <form className="space-y-3" onSubmit={form.handleSubmit(async (values) => {
        try {
          const csv = await exp.mutateAsync(values.reason)
          const blob = new Blob([csv], { type: 'text/csv' })
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = 'payments-sample.csv'
          link.click()
          URL.revokeObjectURL(url)
          toast.success('Sample CSV downloaded')
          onOpenChange(false)
        } catch (error) {
          toast.error(errorText(error))
        }
      })}>
        <Field label="Reason" htmlFor="csv-reason" error={form.formState.errors.reason?.message}><Textarea id="csv-reason" {...form.register('reason')} /></Field>
        <Button type="submit">Download</Button>
      </form>
    </Modal>
  )
}
